/**
 * Process Manager
 * 子プロセスのライフサイクル管理
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface ProcessManagerOptions {
  serverPath: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  timeout?: number;
}

export interface IProcessManager extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  sendInput(data: string): void;
  isRunning(): boolean;
  getPid(): number | undefined;
}

export class ProcessManager extends EventEmitter implements IProcessManager {
  private childProcess?: ChildProcess;
  private isStarting = false;
  private isStopping = false;
  private startupTimeout?: NodeJS.Timeout;
  
  constructor(private options: ProcessManagerOptions) {
    super();
  }

  /**
   * 子プロセスを起動
   */
  async start(): Promise<void> {
    if (this.childProcess && !this.childProcess.killed) {
      throw new Error('Process is already running');
    }
    
    if (this.isStarting) {
      throw new Error('Process is already starting');
    }
    
    this.isStarting = true;
    
    try {
      return await this.doStart();
    } finally {
      this.isStarting = false;
    }
  }

  private async doStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 子プロセスを起動
      const args = this.options.args || [];
      this.childProcess = spawn('node', [this.options.serverPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, ...this.options.env },
        cwd: this.options.cwd
      });

      // エラーハンドリング
      this.childProcess.on('error', (error) => {
        this.emit('error', error);
        if (this.isStarting) {
          reject(error);
        }
      });

      // 標準出力の処理
      if (this.childProcess.stdout) {
        this.childProcess.stdout.on('data', (data) => {
          this.emit('stdout', data.toString());
        });
      }

      // 標準エラー出力の処理
      if (this.childProcess.stderr) {
        this.childProcess.stderr.on('data', (data) => {
          this.emit('stderr', data.toString());
        });
      }

      // プロセス終了の処理
      this.childProcess.on('close', (code, signal) => {
        this.emit('close', code, signal);
        this.childProcess = undefined;
      });

      this.childProcess.on('exit', (code, signal) => {
        this.emit('exit', code, signal);
      });

      // スタートアップタイムアウト
      if (this.options.timeout) {
        this.startupTimeout = setTimeout(() => {
          if (this.isStarting) {
            this.stop().catch(() => {});
            reject(new Error(`Process startup timeout after ${this.options.timeout}ms`));
          }
        }, this.options.timeout);
      }

      // プロセスが起動したことを確認
      // 本来はMCP初期化完了を待つべきだが、ここでは簡易的にプロセス起動を確認
      const checkInterval = setInterval(() => {
        if (this.childProcess && this.childProcess.pid && !this.childProcess.killed) {
          clearInterval(checkInterval);
          if (this.startupTimeout) {
            clearTimeout(this.startupTimeout);
            this.startupTimeout = undefined;
          }
          this.emit('start');
          resolve();
        }
      }, 100);

      // タイムアウトまたはエラーでインターバルをクリア
      const cleanup = () => {
        clearInterval(checkInterval);
        if (this.startupTimeout) {
          clearTimeout(this.startupTimeout);
          this.startupTimeout = undefined;
        }
      };

      this.childProcess.once('error', cleanup);
      this.childProcess.once('exit', cleanup);
    });
  }

  /**
   * 子プロセスを停止
   */
  async stop(): Promise<void> {
    if (!this.childProcess) {
      return;
    }
    
    if (this.isStopping) {
      return;
    }
    
    this.isStopping = true;
    
    try {
      await this.doStop();
    } finally {
      this.isStopping = false;
    }
  }

  private async doStop(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!this.childProcess) {
        resolve();
        return;
      }

      const proc = this.childProcess;
      
      // 終了待機タイムアウト
      const killTimeout = setTimeout(() => {
        if (proc && !proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);

      // プロセス終了を待機
      proc.once('close', () => {
        clearTimeout(killTimeout);
        this.childProcess = undefined;
        resolve();
      });

      // SIGTERMで優雅な終了を試行
      proc.kill('SIGTERM');
    });
  }

  /**
   * 子プロセスを再起動
   */
  async restart(): Promise<void> {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000)); // 少し待機
    await this.start();
  }

  /**
   * 子プロセスに入力を送信
   */
  sendInput(data: string): void {
    if (!this.childProcess || !this.childProcess.stdin) {
      throw new Error('Process is not running or stdin is not available');
    }
    
    this.childProcess.stdin.write(data);
  }

  /**
   * プロセスが実行中か確認
   */
  isRunning(): boolean {
    return !!(this.childProcess && !this.childProcess.killed);
  }

  /**
   * プロセスIDを取得
   */
  getPid(): number | undefined {
    return this.childProcess?.pid;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    if (this.startupTimeout) {
      clearTimeout(this.startupTimeout);
      this.startupTimeout = undefined;
    }
    
    await this.stop();
    this.removeAllListeners();
  }
}