/**
 * Control Handler Implementation
 * 制御コマンドハンドラーの実装
 */

import { 
  ControlCommand, 
  ControlResponse, 
  ControlHandler as IControlHandler,
  ServerStatus, 
  HealthCheck, 
  RestartOptions, 
  LogOptions,
  ServerMode,
  ControlError,
  ControlErrorCode 
} from './types.js';
import { ControlCommands } from './commands.js';
import { TargetServerCommands } from './target-server-commands.js';
import { DebugLogManager } from '../logger/index.js';
import type { TargetServerWrapper } from '../wrapper/target-server-wrapper.js';
import type { ModuleReloader } from '../wrapper/module-reloader.js';

export class ControlHandler {
  private commands: ControlCommands;
  private targetCommands?: TargetServerCommands;
  private logger: ReturnType<DebugLogManager['getLogger']>;

  constructor() {
    this.commands = new ControlCommands();
    this.logger = DebugLogManager.getInstance().getLogger('control');
  }

  /**
   * ターゲットサーバー制御機能を設定
   */
  setTargetServerControl(wrapper: TargetServerWrapper, reloader?: ModuleReloader): void {
    this.targetCommands = new TargetServerCommands({ wrapper, reloader });
    this.logger.info('Target server control enabled');
  }

  /**
   * 制御コマンドライン文字列を解析
   */
  parseCommand(input: string): ControlCommand {
    if (!input.startsWith('CTRL:')) {
      throw this.createError(
        ControlErrorCode.INVALID_COMMAND, 
        'Command must start with CTRL:'
      );
    }

    const parts = input.substring(5).split(':'); // 'CTRL:' を除去
    if (parts.length === 0) {
      throw this.createError(
        ControlErrorCode.INVALID_COMMAND, 
        'Empty command'
      );
    }

    return {
      command: parts[0],
      args: parts.slice(1),
      rawInput: input
    };
  }

