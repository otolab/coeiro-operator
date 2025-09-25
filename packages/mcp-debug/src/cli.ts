#!/usr/bin/env node
/**
 * MCP Debug CLI
 * MCPサーバーのデバッグ・テストツール
 */

import { createInterface, Interface as ReadlineInterface } from 'readline';
import path from 'path';
import { promises as fs } from 'fs';
import { MCPDebugClient } from './core/mcp-debug-client.js';
import { MCPServerState } from './core/state-manager.js';

// MCP\u30c4\u30fc\u30eb\u306e\u30b9\u30ad\u30fc\u30de\u578b
interface ToolSchema {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

// JSON-RPC\u30e1\u30c3\u30bb\u30fc\u30b8\u578b
interface JsonRpcMessage {
  jsonrpc: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface CLIOptions {
  targetServerPath: string;
  debugMode: boolean;
  interactive: boolean;
  help: boolean;
  timeout: number;
  requestTimeout: number;
  childArgs: string[];
}

class MCPDebugCLI {
  private client?: MCPDebugClient;
  private readline?: ReadlineInterface;
  private isShuttingDown = false;

  constructor(private options: CLIOptions) {}

  /**
   * CLIを起動
   */
  async start(): Promise<void> {
    try {
      // ヘルプ表示
      if (this.options.help) {
        this.showHelp();
        return;
      }

      // ターゲットサーバーパスの検証
      await this.validateTargetServer();

      // MCPクライアントを初期化
      this.client = new MCPDebugClient({
        serverPath: this.options.targetServerPath,
        args: this.options.childArgs,
        env: process.env,  // 現在の環境変数を引き継ぐ
        timeout: this.options.timeout,
        requestTimeout: this.options.requestTimeout,
        debug: this.options.debugMode,
      });

      // MCPサーバーを起動・初期化
      console.error(`🚀 Starting MCP server: ${this.options.targetServerPath}`);
      await this.client.start();
      console.error('✅ MCP server initialized and ready');

      // インタラクティブモードまたは非インタラクティブモード
      if (this.options.interactive) {
        await this.startInteractiveMode();
      } else {
        await this.startNonInteractiveMode();
      }
    } catch (error) {
      console.error(`❌ Error: ${(error as Error).message}`);
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

      const ext = path.extname(fullPath);
      if (!['.ts', '.js', '.mjs'].includes(ext)) {
        throw new Error(`Target server must be a .ts, .js, or .mjs file: ${fullPath}`);
      }

      this.options.targetServerPath = fullPath;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        throw new Error(`Target server file not found: ${this.options.targetServerPath}`);
      }
      throw error;
    }
  }

  /**
   * インタラクティブモードを開始
   */
  private async startInteractiveMode(): Promise<void> {
    console.log('\n🎮 Interactive mode enabled');
    console.log('💡 Enter JSON-RPC requests or use shortcuts:');
    console.log('  status  - Show server state');
    console.log('  tools   - List available tools');
    console.log('  exit    - Quit the CLI\n');

    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    this.readline.on('line', async (input: string) => {
      await this.handleInteractiveInput(input.trim());
      this.showPrompt();
    });

    this.readline.on('close', async () => {
      console.log('\n👋 Goodbye!');
      await this.shutdown();
    });

    this.showPrompt();
  }

  /**
   * 非インタラクティブモードを開始
   */
  private async startNonInteractiveMode(): Promise<void> {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let inputBuffer = '';
    let currentRequestPromise: Promise<void> | null = null;

    readline.on('line', (line: string) => {
      inputBuffer += line + '\n';

      // 完全なJSONオブジェクトかチェック
      try {
        const message = JSON.parse(inputBuffer);
        inputBuffer = '';

        // JSON-RPCリクエストを処理（Promiseを保持）
        currentRequestPromise = this.handleNonInteractiveInput(message).then(() => {
          // 非インタラクティブモードでは、レスポンス送信後に終了
          if (!process.stdout.isTTY) {
            // 少し待機してからシャットダウン（出力バッファのフラッシュを確実にする）
            setTimeout(() => {
              this.shutdown();
            }, 10);
          }
        }).catch((error) => {
          console.error('Error handling request:', error);
        }).finally(() => {
          currentRequestPromise = null;
        });
      } catch (error) {
        // JSONが不完全な場合は次の行を待つ
        if (!(error instanceof SyntaxError)) {
          console.error('Error parsing input:', error);
          inputBuffer = '';
        }
      }
    });

    readline.on('close', async () => {
      // リクエスト処理中の場合は待機
      if (currentRequestPromise) {
        try {
          await currentRequestPromise;
        } catch (error) {
          console.error('Error waiting for request completion:', error);
        }
      }
      this.shutdown();
    });
  }

