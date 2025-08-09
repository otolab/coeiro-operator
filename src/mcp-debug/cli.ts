#!/usr/bin/env node
/**
 * MCP Debug CLI
 * テスト対象サーバーを内部から制御するデバッグ環境のCLIインターフェース
 * 
 * Usage: mcp-debug <target-server-code>.ts [options]
 */

import { createInterface } from 'readline';
import path from 'path';
import { promises as fs } from 'fs';
import { TargetServerWrapper } from './wrapper/target-server-wrapper.js';
import { ModuleReloader } from './wrapper/module-reloader.js';
import { ControlHandler } from './control/handler.js';
import { OutputManager } from './output/manager.js';
import { DebugLogManager, LoggerPresets } from './logger/index.js';

interface CLIOptions {
  targetServerPath: string;
  debugMode: boolean;
  autoReload: boolean;
  watchPath?: string;
  configPath?: string;
  interactive: boolean;
  help: boolean;
}

class MCPDebugCLI {
  private options: CLIOptions;
  private wrapper?: TargetServerWrapper;
  private reloader?: ModuleReloader;
  private controlHandler?: ControlHandler;
  private outputManager?: OutputManager;
  private logManager: DebugLogManager;
  private readline?: any;
  private isShuttingDown = false;

  constructor(options: CLIOptions) {
    this.options = options;
    this.logManager = DebugLogManager.getInstance();
    this.setupLogging();
  }

  private setupLogging(): void {
    if (this.options.debugMode) {
      LoggerPresets.debug();
    } else {
      LoggerPresets.mcpServerWithAccumulation();
    }

    const logger = this.logManager.getLogger('cli');
    logger.info('MCP Debug CLI initialized', {
      targetServerPath: this.options.targetServerPath,
      debugMode: this.options.debugMode,
      autoReload: this.options.autoReload
    });
  }

