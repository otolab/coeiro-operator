/**
 * Enhanced Logger Implementation
 * 拡張ロガーシステムの実装
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Logger, 
  LogLevel, 
  LogEntry, 
  LoggerConfig, 
  LogContext, 
  LogQueryOptions, 
  LogStats, 
  LogFilter,
  LogManager,
  LogAccumulator,
  LogStream
} from './types.js';
import { DebugLogAccumulator } from './accumulator.js';

class DebugLogger implements Logger {
  private config: LoggerConfig;
  private accumulator: LogAccumulator;
  private context: LogContext = {};

  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    quiet: 0, error: 1, warn: 2, info: 3, verbose: 4, debug: 5
  };

  constructor(config: Partial<LoggerConfig> = {}, accumulator?: LogAccumulator) {
    this.config = {
      level: 'info',
      accumulateLevel: 'debug',
      isMcpMode: false,
      prefix: '',
      accumulate: false,
      maxEntries: 1000,
      enableStreaming: false,
      outputChannels: [],
      ...config
    };

    this.accumulator = accumulator || new DebugLogAccumulator(this.config.maxEntries);
  }

  // 基本ログメソッド
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  verbose(message: string, ...args: unknown[]): void {
    this.log('verbose', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    const shouldOutput = this.shouldLog(level);
    const shouldAccumulate = this.config.accumulate && this.shouldLogAtLevel(level, this.config.accumulateLevel);

    if (!shouldOutput && !shouldAccumulate) {
      return;
    }

    const entry = this.createLogEntry(level, message, args);

    // 蓄積
    if (shouldAccumulate) {
      this.accumulator.addEntry(entry);
    }

    // 出力
    if (shouldOutput) {
      this.outputLog(entry);
    }
  }

  private createLogEntry(level: LogLevel, message: string, args: unknown[]): LogEntry {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : '';
    
    const formatted = `${timestamp} ${level.toUpperCase()} ${prefix}${message}${formattedArgs}`;

    return {
      id: uuidv4(),
      timestamp,
      level,
      message,
      args: args.length > 0 ? args : undefined,
      formatted,
      source: this.config.prefix || 'app',
      context: Object.keys(this.context).length > 0 ? { ...this.context } : undefined
    };
  }

  private outputLog(entry: LogEntry): void {
    if (this.config.isMcpMode) {
      // MCPモード時はエラーのみstderrに出力
      if (entry.level === 'error') {
        console.error(entry.formatted);
      }
      return;
    }

    // 通常モード時の出力先振り分け
    switch (entry.level) {
      case 'error':
        console.error(entry.formatted);
        break;
      case 'warn':
        console.warn(entry.formatted);
        break;
      default:
        console.log(entry.formatted);
        break;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] <= this.LOG_LEVELS[this.config.level];
  }

  private shouldLogAtLevel(level: LogLevel, targetLevel: LogLevel): boolean {
    return this.LOG_LEVELS[level] <= this.LOG_LEVELS[targetLevel];
  }

  // コンテキスト付きログ
  withContext(context: LogContext): Logger {
    const newLogger = new DebugLogger(this.config, this.accumulator);
    newLogger.context = { ...this.context, ...context };
    return newLogger;
  }

  // レベル制御
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  // 蓄積制御
  enableAccumulation(maxEntries: number = 1000): void {
    this.config.accumulate = true;
    this.config.maxEntries = maxEntries;
    if (this.accumulator instanceof DebugLogAccumulator) {
      this.accumulator.setMaxEntries(maxEntries);
    }
  }

  disableAccumulation(): void {
    this.config.accumulate = false;
  }

  isAccumulating(): boolean {
    return this.config.accumulate;
  }

  // ログ取得
  getLogEntries(options?: LogQueryOptions): LogEntry[] {
    return this.accumulator.getEntries(options);
  }

  clearLogEntries(): void {
    this.accumulator.clearEntries();
  }

  getLogStats(): LogStats {
    return this.accumulator.getStats();
  }

  // ストリーミング
  createStream(filter: LogFilter, callback: (entry: LogEntry) => void): string {
    return this.accumulator.createStream(filter, callback);
  }

  destroyStream(streamId: string): boolean {
    return this.accumulator.destroyStream(streamId);
  }

  // 設定
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  // アクセサ
  getAccumulator(): LogAccumulator {
    return this.accumulator;
  }
}

// シングルトンロガーマネージャー
class DebugLogManager implements LogManager {
  private static instance: DebugLogManager;
  private loggers: Map<string, DebugLogger> = new Map();
  private globalAccumulator: LogAccumulator;
  private globalConfig: LoggerConfig;

  private constructor() {
    this.globalConfig = {
      level: 'info',
      accumulateLevel: 'debug',
      isMcpMode: false,
      accumulate: false,
      maxEntries: 1000,
      enableStreaming: false,
      outputChannels: []
    };
    this.globalAccumulator = new DebugLogAccumulator(this.globalConfig.maxEntries);
  }

  static getInstance(): DebugLogManager {
    if (!DebugLogManager.instance) {
      DebugLogManager.instance = new DebugLogManager();
    }
    return DebugLogManager.instance;
  }

  getLogger(name: string = 'default'): DebugLogger {
    if (!this.loggers.has(name)) {
      const config = { ...this.globalConfig, prefix: name !== 'default' ? name : '' };
      const logger = new DebugLogger(config, this.globalAccumulator);
      this.loggers.set(name, logger);
    }
    return this.loggers.get(name)!;
  }

  configure(config: Partial<LoggerConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    
    // 既存のロガーに設定を適用
    for (const logger of this.loggers.values()) {
      logger.configure(config);
    }
  }

  getAccumulator(): LogAccumulator {
    return this.globalAccumulator;
  }

  getStats(): LogStats {
    return this.globalAccumulator.getStats();
  }

  createLogStream(filter: LogFilter): LogStream {
    const streamId = this.globalAccumulator.createStream(filter, () => {});
    // 実際のストリーム情報を取得するためのヘルパー
    if (this.globalAccumulator instanceof DebugLogAccumulator) {
      const stream = this.globalAccumulator._getStreams().get(streamId);
      if (stream) return stream;
    }
    throw new Error(`Failed to create stream ${streamId}`);
  }

  destroyLogStream(streamId: string): boolean {
    return this.globalAccumulator.destroyStream(streamId);
  }

  enableDebugMode(): void {
    this.configure({
      level: 'debug',
      accumulateLevel: 'debug',
      accumulate: true,
      enableStreaming: true
    });
  }

  disableDebugMode(): void {
    this.configure({
      level: 'info',
      enableStreaming: false
    });
  }

  async shutdown(): Promise<void> {
    // ストリームを停止
    if (this.globalAccumulator instanceof DebugLogAccumulator) {
      const streams = this.globalAccumulator._getStreams();
      for (const streamId of streams.keys()) {
        this.globalAccumulator.destroyStream(streamId);
      }
    }
    
    // ロガーをクリア
    this.loggers.clear();
  }
}

// 互換性のための関数
export function configureLogger(config: Partial<LoggerConfig>): void {
  DebugLogManager.getInstance().configure(config);
}

export function getLogger(name?: string): DebugLogger {
  return DebugLogManager.getInstance().getLogger(name);
}

// デフォルトエクスポート
const logger = DebugLogManager.getInstance().getLogger();

// プリセット（既存互換性のため）
export const LoggerPresets = {
  mcpServer: (): void => {
    configureLogger({
      level: 'error',
      accumulateLevel: 'error',
      isMcpMode: true,
      prefix: 'MCP',
      accumulate: false
    });
  },

  mcpServerWithAccumulation: (): void => {
    configureLogger({
      level: 'error',
      accumulateLevel: 'debug',
      isMcpMode: true,
      prefix: 'MCP',
      accumulate: true,
      maxEntries: 2000
    });
  },

  cli: (): void => {
    configureLogger({
      level: 'info',
      accumulateLevel: 'info',
      isMcpMode: false,
      prefix: 'CLI',
      accumulate: false
    });
  },

  debug: (): void => {
    configureLogger({
      level: 'debug',
      accumulateLevel: 'debug',
      isMcpMode: false,
      prefix: 'DEBUG',
      accumulate: true,
      maxEntries: 3000
    });
  },

  quiet: (): void => {
    configureLogger({
      level: 'quiet',
      accumulateLevel: 'quiet',
      isMcpMode: true,
      accumulate: false
    });
  }
};

export default logger;
export { DebugLogger, DebugLogManager, DebugLogAccumulator };
export * from './types.js';