  /**
   * インタラクティブモードの入力を処理
   */
  private async handleInteractiveInput(input: string): Promise<void> {
    if (!input) return;

    if (!this.client) {
      console.log('❌ Client not initialized');
      return;
    }

    try {
      // ショートカットコマンド
      switch (input.toLowerCase()) {
        case 'exit':
        case 'quit':
        case 'q':
          await this.shutdown();
          return;

        case 'status':
          console.log(`📊 Server State: ${this.client.getState()}`);
          console.log(`   Ready: ${this.client.isReady()}`);
          console.log(`   Pending Requests: ${this.client.getPendingRequestCount()}`);
          return;

        case 'tools': {
          const capabilities = this.client.getServerCapabilities();
          if (capabilities && typeof capabilities === 'object' && 'tools' in capabilities && capabilities.tools) {
            console.log('🔧 Available Tools:');
            for (const [name, schema] of Object.entries(capabilities.tools as Record<string, any>)) {
              console.log(`   - ${name}`);
            }
          } else {
            console.log('No tools available');
          }
          return;
        }

        case 'clear':
          console.clear();
          return;
      }

      // JSON-RPCリクエストとして処理
      try {
        const request = JSON.parse(input);
        const response = await this.processRequest(request);
        console.log(JSON.stringify(response, null, 2));
      } catch (parseError) {
        // JSONでない場合はツール呼び出しと仮定
        if (input.includes('(')) {
          const match = input.match(/^(\w+)\((.*)\)$/);
          if (match) {
            const [, toolName, argsStr] = match;
            const args = argsStr ? JSON.parse(argsStr) : {};
            const result = await this.client.callTool(toolName, args);
            console.log(JSON.stringify(result, null, 2));
          }
        } else {
          console.log('❓ Invalid input. Enter JSON-RPC request or use shortcuts.');
        }
      }
    } catch (error) {
      console.log(`❌ Error: ${(error as Error).message}`);
    }
  }

  /**
   * 非インタラクティブモードの入力を処理
   */
  private async handleNonInteractiveInput(message: JsonRpcMessage | unknown): Promise<void> {
    if (!this.client) {
      const error = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Client not initialized',
        },
        id: typeof message === 'object' && message !== null && 'id' in message ? (message as JsonRpcMessage).id : null,
      };
      console.log(JSON.stringify(error));
      return;
    }

    try {
      const response = await this.processRequest(message);
      console.log(JSON.stringify(response));
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: (error as Error).message,
        },
        id: typeof message === 'object' && message !== null && 'id' in message ? (message as JsonRpcMessage).id : null,
      };
      console.log(JSON.stringify(errorResponse));
    }
  }

  /**
   * JSON-RPCリクエストを処理
   */
  private async processRequest(request: unknown): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // メソッドに応じて処理
    const { method, params, id } = request as any;

    let result;

    switch (method) {
      case 'tools/call':
        result = await this.client.callTool(params.name, params.arguments);
        break;

      case 'tools/list': {
        const capabilities = this.client.getServerCapabilities();
        result = { tools: Object.keys((capabilities as any)?.tools || {}) };
        break;
      }

      default:
        result = await this.client.sendRequest(method, params);
    }

    return {
      jsonrpc: '2.0',
      result,
      id: id || null,
    };
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
MCP Debug CLI - MCP Server Debugging Tool

Usage: mcp-debug [options] <target-server-file> [-- <child-options>...]

Arguments:
  target-server-file      Path to the target MCP server file

Options:
  --debug, -d             Enable debug mode with verbose logging
  --interactive, -i       Start in interactive mode (default: true if TTY)
  --timeout <ms>          Process startup timeout (default: 30000)
  --request-timeout <ms>  Request timeout (default: 10000)
  --help, -h             Show this help message

Child Options:
  Options after '--' are passed to the target server

Examples:
  # Basic usage (non-interactive)
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \\
    mcp-debug dist/mcp/server.js
  
  # Interactive mode
  mcp-debug --interactive dist/mcp/server.js
  
  # Debug mode with child options
  mcp-debug --debug dist/mcp/server.js -- --config custom.json
    `);
  }

  /**
   * シャットダウン処理
   */
  private async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;

    this.isShuttingDown = true;

    try {
      if (this.readline) {
        this.readline.close();
      }

      if (this.client) {
        await this.client.cleanup();
      }

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
      console.error(`\n📡 Received ${signal}, shutting down gracefully...`);
      this.shutdown();
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    process.on('uncaughtException', error => {
      console.error('Uncaught exception:', error);
      this.shutdown();
    });

    process.on('unhandledRejection', reason => {
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
    interactive: process.stdout.isTTY,
    help: false,
    timeout: 30000,
    requestTimeout: 10000,
    childArgs: [],
  };

  // '--'で引数を分割
  const separatorIndex = args.indexOf('--');
  const mcpDebugArgs = separatorIndex >= 0 ? args.slice(0, separatorIndex) : args;
  const childArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];

  options.childArgs = childArgs;

  for (let i = 0; i < mcpDebugArgs.length; i++) {
    const arg = mcpDebugArgs[i];

    switch (arg) {
      case '--debug':
      case '-d':
        options.debugMode = true;
        break;

      case '--interactive':
      case '-i':
        options.interactive = true;
        break;

      case '--no-interactive':
        options.interactive = false;
        break;

      case '--timeout': {
        const timeoutValue = parseInt(mcpDebugArgs[++i], 10);
        if (isNaN(timeoutValue) || timeoutValue <= 0) {
          console.error('Error: --timeout must be a positive number');
          process.exit(1);
        }
        options.timeout = timeoutValue;
        break;
      }

      case '--request-timeout': {
        const requestTimeoutValue = parseInt(mcpDebugArgs[++i], 10);
        if (isNaN(requestTimeoutValue) || requestTimeoutValue <= 0) {
          console.error('Error: --request-timeout must be a positive number');
          process.exit(1);
        }
        options.requestTimeout = requestTimeoutValue;
        break;
      }

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
  main().catch(error => {
    console.error('Failed to start MCP Debug CLI:', error);
    process.exit(1);
  });
}

export { MCPDebugCLI, type CLIOptions };