  /**
   * 制御コマンドを処理
   */
  async handleCommand(command: ControlCommand): Promise<ControlResponse> {
    this.logger.info(`Processing control command: ${command.command}`, { args: command.args });
    this.commands.incrementRequestCount();

    try {
      const response = await this.executeCommand(command);
      this.logger.info(`Control command completed: ${command.command}`, { status: response.status });
      return response;
    } catch (error) {
      this.commands.incrementErrorCount();
      this.logger.error(`Control command failed: ${command.command}`, error);
      
      if (error instanceof Error && 'code' in error) {
        const controlError = error as unknown as ControlError;
        return {
          command: command.command,
          status: 'error',
          message: controlError.message,
          data: { code: controlError.code, details: controlError.details },
          timestamp: new Date().toISOString()
        };
      }

      return {
        command: command.command,
        status: 'error',
        message: (error as Error).message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 文字列入力から制御コマンドを解析して実行
   */
  async handleInput(input: string): Promise<ControlResponse> {
    try {
      const command = this.parseCommand(input);
      return await this.handleCommand(command);
    } catch (error) {
      this.commands.incrementErrorCount();
      this.logger.error('Failed to parse control input', { input, error });
      
      return {
        command: 'unknown',
        status: 'error',
        message: `Failed to parse command: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      };
    }
  }

  private async executeCommand(command: ControlCommand): Promise<ControlResponse> {
    // ターゲットサーバー関連コマンドのチェック
    if (command.command === 'target' && this.targetCommands) {
      return await this.handleTargetCommand(command.args || []);
    }

    switch (command.command) {
      case 'status':
        return await this.commands.getStatus();

      case 'restart':
        return await this.handleRestart(command.args);

      case 'mode':
        return await this.handleMode(command.args);

      case 'health':
        return await this.commands.healthCheck();

      case 'logs':
        return await this.handleLogs(command.args);

      default:
        throw this.createError(
          ControlErrorCode.INVALID_COMMAND,
          `Unknown command: ${command.command}`
        );
    }
  }

  /**
   * ターゲットサーバー制御コマンドを処理
   */
  private async handleTargetCommand(args: string[]): Promise<ControlResponse> {
    if (!this.targetCommands) {
      throw this.createError(
        ControlErrorCode.INVALID_COMMAND,
        'Target server control not available'
      );
    }

    if (args.length === 0) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        'Target command requires subcommand'
      );
    }

    const subcommand = args[0];
    const subargs = args.slice(1);

    switch (subcommand) {
      case 'status':
        return await this.targetCommands.getTargetStatus();

      case 'start':
        return await this.targetCommands.startTarget();

      case 'stop':
        return await this.targetCommands.stopTarget();

      case 'restart':
        return await this.targetCommands.restartTarget();

      case 'reload':
        return await this.targetCommands.reloadTarget(subargs[0]);

      case 'health':
        return await this.targetCommands.healthCheckTarget();

      case 'watch':
        return await this.handleTargetWatch(subargs);

      case 'send':
        return await this.targetCommands.sendCommand(subargs[0], subargs.slice(1));

      default:
        throw this.createError(
          ControlErrorCode.INVALID_COMMAND,
          `Unknown target subcommand: ${subcommand}`
        );
    }
  }

  /**
   * ターゲットサーバーのファイル監視コマンドを処理
   */
  private async handleTargetWatch(args: string[]): Promise<ControlResponse> {
    if (!this.targetCommands) {
      throw this.createError(
        ControlErrorCode.INVALID_COMMAND,
        'Target server control not available'
      );
    }

    if (args.length === 0) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        'Watch command requires subcommand (start|stop)'
      );
    }

    const watchCommand = args[0];
    
    switch (watchCommand) {
      case 'start':
        return await this.targetCommands.startWatching(args[1]);
      
      case 'stop':
        return await this.targetCommands.stopWatching();
      
      default:
        throw this.createError(
          ControlErrorCode.INVALID_COMMAND,
          `Unknown watch subcommand: ${watchCommand}`
        );
    }
  }

  private async handleRestart(args: string[] = []): Promise<ControlResponse> {
    const options: RestartOptions = {
      type: 'graceful',
      timeout: 30000,
      preserveLogs: true
    };

    // 引数の解析
    for (const arg of args) {
      if (arg === 'force') {
        options.type = 'force';
      } else if (arg === 'graceful') {
        options.type = 'graceful';
      } else if (arg.startsWith('timeout=')) {
        const timeout = parseInt(arg.split('=')[1], 10);
        if (isNaN(timeout) || timeout < 1000 || timeout > 300000) {
          throw this.createError(
            ControlErrorCode.INVALID_ARGS,
            'Timeout must be between 1000 and 300000 ms'
          );
        }
        options.timeout = timeout;
      } else if (arg === 'no-preserve-logs') {
        options.preserveLogs = false;
      } else {
        throw this.createError(
          ControlErrorCode.INVALID_ARGS,
          `Unknown restart option: ${arg}`
        );
      }
    }

    return await this.commands.restart(options);
  }

  private async handleMode(args: string[] = []): Promise<ControlResponse> {
    if (args.length !== 1) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        'Mode command requires exactly one argument'
      );
    }

    const mode = args[0] as ServerMode;
    const validModes: ServerMode[] = ['production', 'debug', 'test'];
    
    if (!validModes.includes(mode)) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        `Invalid mode: ${mode}. Valid modes: ${validModes.join(', ')}`
      );
    }

    return await this.commands.setMode(mode);
  }

  private async handleLogs(args: string[] = []): Promise<ControlResponse> {
    if (args.length === 0) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        'Logs command requires at least one argument'
      );
    }

    const action = args[0] as LogOptions['action'];
    const validActions = ['get', 'clear', 'stats', 'stream'];
    
    if (!validActions.includes(action)) {
      throw this.createError(
        ControlErrorCode.INVALID_ARGS,
        `Invalid logs action: ${action}. Valid actions: ${validActions.join(', ')}`
      );
    }

    const options: LogOptions = { action };

    // 追加引数の解析
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('level=')) {
        const levels = arg.split('=')[1].split(',');
        options.level = levels;
      } else if (arg.startsWith('since=')) {
        options.since = arg.split('=')[1];
      } else if (arg.startsWith('limit=')) {
        const limit = parseInt(arg.split('=')[1], 10);
        if (isNaN(limit) || limit < 1 || limit > 10000) {
          throw this.createError(
            ControlErrorCode.INVALID_ARGS,
            'Limit must be between 1 and 10000'
          );
        }
        options.limit = limit;
      } else if (arg.startsWith('search=')) {
        options.search = arg.split('=')[1];
      } else if (arg.startsWith('format=')) {
        const format = arg.split('=')[1];
        if (format !== 'formatted' && format !== 'raw') {
          throw this.createError(
            ControlErrorCode.INVALID_ARGS,
            'Format must be "formatted" or "raw"'
          );
        }
        options.format = format as 'formatted' | 'raw';
      } else if (arg === 'stream-on') {
        options.streamOptions = { enable: true };
      } else if (arg === 'stream-off') {
        options.streamOptions = { enable: false };
      } else {
        throw this.createError(
          ControlErrorCode.INVALID_ARGS,
          `Unknown logs option: ${arg}`
        );
      }
    }

    return await this.commands.handleLogs(options);
  }

  // IControlHandler インターフェース実装
  async getStatus(): Promise<ServerStatus> {
    const response = await this.commands.getStatus();
    return response.data as ServerStatus;
  }

  async restart(options: RestartOptions): Promise<ControlResponse> {
    return await this.commands.restart(options);
  }

  async setMode(mode: ServerMode): Promise<ControlResponse> {
    return await this.commands.setMode(mode);
  }

  async healthCheck(): Promise<HealthCheck> {
    const response = await this.commands.healthCheck();
    return response.data as HealthCheck;
  }


  // ユーティリティメソッド
  private createError(code: ControlErrorCode, message: string, details?: any): ControlError {
    const error = new Error(message) as unknown as ControlError;
    error.code = code;
    error.details = details;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * 制御応答を文字列形式でフォーマット
   */
  formatResponse(response: ControlResponse): string {
    const data = response.data ? `:${JSON.stringify(response.data)}` : '';
    return `CTRL_RESPONSE:${response.command}:${response.status}${data}`;
  }

  /**
   * 利用可能なコマンドのヘルプを取得
   */
  getHelp(): string {
    let help = `
Available Control Commands:

CTRL:status
  - Get server status information

CTRL:restart[:graceful|force][:timeout=ms][:no-preserve-logs]
  - Restart the server
  - Options: graceful (default), force, timeout=30000, no-preserve-logs

CTRL:mode:production|debug|test
  - Set server mode

CTRL:health
  - Perform health check

CTRL:logs:get|clear|stats|stream[:options]
  - Log operations
  - get options: level=error,warn limit=100 since=2025-01-01T00:00:00Z search=text format=formatted|raw
  - stream options: stream-on, stream-off

Examples:
  CTRL:status
  CTRL:restart:graceful:timeout=60000
  CTRL:mode:debug
  CTRL:logs:get:limit=50:level=error,warn
  CTRL:logs:clear`;

    // ターゲットサーバー制御が利用可能な場合は追加ヘルプを表示
    if (this.targetCommands) {
      help += '\n\n' + this.targetCommands.getTargetHelp();
    }

    return help.trim();
  }

  /**
   * 統計情報を取得
   */
  getStats() {
    return this.commands.getStats();
  }
}