/**
 * src/utils/logger.ts: 簡易ログシステム
 * MCPサーバー環境でのstdout汚染を防ぐログレベル制御機能
 */

export type LogLevel = 'quiet' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  args?: any[];
  formatted: string;
}

interface LoggerConfig {
  level: LogLevel;
  accumulateLevel: LogLevel; // 蓄積するログレベル（独立制御）
  isMcpMode: boolean; // MCPサーバーモード時はstdout出力を制限
  prefix?: string; // ログプレフィックス
  accumulate: boolean; // ログ蓄積モード
  maxEntries: number; // 蓄積する最大ログエントリ数
}

class Logger {
  private config: LoggerConfig;
  private static instance: Logger;
  private logEntries: LogEntry[] = []; // ログエントリの蓄積配列

  // ログレベルの数値マッピング（小さいほど重要）
  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    quiet: 0, // 出力なし
    error: 1, // エラーのみ
    warn: 2, // 警告以上
    info: 3, // 情報以上
    verbose: 4, // 詳細情報以上
    debug: 5, // すべて（デバッグ含む）
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    // 環境変数からログレベルを取得
    const envLogLevel = process.env.COEIRO_LOG_LEVEL as LogLevel;
    const defaultLevel = envLogLevel && this.isValidLogLevel(envLogLevel) ? envLogLevel : 'info';
    