  /**
   * CLIを起動
   */
  async start(): Promise<void> {
    const logger = this.logManager.getLogger('cli');

    try {
      // ヘルプ表示
      if (this.options.help) {
        this.showHelp();
        return;
      }

      // ターゲットサーバーパスの検証
      await this.validateTargetServer();

      // コンポーネントを初期化
      await this.initializeComponents();

      // ターゲットサーバーを起動
      await this.startTargetServer();

      // インタラクティブモードの場合はREPLを開始
      if (this.options.interactive) {
        await this.startInteractiveMode();
      } else {
        // 非インタラクティブモードでは標準入力からコマンドを待機
        await this.startNonInteractiveMode();
      }

    } catch (error) {
      logger.error('Failed to start MCP Debug CLI', error);
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  /**
   * ターゲットサーバーパスの検証
   */
  private async validateTargetServer(): Promise<void> {
    try {
      const fullPath = path.resolve(this.options.targetServerPath);
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        throw new Error(`Target server path is not a file: ${fullPath}`);
      }

      // .ts または .js ファイルかチェック
      const ext = path.extname(fullPath);
      if (!['.ts', '.js', '.mjs'].includes(ext)) {
        throw new Error(`Target server must be a .ts, .js, or .mjs file: ${fullPath}`);
      }

      // パスを絶対パスに更新
      this.options.targetServerPath = fullPath;

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Target server file not found: ${this.options.targetServerPath}`);
      }
      throw error;
    }
  }

  /**
   * コンポーネントを初期化
   */
  private async initializeComponents(): Promise<void> {
    const logger = this.logManager.getLogger('cli');

    // 出力管理を初期化
    this.outputManager = new OutputManager({
      enableDebugOutput: this.options.debugMode,
      enableMcpOutput: true,
      enableControlOutput: true
    });

    // ターゲットサーバーラッパーを初期化
    this.wrapper = new TargetServerWrapper({
      serverPath: this.options.targetServerPath,
      debugMode: this.options.debugMode,
      enableControlCommands: true,
      interceptStdio: true
    });

    // モジュールリローダーを初期化（オプション）
    if (this.options.autoReload) {
      this.reloader = new ModuleReloader({
        autoReload: true,
        watchExtensions: ['.ts', '.js', '.mjs', '.json'],
        excludeDirs: ['node_modules', '.git', 'dist', 'build'],
        debounceMs: 300
      });

      // リロードイベントリスナーを設定
      this.reloader.onReload((event) => {
        if (event.success) {
          logger.info('Module reloaded', { 
            type: event.type, 
            filePath: event.filePath 
          });
          
          if (this.options.interactive) {
            console.log(`\n📦 Module reloaded: ${event.filePath}`);
            this.showPrompt();
          }
        } else {
          logger.error('Module reload failed', { 
            type: event.type, 
            filePath: event.filePath, 
            error: event.error 
          });
          
          if (this.options.interactive) {
            console.log(`\n❌ Reload failed: ${event.error?.message}`);
            this.showPrompt();
          }
        }
      });
    }

    // 制御ハンドラーを初期化
    this.controlHandler = new ControlHandler();
    
    // ターゲットサーバー制御を設定
    this.controlHandler.setTargetServerControl(this.wrapper, this.reloader);

    // ラッパーに制御ハンドラーを設定
    this.wrapper.setControlHandler(this.controlHandler);

    logger.info('Components initialized successfully');
  }

  /**
   * ターゲットサーバーを起動
   */
  private async startTargetServer(): Promise<void> {
    const logger = this.logManager.getLogger('cli');

    if (!this.wrapper) {
      throw new Error('Wrapper not initialized');
    }

    logger.info('Starting target server...');
    console.log(`🚀 Starting target server: ${this.options.targetServerPath}`);

    await this.wrapper.startTargetServer();

    // ファイル監視を開始（オプション）
    if (this.reloader) {
      const watchPath = this.options.watchPath || path.dirname(this.options.targetServerPath);
      await this.reloader.startWatching(watchPath);
      console.log(`👀 Watching for changes: ${watchPath}`);
    }

    console.log('✅ Target server started successfully');
    console.log('📋 Type "CTRL:help" for available commands');
  }

  /**
   * インタラクティブモードを開始
   */
  private async startInteractiveMode(): Promise<void> {
    console.log('\n🎮 Interactive mode enabled');
    console.log('💡 Use CTRL:target:* commands to control the target server');
    console.log('💡 Use CTRL:help for full command list\n');

    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });

    this.readline.on('line', async (input: string) => {
      await this.handleInput(input.trim());
      this.showPrompt();
    });

    this.readline.on('close', () => {
      console.log('\n👋 Goodbye!');
      this.shutdown();
    });

    this.showPrompt();
  }

  /**
   * 非インタラクティブモードを開始
   */
  private async startNonInteractiveMode(): Promise<void> {
    console.log('📡 Non-interactive mode - waiting for input on stdin');

    const readline = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.on('line', async (input: string) => {
      await this.handleInput(input.trim());
    });

    readline.on('close', () => {
      this.shutdown();
    });
  }

  /**
   * 入力を処理
   */
  private async handleInput(input: string): Promise<void> {
    if (!input) {
      return;
    }

    const logger = this.logManager.getLogger('cli');

    try {
      // 特別なコマンドをチェック
      switch (input.toLowerCase()) {
        case 'exit':
        case 'quit':
        case 'q':
          await this.shutdown();
          return;

        case 'clear':
          console.clear();
          return;

        case 'status':
          input = 'CTRL:target:status';
          break;

        case 'restart':
          input = 'CTRL:target:restart';
          break;

        case 'help':
          input = 'CTRL:help';
          break;
      }

      // 制御コマンドかチェック
      if (input.startsWith('CTRL:')) {
        if (!this.controlHandler) {
          throw new Error('Control handler not available');
        }

        const response = await this.controlHandler.handleInput(input);
        
        // 特別なコマンドの処理
        if (input === 'CTRL:help') {
          console.log('\n' + this.controlHandler.getHelp() + '\n');
          console.log('Additional shortcuts:');
          console.log('  status  -> CTRL:target:status');
          console.log('  restart -> CTRL:target:restart');
          console.log('  help    -> CTRL:help');
          console.log('  clear   -> clear screen');
          console.log('  exit    -> quit the CLI\n');
          return;
        }

        // 結果を表示
        this.displayResponse(response);
      } else {
        console.log('❓ Unknown command. Type "help" for available commands.');
      }

    } catch (error) {
      logger.error('Error handling input', error);
      console.log(`❌ Error: ${(error as Error).message}`);
    }
  }

  /**
   * 制御応答を表示
   */
  private displayResponse(response: any): void {
    const icon = response.status === 'success' ? '✅' : '❌';
    console.log(`\n${icon} ${response.command}: ${response.message}`);
    
    if (response.data) {
      if (typeof response.data === 'string') {
        console.log(response.data);
      } else {
        console.log(JSON.stringify(response.data, null, 2));
      }
    }
    console.log();
  }

  /**
   * プロンプトを表示
   */
  private showPrompt(): void {
    if (this.readline && !this.isShuttingDown) {
      this.readline.prompt();
    }
  }

  /**
   * ヘルプを表示
   */
  private showHelp(): void {
    console.log(`
MCP Debug CLI - Target Server Control Interface

Usage: mcp-debug <target-server-code>.ts [options]

Arguments:
  target-server-code.ts    Path to the target MCP server file

Options:
  --debug, -d             Enable debug mode with verbose logging
  --auto-reload, -r       Enable automatic module reloading on file changes
  --watch-path <path>     Custom path to watch for changes (default: server file directory)
  --config <path>         Custom config file path
  --interactive, -i       Start in interactive mode (default: true if TTY)
  --help, -h             Show this help message

Examples:
  mcp-debug ./src/mcp/server.ts
  mcp-debug ./my-server.js --debug --auto-reload
  mcp-debug ./server.ts --watch-path ./src --interactive

Control Commands (available during runtime):
  CTRL:target:status      - Get target server status
  CTRL:target:restart     - Restart target server
  CTRL:target:reload      - Reload and restart target server
  CTRL:target:watch:start - Start file watching
  CTRL:target:watch:stop  - Stop file watching
  CTRL:help              - Show all available commands

Interactive Shortcuts:
  status                 - Show target server status
  restart                - Restart target server
  help                   - Show help
  clear                  - Clear screen
  exit/quit/q           - Exit the CLI
    `);
  }

  /**
   * シャットダウン処理
   */
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    const logger = this.logManager.getLogger('cli');

    try {
      logger.info('Shutting down MCP Debug CLI...');

      if (this.readline) {
        this.readline.close();
      }

      if (this.reloader) {
        await this.reloader.cleanup();
      }

      if (this.wrapper) {
        await this.wrapper.shutdown();
      }

      if (this.outputManager) {
        this.outputManager.shutdown();
      }

      await this.logManager.shutdown();

      logger.info('MCP Debug CLI shutdown completed');
      process.exit(0);

    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * シグナルハンドラーを設定
   */
  setupSignalHandlers(): void {
    const gracefulShutdown = (signal: string) => {
      console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
      this.shutdown();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
      this.shutdown();
    });
  }
}

/**
 * コマンドライン引数をパース
 */
function parseArguments(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    targetServerPath: '',
    debugMode: false,
    autoReload: false,
    interactive: process.stdout.isTTY,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--debug':
      case '-d':
        options.debugMode = true;
        break;

      case '--auto-reload':
      case '-r':
        options.autoReload = true;
        break;

      case '--watch-path':
        options.watchPath = args[++i];
        break;

      case '--config':
        options.configPath = args[++i];
        break;

      case '--interactive':
      case '-i':
        options.interactive = true;
        break;

      case '--no-interactive':
        options.interactive = false;
        break;

      case '--help':
      case '-h':
        options.help = true;
        break;

      default:
        if (!arg.startsWith('-') && !options.targetServerPath) {
          options.targetServerPath = arg;
        } else if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!options.help && !options.targetServerPath) {
    console.error('Error: Target server path is required');
    console.error('Run with --help for usage information');
    process.exit(1);
  }

  return options;
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const options = parseArguments();
  const cli = new MCPDebugCLI(options);
  
  cli.setupSignalHandlers();
  await cli.start();
}

// 直接実行された場合のみCLIを起動
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start MCP Debug CLI:', error);
    process.exit(1);
  });
}

export { MCPDebugCLI, type CLIOptions };