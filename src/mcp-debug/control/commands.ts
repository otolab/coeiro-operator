/**
 * Control Commands Implementation
 * 制御コマンドの実装
 */

import { 
  ControlCommand, 
  ControlResponse, 
  ServerStatus, 
  HealthCheck, 
  RestartOptions, 
  LogOptions,
  ServerMode,
  ControlErrorCode 
} from './types.js';
import { DebugLogManager } from '../logger/index.js';

export class ControlCommands {
  private startTime: Date;
  private totalRequests: number = 0;
  private errorCount: number = 0;
  private lastRequest: Date | null = null;
  private currentMode: ServerMode = 'production';
  private logManager: DebugLogManager;

  constructor() {
    this.startTime = new Date();
    this.logManager = DebugLogManager.getInstance();
  }

  incrementRequestCount(): void {
    this.totalRequests++;
    this.lastRequest = new Date();
  }

  incrementErrorCount(): void {
    this.errorCount++;
  }

  async getStatus(): Promise<ControlResponse> {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime.getTime();
    const logStats = this.logManager.getStats();

    const status: ServerStatus = {
      mode: this.currentMode,
      uptime,
      startTime: this.startTime.toISOString(),
      processId: process.pid,
      memoryUsage: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      },
      mcpStats: {
        totalRequests: this.totalRequests,
        errorCount: this.errorCount,
        lastRequest: this.lastRequest?.toISOString() || null
      },
      logStats: {
        totalEntries: logStats.totalEntries,
        entriesByLevel: logStats.entriesByLevel,
        oldestEntry: logStats.oldestEntry || null,
        newestEntry: logStats.newestEntry || null
      }
    };