    this.config = {
      level: defaultLevel,
      accumulateLevel: 'debug', // デフォルトで全レベル蓄積
      isMcpMode: false,
      prefix: '',
      accumulate: false,
      maxEntries: 1000,
      ...config,
    };
  }
  
  private isValidLogLevel(level: string): level is LogLevel {
    return ['quiet', 'error', 'warn', 'info', 'verbose', 'debug'].includes(level);
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  static configure(config: Partial<LoggerConfig>): void {
    const instance = Logger.getInstance();
    instance.config = { ...instance.config, ...config };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.LOG_LEVELS[level] <= this.LOG_LEVELS[this.config.level];
  }

  private shouldLogAtLevel(level: LogLevel, targetLevel: LogLevel): boolean {
    return this.LOG_LEVELS[level] <= this.LOG_LEVELS[targetLevel];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    const formattedArgs =
      args.length > 0
        ? ` ${args
            .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
            .join(' ')}`
        : '';

    return `${timestamp} ${level.toUpperCase()} ${prefix}${message}${formattedArgs}`;
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    const shouldOutput = this.shouldLog(level);
    const shouldAccumulate =
      this.config.accumulate && this.shouldLogAtLevel(level, this.config.accumulateLevel);

    // 出力もせず蓄積もしない場合は早期リターン
    if (!shouldOutput && !shouldAccumulate) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);

    // ログエントリを蓄積モードで保存（蓄積レベルで独立判定）
    if (shouldAccumulate) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        args: args.length > 0 ? args : undefined,
        formatted: formattedMessage,
      };

      this.logEntries.push(logEntry);

      // 最大エントリ数を超えた場合、古いものを削除
      if (this.logEntries.length > this.config.maxEntries) {
        this.logEntries.shift();
      }
    }

    // 出力判定に基づいて実際の出力を行う
    if (shouldOutput) {
      // MCPモード時は重要なエラーのみstderrに出力、その他は抑制
      if (this.config.isMcpMode) {
        if (level === 'error') {
          console.error(formattedMessage);
        }
        // MCPモード時はerror以外は出力しない（stdout汚染防止）
        return;
      }

      // 通常モード時の出力先振り分け
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        case 'debug':
        case 'verbose':
        case 'info':
        default:
          console.error(formattedMessage); // stderrに統一してstdout汚染を防止
          break;
      }
    }
  }

  // ログレベル別メソッド
  error(message: string, ...args: any[]): void {
    this.writeLog('error', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.writeLog('warn', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.writeLog('info', message, ...args);
  }

  verbose(message: string, ...args: any[]): void {
    this.writeLog('verbose', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.writeLog('debug', message, ...args);
  }

  // verboseのエイリアスとしてlogメソッドを追加
  log(message: string, ...args: any[]): void {
    this.writeLog('verbose', message, ...args);
  }

  // 設定取得・変更
  getLevel(): LogLevel {
    return this.config.level;
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setMcpMode(enabled: boolean): void {
    this.config.isMcpMode = enabled;
  }

  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  // 蓄積モード関連メソッド
  enableAccumulation(maxEntries: number = 1000): void {
    this.config.accumulate = true;
    this.config.maxEntries = maxEntries;
  }

  disableAccumulation(): void {
    this.config.accumulate = false;
  }

  isAccumulating(): boolean {
    return this.config.accumulate;
  }

  // ログエントリ取得メソッド
  getLogEntries(
    options: {
      level?: LogLevel | LogLevel[];
      since?: Date;
      limit?: number;
      search?: string;
    } = {}
  ): LogEntry[] {
    let filtered = [...this.logEntries];

    // レベルフィルタ
    if (options.level) {
      const levels = Array.isArray(options.level) ? options.level : [options.level];
      filtered = filtered.filter(entry => levels.includes(entry.level));
    }

    // 時刻フィルタ
    if (options.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() >= sinceTime);
    }

    // 検索フィルタ
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(
        entry =>
          entry.message.toLowerCase().includes(searchLower) ||
          entry.formatted.toLowerCase().includes(searchLower)
      );
    }

    // 制限
    if (options.limit && options.limit > 0) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered;
  }

  // ログエントリクリア
  clearLogEntries(): void {
    this.logEntries = [];
  }

  // ログ統計情報
  getLogStats(): {
    totalEntries: number;
    entriesByLevel: Record<LogLevel, number>;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const stats = {
      totalEntries: this.logEntries.length,
      entriesByLevel: {
        quiet: 0,
        error: 0,
        warn: 0,
        info: 0,
        verbose: 0,
        debug: 0,
      } as Record<LogLevel, number>,
      oldestEntry: this.logEntries[0]?.timestamp,
      newestEntry: this.logEntries[this.logEntries.length - 1]?.timestamp,
    };

    this.logEntries.forEach(entry => {
      stats.entriesByLevel[entry.level]++;
    });

    return stats;
  }
}

// シングルトンインスタンスをエクスポート
export const logger = Logger.getInstance();

// 設定用ヘルパー関数
export const configureLogger = Logger.configure;

// 便利なプリセット設定
export const LoggerPresets = {
  // MCPサーバーモード：エラーのみstderrに出力
  mcpServer: (): void => {
    configureLogger({
      level: 'error',
      accumulateLevel: 'error',
      isMcpMode: true,
      prefix: 'MCP',
      accumulate: false,
    });
  },

  // MCPサーバーモード（蓄積あり）：エラーのみstderrに出力、info以上を蓄積
  mcpServerWithAccumulation: (): void => {
    configureLogger({
      level: 'error', // 出力はエラーのみ
      accumulateLevel: 'info', // 蓄積はinfo以上（通常モード）
      isMcpMode: true,
      prefix: 'MCP',
      accumulate: true,
      maxEntries: 2000,
    });
  },

  // MCPサーバーデバッグモード（蓄積あり）：詳細ログ出力、全ログ蓄積
  mcpServerDebugWithAccumulation: (): void => {
    configureLogger({
      level: 'debug', // デバッグモードでは詳細ログ出力
      accumulateLevel: 'debug', // 蓄積は全レベル（デバッグモード）
      isMcpMode: false, // デバッグ時はstdout制限なし
      prefix: 'MCP-DEBUG',
      accumulate: true,
      maxEntries: 3000,
    });
  },

  // CLIモード：通常の詳細ログ
  cli: (): void => {
    configureLogger({
      level: 'info',
      accumulateLevel: 'info',
      isMcpMode: false,
      prefix: 'CLI',
      accumulate: false,
    });
  },

  // デバッグモード：すべてのログを出力
  debug: (): void => {
    configureLogger({
      level: 'debug',
      accumulateLevel: 'debug',
      isMcpMode: false,
      prefix: 'DEBUG',
      accumulate: true,
      maxEntries: 3000,
    });
  },

  // サイレントモード：出力なし
  quiet: (): void => {
    configureLogger({
      level: 'quiet',
      accumulateLevel: 'quiet',
      isMcpMode: true,
      accumulate: false,
    });
  },
};
