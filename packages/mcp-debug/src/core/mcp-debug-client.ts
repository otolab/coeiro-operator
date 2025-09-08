/**
 * MCP Debug Client
 * すべてのコンポーネントを統合するメインクラス
 */

import { MCPStateManager, MCPServerState } from './state-manager.js';
import { ProcessManager } from './process-manager.js';
import { MCPProtocolHandler, MCPCapabilities, MCPMessage } from './mcp-protocol-handler.js';
import { RequestTracker } from './request-tracker.js';

export interface MCPDebugClientOptions {
  serverPath: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeout?: number;
  requestTimeout?: number;
  capabilities?: MCPCapabilities;
  debug?: boolean;
}

export class MCPDebugClient {
  private stateManager: MCPStateManager;
  private processManager: ProcessManager;
  private protocolHandler: MCPProtocolHandler;
  private requestTracker: RequestTracker;
  private messageBuffer: string = '';
  private isInitialized = false;
  private logs: Array<{ timestamp: Date; level: 'stdout' | 'stderr'; message: string }> = [];

  constructor(private options: MCPDebugClientOptions) {
    // コンポーネントを初期化
    this.stateManager = new MCPStateManager();
    this.requestTracker = new RequestTracker(options.requestTimeout || 10000);
    this.protocolHandler = new MCPProtocolHandler(this.stateManager, this.requestTracker);
    this.processManager = new ProcessManager({
      serverPath: options.serverPath,
      args: options.args,
      env: options.env,
      cwd: options.cwd,
      timeout: options.timeout,
    });

    this.setupHandlers();
  }

  /**
   * イベントハンドラーをセットアップ
   */
  private setupHandlers(): void {
    // プロセスマネージャーのイベント処理
    this.processManager.on('stdout', (data: string) => {
      this.handleProcessOutput(data);
    });

    this.processManager.on('stderr', (data: string) => {
      // ログを保存
      this.logs.push({
        timestamp: new Date(),
        level: 'stderr',
        message: data,
      });

      if (this.options.debug) {
        console.error('[MCP Server]', data);
      }
    });

    this.processManager.on('start', () => {
      if (this.options.debug) {
        console.error('[MCP Debug] Process started, PID:', this.processManager.getPid());
      }
      // プロセス起動後、状態をUNINITIALIZEDに設定
      this.stateManager.transitionTo(MCPServerState.UNINITIALIZED);
    });

    this.processManager.on('exit', (code, signal) => {
      if (this.options.debug) {
        console.error('[MCP Debug] Process exited', { code, signal });
      }
      this.stateManager.transitionTo(MCPServerState.TERMINATED);
    });

    this.processManager.on('error', error => {
      console.error('[MCP Debug] Process error:', error);
      this.stateManager.transitionTo(MCPServerState.TERMINATED);
    });

    // プロトコルハンドラーに出力ハンドラーを設定
    this.protocolHandler.setOutputHandler((data: string) => {
      this.processManager.sendInput(data);
    });

    // 状態変更のログ出力
    if (this.options.debug) {
      this.stateManager.onStateChange((oldState, newState) => {
        console.error(`[MCP Debug] State transition: ${oldState} -> ${newState}`);
      });
    }
  }

