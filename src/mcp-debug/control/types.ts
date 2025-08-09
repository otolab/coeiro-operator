/**
 * MCP Debug Control System Types
 * 制御システム関連の型定義
 */

// 制御コマンドの基本形式
export interface ControlCommand {
  command: string;
  args?: string[];
  rawInput: string;
}

// 制御応答の形式
export interface ControlResponse {
  command: string;
  status: 'ok' | 'error' | 'partial' | 'success';
  data?: any;
  message?: string;
  timestamp: string;
}

// サーバーの動作モード
export type ServerMode = 'production' | 'debug' | 'test';

// サーバー状況情報
export interface ServerStatus {
  mode: ServerMode;
  uptime: number;
  startTime: string;
  processId: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  mcpStats: {
    totalRequests: number;
    errorCount: number;
    lastRequest: string | null;
  };
  logStats: {
    totalEntries: number;
    entriesByLevel: Record<string, number>;
    oldestEntry: string | null;
    newestEntry: string | null;
  };
}

// ヘルスチェック結果
export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    [component: string]: {
      status: 'pass' | 'fail' | 'warn';
      message?: string;
      latency?: number;
    };
  };
  uptime: number;
  lastCheck: string;
}

// 再起動オプション
export interface RestartOptions {
  type: 'graceful' | 'force';
  timeout?: number; // gracefulの場合のタイムアウト（ms）
  preserveLogs?: boolean;
}

// ログ操作のオプション
export interface LogOptions {
  action: 'get' | 'clear' | 'stream' | 'stats';
  level?: string[];
  since?: string;
  limit?: number;
  search?: string;
  format?: 'formatted' | 'raw';
  streamOptions?: {
    enable: boolean;
    filter?: {
      level?: string[];
      search?: string;
    };
  };
}

// 制御ハンドラーのインターフェース
export interface ControlHandler {
  handleCommand(command: ControlCommand): Promise<ControlResponse>;
  getStatus(): Promise<ServerStatus>;
  restart(options: RestartOptions): Promise<ControlResponse>;
  setMode(mode: ServerMode): Promise<ControlResponse>;
  healthCheck(): Promise<HealthCheck>;
  handleLogs(options: LogOptions): Promise<ControlResponse>;
}

// 制御システムの設定
export interface ControlConfig {
  enableGracefulRestart: boolean;
  gracefulTimeout: number;
  healthCheckInterval: number;
  maxLogStreamRate: number; // ログストリーミング時の最大レート（entries/sec）
  debugMode: {
    enableDetailedLogging: boolean;
    enablePerformanceMetrics: boolean;
    enableMemoryMonitoring: boolean;
  };
}

// エラーコード定義
export enum ControlErrorCode {
  INVALID_COMMAND = 'INVALID_COMMAND',
  INVALID_ARGS = 'INVALID_ARGS',
  OPERATION_FAILED = 'OPERATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  RESOURCE_UNAVAILABLE = 'RESOURCE_UNAVAILABLE'
}

// 制御エラー
export interface ControlError {
  code: ControlErrorCode;
  message: string;
  details?: any;
  timestamp: string;
}