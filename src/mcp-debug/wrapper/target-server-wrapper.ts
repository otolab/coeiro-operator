/**
 * Target Server Wrapper
 * テスト対象MCPサーバーを内部から呼び出すラッパー機能
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DebugLogManager } from '../logger/index.js';
import { OutputManager } from '../output/manager.js';
import type { ControlHandler } from '../control/handler.js';

export interface ServerModule {
  default?: any;
  main?: () => Promise<void>;
  server?: McpServer;
  [key: string]: any;
}

export interface WrapperOptions {
  serverPath: string;
  debugMode?: boolean;
  enableControlCommands?: boolean;
  interceptStdio?: boolean;
}

export interface ServerState {
  isRunning: boolean;
  serverModule: ServerModule | null;
  serverInstance: McpServer | null;
  transport: StdioServerTransport | null;
  lastRestart: Date | null;
  errorCount: number;
}

export class TargetServerWrapper {
  private options: WrapperOptions;
  private state: ServerState;
  private logManager: DebugLogManager;
  private outputManager: OutputManager;
  private controlHandler: ControlHandler | null = null;
  private originalStdio: {
    stdout: typeof process.stdout.write;
    stderr: typeof process.stderr.write;
  } | null = null;

  constructor(options: WrapperOptions) {
    this.options = {
      debugMode: false,
      enableControlCommands: true,
      interceptStdio: true,
      ...options
    };

    this.state = {
      isRunning: false,
      serverModule: null,
      serverInstance: null,
      transport: null,
      lastRestart: null,
      errorCount: 0
    };

    this.logManager = DebugLogManager.getInstance();
    this.outputManager = new OutputManager({
      enableDebugOutput: this.options.debugMode || false,
      enableMcpOutput: true,
      enableControlOutput: this.options.enableControlCommands || true
    });

    this.setupLogging();
  }

  private setupLogging(): void {
    const logger = this.logManager.getLogger('wrapper');
    logger.info('TargetServerWrapper initialized', {
      serverPath: this.options.serverPath,
      debugMode: this.options.debugMode,
      enableControlCommands: this.options.enableControlCommands
    });
  }

  /**
   * 制御ハンドラーを設定
   */
  setControlHandler(handler: ControlHandler): void {
    this.controlHandler = handler;
  }

  /**
   * 標準入出力をインターセプト
   */
  private interceptStdio(): void {
    if (!this.options.interceptStdio || this.originalStdio) {
      return;
    }

    const logger = this.logManager.getLogger('wrapper');
    
    // 元の stdio を保存
    this.originalStdio = {
      stdout: process.stdout.write.bind(process.stdout),
      stderr: process.stderr.write.bind(process.stderr)
    };

    // stdout をインターセプト（MCP メッセージ用）
    process.stdout.write = ((data: any, encoding?: any, cb?: any) => {
      try {
        const message = data.toString();
        
        // JSON-RPC メッセージかどうかチェック
        if (message.trim().startsWith('{') && message.includes('jsonrpc')) {
          this.outputManager.writeMcpResponse(message);
          logger.debug('Intercepted MCP response', { message: message.substring(0, 100) });
        } else {
          // 通常の stdout はそのまま通す
          this.originalStdio!.stdout(data, encoding, cb);
        }
      } catch (error) {
        logger.error('Error intercepting stdout', error);
        this.originalStdio!.stdout(data, encoding, cb);
      }
      
      return true;
    }) as any;

    // stderr をインターセプト（エラーログ用）
    process.stderr.write = ((data: any, encoding?: any, cb?: any) => {
      try {
        const message = data.toString();
        this.outputManager.writeError(message);
        logger.debug('Intercepted stderr', { message: message.substring(0, 100) });
      } catch (error) {
        this.originalStdio!.stderr(data, encoding, cb);
      }
      
      return true;
    }) as any;

    logger.info('Stdio interception enabled');
  }

  /**
   * 標準入出力のインターセプトを解除
   */
  private restoreStdio(): void {
    if (!this.originalStdio) {
      return;
    }

    process.stdout.write = this.originalStdio.stdout;
    process.stderr.write = this.originalStdio.stderr;
    this.originalStdio = null;

    const logger = this.logManager.getLogger('wrapper');
    logger.info('Stdio interception disabled');
  }

  /**
   * テスト対象サーバーを動的ロード
   */
  async loadTargetServer(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    try {
      logger.info('Loading target server', { serverPath: this.options.serverPath });

      // Node.js の require cache をクリア（rewire の代替）
      const fullPath = require.resolve(this.options.serverPath);
      delete require.cache[fullPath];

      // モジュールを動的インポート
      const serverModule = await import(this.options.serverPath);
      this.state.serverModule = serverModule;

      logger.info('Target server loaded successfully', {
        exports: Object.keys(serverModule),
        hasDefault: !!serverModule.default,
        hasMain: !!serverModule.main,
        hasServer: !!serverModule.server
      });

    } catch (error) {
      logger.error('Failed to load target server', error);
      this.state.errorCount++;
      throw new Error(`Failed to load server from ${this.options.serverPath}: ${(error as Error).message}`);
    }
  }

  /**
   * テスト対象サーバーを起動
   */
  async startTargetServer(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    if (this.state.isRunning) {
      throw new Error('Server is already running');
    }

    try {
      await this.loadTargetServer();
      
      // stdio インターセプトを開始
      this.interceptStdio();

      logger.info('Starting target server...');

      // サーバーの起動方法を判定して実行
      if (this.state.serverModule?.main) {
        // main 関数がある場合は直接実行
        await this.state.serverModule.main();
      } else if (this.state.serverModule?.default?.main) {
        // default export に main がある場合
        await this.state.serverModule.default.main();
      } else if (this.state.serverModule?.server) {
        // server インスタンスがある場合は手動で接続
        const transport = new StdioServerTransport();
        await this.state.serverModule.server.connect(transport);
        this.state.transport = transport;
        this.state.serverInstance = this.state.serverModule.server;
      } else {
        throw new Error('No suitable startup method found in target server module');
      }

      this.state.isRunning = true;
      this.state.lastRestart = new Date();
      this.state.errorCount = 0;

      logger.info('Target server started successfully');

    } catch (error) {
      logger.error('Failed to start target server', error);
      this.state.errorCount++;
      await this.stopTargetServer();
      throw error;
    }
  }

  /**
   * テスト対象サーバーを停止
   */
  async stopTargetServer(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    try {
      logger.info('Stopping target server...');

      if (this.state.transport) {
        this.state.transport.close?.();
        this.state.transport = null;
      }

      if (this.state.serverInstance) {
        // サーバーに shutdown メソッドがあれば呼び出し
        if (typeof this.state.serverInstance.shutdown === 'function') {
          await this.state.serverInstance.shutdown();
        }
        this.state.serverInstance = null;
      }

      // stdio インターセプトを解除
      this.restoreStdio();

      this.state.isRunning = false;
      this.state.serverModule = null;

      logger.info('Target server stopped');

    } catch (error) {
      logger.error('Error stopping target server', error);
      throw error;
    }
  }

  /**
   * テスト対象サーバーを再起動
   */
  async restartTargetServer(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    logger.info('Restarting target server...');

    await this.stopTargetServer();
    
    // 少し待機してからリスタート
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await this.startTargetServer();
    
    logger.info('Target server restarted successfully');
  }

  /**
   * サーバーの状態を取得
   */
  getServerState(): ServerState & { uptime: number } {
    const uptime = this.state.lastRestart 
      ? Date.now() - this.state.lastRestart.getTime()
      : 0;

    return {
      ...this.state,
      uptime
    };
  }

  /**
   * 制御コマンドを処理
   */
  async handleControlCommand(command: string): Promise<any> {
    const logger = this.logManager.getLogger('wrapper');
    
    logger.debug('Handling control command', { command });

    // 基本的な制御コマンド
    switch (command) {
      case 'restart':
      case 'restart:graceful':
        await this.restartTargetServer();
        return { status: 'restarted', timestamp: new Date() };

      case 'stop':
        await this.stopTargetServer();
        return { status: 'stopped', timestamp: new Date() };

      case 'start':
        await this.startTargetServer();
        return { status: 'started', timestamp: new Date() };

      case 'status':
        return this.getServerState();

      case 'reload':
        // コードの再読み込み
        await this.stopTargetServer();
        await this.loadTargetServer();
        await this.startTargetServer();
        return { status: 'reloaded', timestamp: new Date() };

      default:
        // その他のコマンドは制御ハンドラーに委譲
        if (this.controlHandler) {
          return await this.controlHandler.handleCommand(command);
        }
        throw new Error(`Unknown control command: ${command}`);
    }
  }

  /**
   * クリーンアップ
   */
  async shutdown(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    logger.info('Shutting down TargetServerWrapper...');

    try {
      await this.stopTargetServer();
      this.outputManager.shutdown();
      
      logger.info('TargetServerWrapper shutdown completed');
    } catch (error) {
      logger.error('Error during wrapper shutdown', error);
    }
  }
}