  /**
   * プロセス出力を処理
   */
  private handleProcessOutput(data: string): void {
    this.messageBuffer += data;

    // 改行で分割してメッセージを処理
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as MCPMessage;

        // stdoutのJSONメッセージもログに保存
        this.logs.push({
          timestamp: new Date(),
          level: 'stdout',
          message: JSON.stringify(message),
        });

        // デバッグモードの場合、受信したメッセージをログ出力
        if (this.options.debug) {
          console.error('[MCP Debug] Raw message received:', JSON.stringify(message));
        }

        // MCPメッセージとして処理
        this.protocolHandler.handleMessage(message);

        // デバッグモードの場合、処理されたメッセージをログ出力
        if (this.options.debug) {
          if ('id' in message) {
            console.error('[MCP Debug] Response processed:', { id: message.id });
          } else if ('method' in message) {
            console.error('[MCP Debug] Notification processed:', message.method);
          }
        }
      } catch {
        // JSON以外の出力（デバッグログなど）もログに保存
        this.logs.push({
          timestamp: new Date(),
          level: 'stdout',
          message: line,
        });

        if (this.options.debug) {
          console.error('[MCP Server Output]', line);
        }
      }
    }
  }

  /**
   * MCPクライアントを起動
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('Client is already initialized');
    }

    try {
      // プロセスを起動
      await this.processManager.start();

      // プロセスがUNINITIALIZED状態になるのを待つ
      await this.stateManager.waitForState(MCPServerState.UNINITIALIZED, 5000);

      // MCP初期化を実行
      const capabilities = this.options.capabilities || {
        tools: {},
      };

      if (this.options.debug) {
        console.error('[MCP Debug] Sending initialize request...');
      }

      const initResponse = await this.protocolHandler.initialize(capabilities);

      if (this.options.debug) {
        console.error('[MCP Debug] Initialize response:', initResponse);
      }

      // READY状態を待つ
      await this.stateManager.waitForState(MCPServerState.READY, 5000);

      this.isInitialized = true;

      if (this.options.debug) {
        console.error('[MCP Debug] Client successfully initialized');
      }
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  /**
   * MCPツールを呼び出し
   */
  async callTool(name: string, args?: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Client is not initialized. Call start() first.');
    }

    if (!this.stateManager.canAcceptRequest()) {
      throw new Error(`Server not ready. Current state: ${this.stateManager.currentState}`);
    }

    if (this.options.debug) {
      console.error('[MCP Debug] Calling tool:', name, args);
    }

    const result = await this.protocolHandler.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    if (this.options.debug) {
      console.error('[MCP Debug] Tool result:', result);
    }

    return result;
  }

  /**
   * 任意のMCPリクエストを送信
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Client is not initialized. Call start() first.');
    }

    return this.protocolHandler.sendRequest(method, params);
  }

  /**
   * 任意のMCP通知を送信
   */
  sendNotification(method: string, params?: any): void {
    if (!this.isInitialized) {
      throw new Error('Client is not initialized. Call start() first.');
    }

    this.protocolHandler.sendNotification(method, params);
  }

  /**
   * サーバーの状態を取得
   */
  getState(): MCPServerState {
    return this.stateManager.currentState;
  }

  /**
   * サーバーがリクエストを受け付けられる状態か確認
   */
  isReady(): boolean {
    return this.isInitialized && this.stateManager.canAcceptRequest();
  }

  /**
   * サーバーの機能を取得
   */
  getServerCapabilities(): any {
    return this.protocolHandler.getServerCapabilities();
  }

  /**
   * 保留中のリクエスト数を取得
   */
  getPendingRequestCount(): number {
    return this.requestTracker.getPendingCount();
  }

  /**
   * MCPクライアントを停止
   */
  async stop(): Promise<void> {
    if (this.options.debug) {
      console.error('[MCP Debug] Stopping client...');
    }

    this.isInitialized = false;

    // 状態をSHUTTING_DOWNに遷移
    if (this.stateManager.currentState !== MCPServerState.TERMINATED) {
      this.stateManager.transitionTo(MCPServerState.SHUTTING_DOWN);
    }

    // プロセスを停止
    await this.processManager.stop();

    // クリーンアップ
    this.protocolHandler.cleanup();
    this.stateManager.reset();

    if (this.options.debug) {
      console.error('[MCP Debug] Client stopped');
    }
  }

  /**
   * MCPサーバーを再起動
   */
  async restart(): Promise<void> {
    if (this.options.debug) {
      console.error('[MCP Debug] Restarting server...');
    }

    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.stop();
    await this.processManager.cleanup();
    this.logs = [];
  }

  /**
   * ログを取得
   */
  getLogs(filter?: {
    level?: 'stdout' | 'stderr';
    since?: Date;
    limit?: number;
  }): Array<{ timestamp: Date; level: 'stdout' | 'stderr'; message: string }> {
    let logs = [...this.logs];

    if (filter) {
      if (filter.level) {
        logs = logs.filter(log => log.level === filter.level);
      }

      if (filter.since) {
        const since = filter.since;
        logs = logs.filter(log => log.timestamp >= since);
      }

      if (filter.limit) {
        logs = logs.slice(-filter.limit);
      }
    }

    return logs;
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.logs = [];
  }
}
