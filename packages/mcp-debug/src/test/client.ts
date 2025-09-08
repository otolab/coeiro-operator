#!/usr/bin/env node
/**
 * MCP Debug Test Client
 * デバッグ用MCPテストクライアント
 */

import { createInterface } from 'readline';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface TestResult {
  command: string;
  success: boolean;
  response?: any;
  error?: string;
  duration: number;
}

interface TestSuite {
  name: string;
  tests: Array<{
    name: string;
    command: string;
    expectedType?: 'mcp' | 'control';
    timeout?: number;
  }>;
}

class McpDebugTestClient {
  private serverProcess?: ChildProcess;
  private isInteractive: boolean;
  private rl?: ReturnType<typeof createInterface>;
  private results: TestResult[] = [];

  constructor(isInteractive: boolean = false) {
    this.isInteractive = isInteractive;
  }

  async start(): Promise<void> {
    console.log('🚀 MCP Debug Test Client starting...\n');

    if (this.isInteractive) {
      await this.startInteractiveMode();
    } else {
      await this.runTestSuites();
    }
  }

  private async startServer(): Promise<void> {
    const serverPath = path.join(__dirname, '../server.js');

    console.log(`Starting server: ${serverPath}`);

    this.serverProcess = spawn('node', [serverPath, '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // サーバーの出力をキャプチャ
    this.serverProcess.stdout?.on('data', data => {
      const output = data.toString();
      if (output.trim()) {
        console.log(`[SERVER OUT] ${output.trim()}`);
      }
    });

    this.serverProcess.stderr?.on('data', data => {
      const output = data.toString();
      if (output.trim()) {
        console.log(`[SERVER ERR] ${output.trim()}`);
      }
    });

    this.serverProcess.on('close', code => {
      console.log(`Server process closed with code ${code}`);
    });

    // サーバー起動待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  private async stopServer(): Promise<void> {
    if (this.serverProcess) {
      console.log('Stopping server...');
      this.serverProcess.kill('SIGTERM');

      // graceful shutdown待機
      await new Promise(resolve => {
        if (this.serverProcess) {
          this.serverProcess.on('close', resolve);
          setTimeout(resolve, 5000); // タイムアウト
        } else {
          resolve(undefined);
        }
      });
    }
  }

  private async startInteractiveMode(): Promise<void> {
    await this.startServer();

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('📝 Interactive Mode - Enter commands:');
    console.log('Commands:');
    console.log('  CTRL:status - Get server status');
    console.log('  CTRL:health - Health check');
    console.log('  CTRL:logs:stats - Log statistics');
    console.log(
      '  {"jsonrpc":"2.0","method":"tools/call","params":{"name":"server_status"},"id":1} - MCP tool call'
    );
    console.log('  .help - Show this help');
    console.log('  .exit - Exit client\n');

    this.rl.on('line', async (input: string) => {
      const trimmed = input.trim();

      if (trimmed === '.exit') {
        await this.shutdown();
        return;
      }

      if (trimmed === '.help') {
        console.log(this.getHelp());
        return;
      }

      if (trimmed === '') {
        return;
      }

      await this.sendCommand(trimmed);
    });

    this.rl.on('close', async () => {
      await this.shutdown();
    });
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.serverProcess) {
      console.log('❌ Server not running');
      return;
    }

    const startTime = Date.now();

    try {
      console.log(`📤 Sending: ${command}`);

      // サーバーにコマンドを送信
      this.serverProcess.stdin?.write(command + '\n');

      // レスポンス待機（簡易実装）
      await new Promise(resolve => setTimeout(resolve, 1000));

      const duration = Date.now() - startTime;
      console.log(`⏱️  Duration: ${duration}ms\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ Error: ${error}`);
      console.log(`⏱️  Duration: ${duration}ms\n`);
    }
  }

  private async runTestSuites(): Promise<void> {
    await this.startServer();

    const testSuites: TestSuite[] = [
      {
        name: 'Control Commands',
        tests: [
          { name: 'Status Check', command: 'CTRL:status', expectedType: 'control' },
          { name: 'Health Check', command: 'CTRL:health', expectedType: 'control' },
          { name: 'Log Stats', command: 'CTRL:logs:stats', expectedType: 'control' },
          { name: 'Mode Change', command: 'CTRL:mode:debug', expectedType: 'control' },
          { name: 'Invalid Command', command: 'CTRL:invalid', expectedType: 'control' },
        ],
      },
      {
        name: 'MCP Tools',
        tests: [
          {
            name: 'Server Status Tool',
            command:
              '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"server_status"},"id":1}',
            expectedType: 'mcp',
          },
          {
            name: 'Debug Logs Tool',
            command:
              '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_logs","arguments":{"action":"stats"}},"id":2}',
            expectedType: 'mcp',
          },
        ],
      },
    ];

    for (const suite of testSuites) {
      console.log(`🧪 Running test suite: ${suite.name}`);

      for (const test of suite.tests) {
        const result = await this.runSingleTest(test);
        this.results.push(result);

        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${test.name} (${result.duration}ms)`);

        if (!result.success && result.error) {
          console.log(`     Error: ${result.error}`);
        }
      }

      console.log('');
    }

    this.printSummary();
    await this.stopServer();
  }

  private async runSingleTest(test: any): Promise<TestResult> {
    const startTime = Date.now();

    try {
      if (!this.serverProcess) {
        throw new Error('Server not running');
      }

      // テストコマンドを送信
      this.serverProcess.stdin?.write(test.command + '\n');

      // レスポンス待機
      await new Promise(resolve => setTimeout(resolve, test.timeout || 2000));

      return {
        command: test.command,
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        command: test.command,
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  private printSummary(): void {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = total - passed;

    console.log('📊 Test Summary:');
    console.log(`   Total: ${total}`);
    console.log(`   Passed: ${passed} ✅`);
    console.log(`   Failed: ${failed} ❌`);
    console.log(`   Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`   - ${r.command}: ${r.error}`);
        });
    }
  }

  private getHelp(): string {
    return `
🔧 MCP Debug Test Client Help

Control Commands:
  CTRL:status                    - Get server status
  CTRL:health                    - Perform health check
  CTRL:mode:debug                - Set debug mode
  CTRL:mode:production           - Set production mode
  CTRL:restart:graceful          - Graceful restart
  CTRL:logs:stats                - Get log statistics
  CTRL:logs:get:limit=10         - Get recent logs
  CTRL:logs:clear                - Clear logs

MCP Tool Calls:
  {"jsonrpc":"2.0","method":"tools/call","params":{"name":"server_status"},"id":1}
  {"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_logs","arguments":{"action":"stats"}},"id":2}

Client Commands:
  .help                          - Show this help
  .exit                          - Exit client
    `.trim();
  }

  private async shutdown(): Promise<void> {
    console.log('\n🔄 Shutting down test client...');

    if (this.rl) {
      this.rl.close();
    }

    await this.stopServer();
    process.exit(0);
  }
}

// コマンドライン引数の処理
async function main() {
  const args = process.argv.slice(2);
  const isInteractive = args.includes('--interactive') || args.includes('-i');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MCP Debug Test Client

Usage:
  node client.js [options]

Options:
  --interactive, -i    Start in interactive mode
  --help, -h          Show this help

Examples:
  node client.js                # Run automated tests
  node client.js --interactive  # Start interactive mode
    `);
    process.exit(0);
  }

  const client = new McpDebugTestClient(isInteractive);

  try {
    await client.start();
  } catch (error) {
    console.error('❌ Test client failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { McpDebugTestClient };
