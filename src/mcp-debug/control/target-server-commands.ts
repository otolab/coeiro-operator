/**
 * Target Server Control Commands
 * テスト対象サーバー専用の制御コマンド実装
 */

import { ControlResponse, ServerStatus, HealthCheck } from './types.js';
import { DebugLogManager } from '../logger/index.js';
import type { TargetServerWrapper } from '../wrapper/target-server-wrapper.js';
import type { ModuleReloader } from '../wrapper/module-reloader.js';

export interface TargetServerControlOptions {
  wrapper: TargetServerWrapper;
  reloader?: ModuleReloader;
}

export interface TargetServerStatus extends ServerStatus {
  targetServer: {
    path: string;
    isRunning: boolean;
    lastRestart: Date | null;
    uptime: number;
    errorCount: number;
    processInfo: {
      pid: number | null;
      childProcess: string;
    };
  };
  reloader?: {
    isWatching: boolean;
    watchedPaths: string[];
    autoReload: boolean;
    reloadCounts: { [path: string]: number };
  };
}

export class TargetServerCommands {
  private wrapper: TargetServerWrapper;
  private reloader?: ModuleReloader;
  private logManager: DebugLogManager;
  private logger: ReturnType<DebugLogManager['getLogger']>;
  private startTime: Date = new Date();

  constructor(options: TargetServerControlOptions) {
    this.wrapper = options.wrapper;
    this.reloader = options.reloader;
    this.logManager = DebugLogManager.getInstance();
    this.logger = this.logManager.getLogger('target-control');
    
    this.logger.info('TargetServerCommands initialized');
  }

