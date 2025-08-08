/**
 * src/utils/logger.ts: 簡易ログシステム
 * MCPサーバー環境でのstdout汚染を防ぐログレベル制御機能
 */

export type LogLevel = 'quiet' | 'error' | 'warn' | 'info' | 'verbose' | 'debug';

interface LoggerConfig {
  level: LogLevel;
  isMcpMode: boolean;  // MCPサーバーモード時はstdout出力を制限
  prefix?: string;     // ログプレフィックス
}

class Logger {
  private config: LoggerConfig;
  private static instance: Logger;

  // ログレベルの数値マッピング（小さいほど重要）
  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    quiet: 0,    // 出力なし
    error: 1,    // エラーのみ
    warn: 2,     // 警告以上
    info: 3,     // 情報以上
    verbose: 4,  // 詳細情報以上
    debug: 5     // すべて（デバッグ含む）
  };

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      isMcpMode: false,
      prefix: '',
      ...config
    };
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

  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const prefix = this.config.prefix ? `[${this.config.prefix}] ` : '';
    const formattedArgs = args.length > 0 ? ` ${args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ')}` : '';
    
    return `${timestamp} ${level.toUpperCase()} ${prefix}${message}${formattedArgs}`;
  }

  private writeLog(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message, ...args);

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

  // ログレベル別メソッド
  error(message: string, ...args: unknown[]): void {
    this.writeLog('error', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.writeLog('warn', message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.writeLog('info', message, ...args);
  }

  verbose(message: string, ...args: unknown[]): void {
    this.writeLog('verbose', message, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.writeLog('debug', message, ...args);
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
      isMcpMode: true,
      prefix: 'MCP'
    });
  },

  // CLIモード：通常の詳細ログ
  cli: (): void => {
    configureLogger({
      level: 'info',
      isMcpMode: false,
      prefix: 'CLI'
    });
  },

  // デバッグモード：すべてのログを出力
  debug: (): void => {
    configureLogger({
      level: 'debug',
      isMcpMode: false,
      prefix: 'DEBUG'
    });
  },

  // サイレントモード：出力なし
  quiet: (): void => {
    configureLogger({
      level: 'quiet',
      isMcpMode: true
    });
  }
};