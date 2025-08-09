/**
 * MCP Debug Logger Types
 * ログシステム関連の型定義
 */

// ログレベル
export type LogLevel = 'quiet' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';

// ログエントリ
export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  args?: unknown[];
  formatted: string;
  source?: string; // ログの発生源（mcp, control, app等）
  context?: LogContext;
}

// ログコンテキスト（追加メタデータ）
export interface LogContext {
  requestId?: string;
  operatorId?: string;
  sessionId?: string;
  userId?: string;
  component?: string;
  [key: string]: any;
}

// ログ設定
export interface LoggerConfig {
  level: LogLevel;
  accumulateLevel: LogLevel;
  isMcpMode: boolean;
  prefix?: string;
  accumulate: boolean;
  maxEntries: number;
  enableStreaming: boolean;
  streamingConfig?: StreamingConfig;
  outputChannels: OutputChannelConfig[];
}

// ストリーミング設定
export interface StreamingConfig {
  bufferSize: number;
  flushInterval: number; // ms
  maxRate: number; // entries per second
  filters: LogFilter[];
}

// ログフィルター
export interface LogFilter {
  level?: LogLevel[];
  source?: string[];
  search?: string;
  context?: Partial<LogContext>;
  since?: Date;
  until?: Date;
}

// 出力チャネル設定
export interface OutputChannelConfig {
  name: string;
  type: 'console' | 'file' | 'stream' | 'callback';
  level: LogLevel;
  format: 'json' | 'text' | 'structured';
  filter?: LogFilter;
  options?: {
    filePath?: string;
    maxFileSize?: number;
    rotationCount?: number;
    callback?: (entry: LogEntry) => void;
  };
}

// ログ取得オプション
export interface LogQueryOptions {
  level?: LogLevel | LogLevel[];
  source?: string | string[];
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
  search?: string;
  context?: Partial<LogContext>;
  sortOrder?: 'asc' | 'desc';
}

// ログ統計情報
export interface LogStats {
  totalEntries: number;
  entriesByLevel: Record<LogLevel, number>;
  entriesBySource: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
  memoryUsage: {
    estimatedSize: number; // bytes
    maxSize: number;
    utilizationPercent: number;
  };
  streaming: {
    isActive: boolean;
    activeStreams: number;
    totalStreamed: number;
    droppedEntries: number;
  };
}

// ログストリーム
export interface LogStream {
  id: string;
  filter: LogFilter;
  callback: (entry: LogEntry) => void;
  isActive: boolean;
  created: Date;
  stats: {
    entriesDelivered: number;
    entriesDropped: number;
    lastDelivery?: Date;
  };
}

// ログアーカイブ設定
export interface ArchiveConfig {
  enabled: boolean;
  retentionDays: number;
  compressionLevel: number;
  archivePath: string;
  maxArchiveSize: number; // bytes
}

// ログ蓄積器のインターフェース
export interface LogAccumulator {
  addEntry(entry: LogEntry): void;
  getEntries(options?: LogQueryOptions): LogEntry[];
  clearEntries(): void;
  getStats(): LogStats;
  createStream(filter: LogFilter, callback: (entry: LogEntry) => void): string;
  destroyStream(streamId: string): boolean;
  archive(options?: ArchiveConfig): Promise<void>;
  search(query: string, options?: LogQueryOptions): LogEntry[];
  export(format: 'json' | 'csv' | 'txt', options?: LogQueryOptions): string;
  getMaxEntries(): number;
  setMaxEntries(maxEntries: number): void;
}

// ログマネージャーのインターフェース
export interface LogManager {
  getLogger(name?: string): Logger;
  configure(config: Partial<LoggerConfig>): void;
  getAccumulator(): LogAccumulator;
  getStats(): LogStats;
  createLogStream(filter: LogFilter): LogStream;
  destroyLogStream(streamId: string): boolean;
  enableDebugMode(): void;
  disableDebugMode(): void;
  shutdown(): Promise<void>;
}

// 拡張ログ機能のインターフェース
export interface Logger {
  // 基本ログメソッド
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  verbose(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  
  // コンテキスト付きログ
  withContext(context: LogContext): Logger;
  
  // レベル制御
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  
  // 蓄積制御
  enableAccumulation(maxEntries?: number): void;
  disableAccumulation(): void;
  isAccumulating(): boolean;
  
  // ログ取得
  getLogEntries(options?: LogQueryOptions): LogEntry[];
  clearLogEntries(): void;
  getLogStats(): LogStats;
  
  // ストリーミング
  createStream(filter: LogFilter, callback: (entry: LogEntry) => void): string;
  destroyStream(streamId: string): boolean;
  
  // 設定
  configure(config: Partial<LoggerConfig>): void;
  setPrefix(prefix: string): void;
}

// ログイベント
export type LogEvent = 
  | { type: 'entry-added'; entry: LogEntry }
  | { type: 'entries-cleared'; count: number }
  | { type: 'stream-created'; streamId: string }
  | { type: 'stream-destroyed'; streamId: string }
  | { type: 'config-changed'; config: LoggerConfig }
  | { type: 'level-changed'; oldLevel: LogLevel; newLevel: LogLevel };

// ログイベントリスナー
export type LogEventListener = (event: LogEvent) => void;