  /**
   * ターゲットサーバーの詳細ステータスを取得
   */
  async getTargetStatus(): Promise<ControlResponse> {
    try {
      const wrapperState = this.wrapper.getServerState();
      const reloaderStats = this.reloader?.getStats();
      const logStats = this.logManager.getAccumulator().getStats();

      const targetStatus: TargetServerStatus = {
        mode: 'debug', // デバッグモード固定
        uptime: Date.now() - this.startTime.getTime(),
        startTime: this.startTime.toISOString(),
        processId: process.pid,
        memoryUsage: process.memoryUsage(),
        mcpStats: {
          totalRequests: 0, // ラッパー経由では計測困難
          errorCount: wrapperState.errorCount,
          lastRequest: null
        },
        logStats: {
          totalEntries: logStats.totalEntries,
          entriesByLevel: logStats.entriesByLevel,
          oldestEntry: logStats.oldestEntry || null,
          newestEntry: logStats.newestEntry || null
        },
        targetServer: {
          path: (this.wrapper as any).options?.serverPath || 'unknown',
          isRunning: wrapperState.isRunning,
          lastRestart: wrapperState.lastRestart,
          uptime: wrapperState.uptime,
          errorCount: wrapperState.errorCount,
          processInfo: {
            pid: wrapperState.pid || null,
            childProcess: wrapperState.childProcess ? 'running' : 'stopped'
          }
        },
        reloader: reloaderStats ? {
          isWatching: reloaderStats.watchedPaths.length > 0,
          watchedPaths: reloaderStats.watchedPaths,
          autoReload: true, // TODO: reloaderから取得
          reloadCounts: reloaderStats.reloadCounts
        } : undefined
      };

      return {
        command: 'target:status',
        status: 'success',
        message: 'Target server status retrieved',
        data: targetStatus,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to get target status', error);
      return {
        command: 'target:status',
        status: 'error',
        message: `Failed to get target status: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーを起動
   */
  async startTarget(): Promise<ControlResponse> {
    try {
      this.logger.info('Starting target server');
      await this.wrapper.startTargetServer();

      return {
        command: 'target:start',
        status: 'success',
        message: 'Target server started successfully',
        data: { startTime: new Date() },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to start target server', error);
      return {
        command: 'target:start',
        status: 'error',
        message: `Failed to start target server: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーを停止
   */
  async stopTarget(): Promise<ControlResponse> {
    try {
      this.logger.info('Stopping target server');
      await this.wrapper.stopTargetServer();

      return {
        command: 'target:stop',
        status: 'success',
        message: 'Target server stopped successfully',
        data: { stopTime: new Date() },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to stop target server', error);
      return {
        command: 'target:stop',
        status: 'error',
        message: `Failed to stop target server: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーを再起動
   */
  async restartTarget(): Promise<ControlResponse> {
    try {
      this.logger.info('Restarting target server');
      await this.wrapper.restartTargetServer();

      return {
        command: 'target:restart',
        status: 'success',
        message: 'Target server restarted successfully',
        data: { restartTime: new Date() },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to restart target server', error);
      return {
        command: 'target:restart',
        status: 'error',
        message: `Failed to restart target server: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーのモジュールを再読み込み
   */
  async reloadTarget(modulePath?: string): Promise<ControlResponse> {
    try {
      if (!this.reloader) {
        throw new Error('Module reloader not available');
      }

      this.logger.info('Reloading target server module', { modulePath });

      let reloadedModule: any;
      if (modulePath) {
        reloadedModule = await this.reloader.reloadModule(modulePath);
      } else {
        // デフォルトではラッパーのサーバーパスを再読み込み
        const serverPath = (this.wrapper as any).options?.serverPath;
        if (!serverPath) {
          throw new Error('No server path available for reload');
        }
        reloadedModule = await this.reloader.reloadModule(serverPath);
      }

      // サーバーを再起動して新しいモジュールを適用
      await this.wrapper.restartTargetServer();

      return {
        command: 'target:reload',
        status: 'success',
        message: 'Target server module reloaded and restarted',
        data: { 
          reloadTime: new Date(),
          modulePath: modulePath || 'default',
          exports: Object.keys(reloadedModule || {})
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to reload target server', error);
      return {
        command: 'target:reload',
        status: 'error',
        message: `Failed to reload target server: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ファイル監視を開始
   */
  async startWatching(targetPath?: string): Promise<ControlResponse> {
    try {
      if (!this.reloader) {
        throw new Error('Module reloader not available');
      }

      const watchPath = targetPath || (this.wrapper as any).options?.serverPath || process.cwd();
      
      this.logger.info('Starting file watching', { watchPath });
      await this.reloader.startWatching(watchPath);

      return {
        command: 'target:watch:start',
        status: 'success',
        message: 'File watching started',
        data: { watchPath, startTime: new Date() },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to start watching', error);
      return {
        command: 'target:watch:start',
        status: 'error',
        message: `Failed to start watching: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ファイル監視を停止
   */
  async stopWatching(): Promise<ControlResponse> {
    try {
      if (!this.reloader) {
        throw new Error('Module reloader not available');
      }

      this.logger.info('Stopping file watching');
      await this.reloader.stopWatching();

      return {
        command: 'target:watch:stop',
        status: 'success',
        message: 'File watching stopped',
        data: { stopTime: new Date() },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to stop watching', error);
      return {
        command: 'target:watch:stop',
        status: 'error',
        message: `Failed to stop watching: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーのヘルスチェック
   */
  async healthCheckTarget(): Promise<ControlResponse> {
    try {
      const state = this.wrapper.getServerState();
      const isHealthy = state.isRunning && state.errorCount < 5;

      const healthData: HealthCheck = {
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks: {
          serverRunning: {
            status: state.isRunning ? 'pass' : 'fail',
            message: state.isRunning ? 'Server is running' : 'Server is not running'
          },
          lowErrorCount: {
            status: state.errorCount < 5 ? 'pass' : 'warn',
            message: `Error count: ${state.errorCount}`
          },
          recentStart: {
            status: state.lastRestart ? (Date.now() - state.lastRestart.getTime()) < 300000 ? 'pass' : 'warn' : 'warn',
            message: state.lastRestart ? `Started: ${state.lastRestart.toISOString()}` : 'No start time recorded'
          }
        },
        uptime: state.uptime,
        lastCheck: new Date().toISOString()
      };

      return {
        command: 'target:health',
        status: 'success',
        message: `Target server is ${healthData.status}`,
        data: healthData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to check target health', error);
      return {
        command: 'target:health',
        status: 'error',
        message: `Failed to check target health: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * ターゲットサーバーにカスタムコマンドを送信
   */
  async sendCommand(command: string, args: string[] = []): Promise<ControlResponse> {
    try {
      this.logger.info('Sending custom command to target server', { command, args });

      // ラッパー経由でカスタムコマンドを実行
      const result = await this.wrapper.handleControlCommand(`${command}:${args.join(':')}`);

      return {
        command: `target:send:${command}`,
        status: 'success',
        message: 'Custom command executed',
        data: result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send custom command', error);
      return {
        command: `target:send:${command}`,
        status: 'error',
        message: `Failed to send command: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 利用可能なターゲット制御コマンドのヘルプ
   */
  getTargetHelp(): string {
    return `
Target Server Control Commands:

CTRL:target:status
  - Get detailed target server status

CTRL:target:start
  - Start the target server

CTRL:target:stop
  - Stop the target server

CTRL:target:restart
  - Restart the target server

CTRL:target:reload[:module-path]
  - Reload target server module and restart
  - Optional: specify module path

CTRL:target:watch:start[:path]
  - Start file watching for auto-reload
  - Optional: specify watch path

CTRL:target:watch:stop
  - Stop file watching

CTRL:target:health
  - Perform target server health check

CTRL:target:send:command[:arg1:arg2...]
  - Send custom command to target server

Examples:
  CTRL:target:status
  CTRL:target:restart
  CTRL:target:reload:./src/my-module.js
  CTRL:target:watch:start:./src
  CTRL:target:send:test:param1:param2
    `.trim();
  }
}