    return {
      command: 'status',
      status: 'ok',
      data: status,
      timestamp: new Date().toISOString()
    };
  }

  async restart(options: RestartOptions): Promise<ControlResponse> {
    const logger = this.logManager.getLogger('control');
    
    try {
      logger.info(`Restart requested: ${options.type}`, options);

      if (options.type === 'graceful') {
        // Graceful restart simulation
        logger.info('Performing graceful restart...');
        
        // ログ保持の確認
        if (options.preserveLogs !== false) {
          logger.info('Preserving log entries');
        } else {
          this.logManager.getAccumulator().clearEntries();
          logger.info('Log entries cleared');
        }

        // 統計情報のリセット
        this.totalRequests = 0;
        this.errorCount = 0;
        this.lastRequest = null;
        this.startTime = new Date();

        logger.info('Graceful restart completed');
        
        return {
          command: 'restart',
          status: 'ok',
          message: 'Graceful restart completed successfully',
          timestamp: new Date().toISOString()
        };
      } else {
        // Force restart - この実装では実際にプロセス終了はしない
        logger.warn('Force restart simulated (would exit process in production)');
        
        return {
          command: 'restart',
          status: 'partial',
          message: 'Force restart simulated (process would exit in production)',
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      logger.error('Restart failed', error);
      return {
        command: 'restart',
        status: 'error',
        message: `Restart failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async setMode(mode: ServerMode): Promise<ControlResponse> {
    const logger = this.logManager.getLogger('control');
    const oldMode = this.currentMode;
    
    try {
      this.currentMode = mode;
      logger.info(`Mode changed from ${oldMode} to ${mode}`);

      // モードに応じた設定変更
      switch (mode) {
        case 'debug':
          this.logManager.enableDebugMode();
          break;
        case 'production':
          this.logManager.disableDebugMode();
          break;
        case 'test':
          this.logManager.configure({
            level: 'verbose',
            accumulate: true,
            maxEntries: 5000
          });
          break;
      }

      return {
        command: 'mode',
        status: 'ok',
        data: { oldMode, newMode: mode },
        message: `Mode changed to ${mode}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.currentMode = oldMode; // ロールバック
      logger.error('Mode change failed', error);
      return {
        command: 'mode',
        status: 'error',
        message: `Mode change failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async healthCheck(): Promise<ControlResponse> {
    const logger = this.logManager.getLogger('control');
    const checks: HealthCheck['checks'] = {};
    let overallStatus: HealthCheck['status'] = 'healthy';

    try {
      // メモリチェック
      const memUsage = process.memoryUsage();
      const memUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      if (memUsagePercent > 90) {
        checks.memory = { status: 'fail', message: `High memory usage: ${memUsagePercent.toFixed(1)}%` };
        overallStatus = 'unhealthy';
      } else if (memUsagePercent > 75) {
        checks.memory = { status: 'warn', message: `Moderate memory usage: ${memUsagePercent.toFixed(1)}%` };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.memory = { status: 'pass', message: `Memory usage: ${memUsagePercent.toFixed(1)}%` };
      }

      // ログ蓄積チェック
      const logStats = this.logManager.getStats();
      const logUtilization = logStats.memoryUsage.utilizationPercent;
      
      if (logUtilization > 95) {
        checks.logs = { status: 'fail', message: `Log buffer nearly full: ${logUtilization.toFixed(1)}%` };
        overallStatus = 'unhealthy';
      } else if (logUtilization > 80) {
        checks.logs = { status: 'warn', message: `Log buffer high: ${logUtilization.toFixed(1)}%` };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.logs = { status: 'pass', message: `Log buffer usage: ${logUtilization.toFixed(1)}%` };
      }

      // エラーレートチェック
      const errorRate = this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0;
      
      if (errorRate > 10) {
        checks.errorRate = { status: 'fail', message: `High error rate: ${errorRate.toFixed(1)}%` };
        overallStatus = 'unhealthy';
      } else if (errorRate > 5) {
        checks.errorRate = { status: 'warn', message: `Moderate error rate: ${errorRate.toFixed(1)}%` };
        if (overallStatus === 'healthy') overallStatus = 'degraded';
      } else {
        checks.errorRate = { status: 'pass', message: `Error rate: ${errorRate.toFixed(1)}%` };
      }

      // アップタイムチェック
      const uptime = Date.now() - this.startTime.getTime();
      const uptimeHours = uptime / (1000 * 60 * 60);
      checks.uptime = { 
        status: 'pass', 
        message: `Uptime: ${uptimeHours.toFixed(1)} hours`
      };

      const healthCheck: HealthCheck = {
        status: overallStatus,
        checks,
        uptime: Date.now() - this.startTime.getTime(),
        lastCheck: new Date().toISOString()
      };

      logger.info('Health check completed', { status: overallStatus });

      return {
        command: 'health',
        status: 'ok',
        data: healthCheck,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        command: 'health',
        status: 'error',
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  async handleLogs(options: LogOptions): Promise<ControlResponse> {
    const logger = this.logManager.getLogger('control');
    
    try {
      const accumulator = this.logManager.getAccumulator();

      switch (options.action) {
        case 'get': {
          const queryOptions = {
            level: options.level as any,
            since: options.since ? new Date(options.since) : undefined,
            limit: options.limit,
            search: options.search
          };

          const entries = accumulator.getEntries(queryOptions);
          
          let data;
          if (options.format === 'raw') {
            data = { entries, count: entries.length };
          } else {
            const formatted = entries.map((entry, index) => 
              `${index + 1}. [${entry.level.toUpperCase()}] ${entry.timestamp}\n   ${entry.message}`
            ).join('\n\n');
            data = { formatted, count: entries.length };
          }

          return {
            command: 'logs',
            status: 'ok',
            data,
            timestamp: new Date().toISOString()
          };
        }

        case 'clear': {
          const beforeCount = accumulator.getStats().totalEntries;
          accumulator.clearEntries();
          
          return {
            command: 'logs',
            status: 'ok',
            data: { clearedEntries: beforeCount },
            message: `Cleared ${beforeCount} log entries`,
            timestamp: new Date().toISOString()
          };
        }

        case 'stats': {
          const stats = accumulator.getStats();
          
          return {
            command: 'logs',
            status: 'ok',
            data: stats,
            timestamp: new Date().toISOString()
          };
        }

        case 'stream': {
          if (options.streamOptions?.enable) {
            // ストリーミング開始の実装は後続で
            return {
              command: 'logs',
              status: 'partial',
              message: 'Log streaming start requested (implementation pending)',
              timestamp: new Date().toISOString()
            };
          } else {
            return {
              command: 'logs',
              status: 'partial',
              message: 'Log streaming stop requested (implementation pending)',
              timestamp: new Date().toISOString()
            };
          }
        }

        default:
          return {
            command: 'logs',
            status: 'error',
            message: `Unknown log action: ${options.action}`,
            timestamp: new Date().toISOString()
          };
      }
    } catch (error) {
      logger.error('Log operation failed', error);
      return {
        command: 'logs',
        status: 'error',
        message: `Log operation failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  getCurrentMode(): ServerMode {
    return this.currentMode;
  }

  getStats() {
    return {
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      lastRequest: this.lastRequest,
      startTime: this.startTime,
      currentMode: this.currentMode
    };
  }
}