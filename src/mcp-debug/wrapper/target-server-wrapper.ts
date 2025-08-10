/**
 * Target Server Wrapper
 * テスト対象MCPサーバーを子プロセスとして起動・制御するラッパー機能
 */

import { spawn, ChildProcess } from 'child_process';
import { DebugLogManager } from '../logger/index.js';
import { OutputManager } from '../output/manager.js';
import type { ControlHandler } from '../control/handler.js';

export interface WrapperOptions {
  serverPath: string;
  debugMode?: boolean;
  enableControlCommands?: boolean;
  interceptStdio?: boolean;
  childArgs?: string[];
  timeout?: number;
}

export interface ServerState {
  isRunning: boolean;
  childProcess: ChildProcess | null;
  lastRestart: Date | null;
  errorCount: number;
  pid?: number;
}

export class TargetServerWrapper {
  private options: WrapperOptions;
  private state: ServerState;
  private logManager: DebugLogManager;
  private outputManager: OutputManager;
  private controlHandler: ControlHandler | null = null;
  private timeoutHandlers: Set<NodeJS.Timeout> = new Set();

  constructor(options: WrapperOptions) {
    this.options = {
      debugMode: false,
      enableControlCommands: true,
      interceptStdio: true,
      childArgs: [],
      timeout: 30000,
      ...options
    };

    this.state = {
      isRunning: false,
      childProcess: null,
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
      enableControlCommands: this.options.enableControlCommands,
      childArgs: this.options.childArgs,
      timeout: this.options.timeout
    });
  }

  /**
   * 制御ハンドラーを設定
   */
  setControlHandler(handler: ControlHandler): void {
    this.controlHandler = handler;
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
      logger.info('Starting target server as child process', {
        serverPath: this.options.serverPath,
        childArgs: this.options.childArgs,
        timeout: this.options.timeout
      });

      // 子プロセスで対象サーバーを起動
      const args = [...(this.options.childArgs || [])];
      const childProcess = spawn('node', [this.options.serverPath, ...args], {
        stdio: 'pipe',
        env: { ...process.env }
      });

      this.state.childProcess = childProcess;
      this.state.pid = childProcess.pid;

      // 標準出力の処理
      childProcess.stdout?.on('data', (data) => {
        const message = data.toString();
        if (this.options.interceptStdio) {
          // JSON-RPC メッセージかどうかチェック
          if (message.trim().startsWith('{') && message.includes('jsonrpc')) {
            this.outputManager.writeMcpResponse(message);
          } else if (message.includes('CTRL_RESPONSE:')) {
            this.outputManager.writeControlResponse(message);
          } else {
            this.outputManager.writeMcpResponse(message);
          }
        } else {
          process.stdout.write(data);
        }
      });

      // 標準エラー出力の処理
      childProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (this.options.interceptStdio) {
          this.outputManager.writeError(message);
        } else {
          process.stderr.write(data);
        }
      });

      // プロセス終了時の処理
      childProcess.on('close', (code, signal) => {
        logger.info('Child process closed', { code, signal, pid: this.state.pid });
        this.state.isRunning = false;
        this.state.childProcess = null;
        this.state.pid = undefined;
      });

      childProcess.on('error', (error) => {
        logger.error('Child process error', { error, pid: this.state.pid });
        this.state.errorCount++;
        this.state.isRunning = false;
        this.state.childProcess = null;
        this.state.pid = undefined;
      });

      // タイムアウト設定
      if (this.options.timeout && this.options.timeout > 0) {
        const timeoutId = setTimeout(() => {
          if (this.state.isRunning && this.state.childProcess) {
            logger.warn('Child process timed out, killing process', { 
              timeout: this.options.timeout, 
              pid: this.state.pid 
            });
            this.state.childProcess.kill('SIGTERM');
            
            // 強制終了のタイムアウト
            setTimeout(() => {
              if (this.state.childProcess && !this.state.childProcess.killed) {
                logger.warn('Force killing child process', { pid: this.state.pid });
                this.state.childProcess.kill('SIGKILL');
              }
            }, 5000);
          }
        }, this.options.timeout);
        
        this.timeoutHandlers.add(timeoutId);

        // プロセス終了時にタイムアウトをクリア
        childProcess.on('close', () => {
          clearTimeout(timeoutId);
          this.timeoutHandlers.delete(timeoutId);
        });
      }

      // プロセス起動の確認（少し待機）
      await new Promise<void>((resolve, reject) => {
        const startupTimeout = setTimeout(() => {
          if (!this.state.isRunning) {
            reject(new Error('Child process failed to start within timeout'));
          }
        }, 5000);

        // プロセスが起動したかの簡単なチェック
        setTimeout(() => {
          if (childProcess.pid && !childProcess.killed) {
            this.state.isRunning = true;
            this.state.lastRestart = new Date();
            this.state.errorCount = 0;
            clearTimeout(startupTimeout);
            resolve();
          }
        }, 1000);

        childProcess.on('error', (error) => {
          clearTimeout(startupTimeout);
          reject(error);
        });
      });

      logger.info('Target server started successfully', { pid: this.state.pid });

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
      logger.info('Stopping target server...', { pid: this.state.pid });

      // 全てのタイムアウトハンドラーをクリア
      this.timeoutHandlers.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      this.timeoutHandlers.clear();

      if (this.state.childProcess) {
        // 子プロセスの終了を待機
        const gracefulShutdown = new Promise<void>((resolve) => {
          const killTimeout = setTimeout(() => {
            if (this.state.childProcess && !this.state.childProcess.killed) {
              logger.warn('Force killing child process', { pid: this.state.pid });
              this.state.childProcess.kill('SIGKILL');
            }
            resolve();
          }, 5000);

          if (this.state.childProcess) {
            this.state.childProcess.on('close', () => {
              clearTimeout(killTimeout);
              resolve();
            });
          } else {
            clearTimeout(killTimeout);
            resolve();
          }

          // SIGTERM で優雅な終了を試行
          if (this.state.childProcess) {
            this.state.childProcess.kill('SIGTERM');
          }
        });

        await gracefulShutdown;
        this.state.childProcess = null;
        this.state.pid = undefined;
      }

      this.state.isRunning = false;

      logger.info('Target server stopped');

    } catch (error) {
      logger.error('Error stopping target server', error);
      this.state.isRunning = false;
      this.state.childProcess = null;
      this.state.pid = undefined;
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
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.startTargetServer();
    
    logger.info('Target server restarted successfully', { pid: this.state.pid });
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
   * 子プロセスに入力を送信
   */
  sendInput(input: string): void {
    if (this.state.childProcess && this.state.childProcess.stdin) {
      this.state.childProcess.stdin.write(input + '\n');
    } else {
      throw new Error('Child process is not running or stdin is not available');
    }
  }

  /**
   * 制御コマンドを処理
   */
  async handleControlCommand(command: string): Promise<any> {
    const logger = this.logManager.getLogger('wrapper');
    
    logger.debug('Handling control command', { command, pid: this.state.pid });

    // 基本的な制御コマンド
    switch (command) {
      case 'restart':
      case 'restart:graceful':
        await this.restartTargetServer();
        return { 
          status: 'restarted', 
          timestamp: new Date(),
          pid: this.state.pid
        };

      case 'stop':
        await this.stopTargetServer();
        return { 
          status: 'stopped', 
          timestamp: new Date()
        };

      case 'start':
        await this.startTargetServer();
        return { 
          status: 'started', 
          timestamp: new Date(),
          pid: this.state.pid
        };

      case 'status':
        return this.getServerState();

      case 'reload':
        // 子プロセスの場合は再起動と同じ
        await this.restartTargetServer();
        return { 
          status: 'reloaded', 
          timestamp: new Date(),
          pid: this.state.pid
        };

      default:
        // その他のコマンドは制御ハンドラーに委譲
        if (this.controlHandler) {
          const controlCommand = { command, args: [], rawInput: command };
          return await this.controlHandler.handleCommand(controlCommand);
        }
        throw new Error(`Unknown control command: ${command}`);
    }
  }

  /**
   * クリーンアップ
   */
  async shutdown(): Promise<void> {
    const logger = this.logManager.getLogger('wrapper');
    
    logger.info('Shutting down TargetServerWrapper...', { pid: this.state.pid });

    try {
      // 全てのタイムアウトハンドラーをクリア
      this.timeoutHandlers.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      this.timeoutHandlers.clear();

      await this.stopTargetServer();
      this.outputManager.shutdown();
      
      logger.info('TargetServerWrapper shutdown completed');
    } catch (error) {
      logger.error('Error during wrapper shutdown', error);
    }
  }
}