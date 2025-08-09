/**
 * Integration Tests for MCP Debug Environment
 * MCPデバッグ環境の統合テスト
 * 
 * 要件仕様の検証：
 * 1. 連続JSONオブジェクトの処理が安定している
 * 2. MCP/Control/Debug/Error出力が正しく分離される
 * 3. サーバーのプロセス管理機能が動作する
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  details?: any;
}

interface OutputCapture {
  stdout: string[];
  stderr: string[];
  mcpResponses: any[];
  controlResponses: any[];
  debugMessages: string[];
  errorMessages: string[];
}

class IntegrationTestRunner {
  private serverProcess?: ChildProcess;
  private output: OutputCapture = {
    stdout: [],
    stderr: [],
    mcpResponses: [],
    controlResponses: [],
    debugMessages: [],
    errorMessages: []
  };

  async runAllTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    console.log('🧪 MCP Debug Environment Integration Tests\n');

    try {
      // サーバー起動
      await this.startEchoServer();

      // 要件1: 連続JSON処理の安定性テスト
      results.push(await this.testContinuousJsonProcessing());

      // 要件2: 出力分離機能のテスト
      results.push(await this.testOutputChannelSeparation());

      // 要件3: プロセス管理機能のテスト
      results.push(await this.testProcessManagement());

      // 追加テスト: ログ蓄積機能
      results.push(await this.testLogAccumulation());

      // 追加テスト: 制御コマンド処理
      results.push(await this.testControlCommands());

      // 追加テスト: エラー処理
      results.push(await this.testErrorHandling());

    } finally {
      await this.stopServer();
    }

    this.printResults(results);
    return results;
  }

  private async startEchoServer(): Promise<void> {
    const serverPath = path.join(__dirname, '../test/echo-server.js');
    
    console.log('🚀 Starting echo server...');
    
    this.serverProcess = spawn('node', [serverPath, '--debug'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupOutputCapture();
    
    // サーバー起動待機
    await this.waitForServerReady();
    console.log('✅ Echo server started\n');
  }

  private setupOutputCapture(): void {
    if (!this.serverProcess) return;

    this.serverProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      this.output.stdout.push(output);
      
      // 出力タイプ別に分類
      output.split('\n').forEach((line: string) => {
        if (!line.trim()) return;
        
        if (line.startsWith('CTRL_RESPONSE:')) {
          try {
            this.output.controlResponses.push(line);
          } catch {}
        } else if (line.startsWith('{') && line.includes('"jsonrpc"')) {
          try {
            this.output.mcpResponses.push(JSON.parse(line));
          } catch {}
        }
      });
    });

    this.serverProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      this.output.stderr.push(output);
      
      // デバッグメッセージとエラーメッセージを分類
      output.split('\n').forEach((line: string) => {
        if (!line.trim()) return;
        
        if (line.includes('DEBUG:')) {
          this.output.debugMessages.push(line);
        } else if (line.includes('ERROR') || line.includes('Error') || line.includes('Test error:')) {
          this.output.errorMessages.push(line);
        }
      });
    });
  }

  private async waitForServerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      const checkReady = () => {
        if (this.output.controlResponses.some(r => r.includes('init:ok'))) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  private async stopServer(): Promise<void> {
    if (this.serverProcess) {
      console.log('\n🔄 Stopping server...');
      this.serverProcess.kill('SIGTERM');
      
      await new Promise(resolve => {
        if (this.serverProcess) {
          this.serverProcess.on('close', resolve);
          setTimeout(resolve, 5000);
        } else {
          resolve(undefined);
        }
      });
      
      this.serverProcess = undefined;
    }
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.serverProcess) {
      throw new Error('Server not running');
    }
    
    this.serverProcess.stdin?.write(command + '\n');
    await new Promise(resolve => setTimeout(resolve, 100)); // 処理待機
  }

  private clearOutput(): void {
    this.output = {
      stdout: [],
      stderr: [],
      mcpResponses: [],
      controlResponses: [],
      debugMessages: [],
      errorMessages: []
    };
  }

  // 要件1: 連続JSON処理の安定性テスト
  private async testContinuousJsonProcessing(): Promise<TestResult> {
    const startTime = Date.now();
    this.clearOutput();

    try {
      console.log('📋 Testing continuous JSON processing...');
      
      // 連続でJSONリクエストを送信
      const requests = [
        '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05"},"id":1}',
        '{"jsonrpc":"2.0","method":"initialized","params":{},"id":2}',
        '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":3}',
        '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test1"}},"id":4}',
        '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test2"}},"id":5}',
        '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_info","arguments":{"type":"stats"}},"id":6}'
      ];

      for (const request of requests) {
        await this.sendCommand(request);
      }

      // 少し待ってから結果確認
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 全てのリクエストに対するレスポンスがあるかチェック
      const expectedIds = [1, 2, 3, 4, 5, 6];
      const receivedIds = this.output.mcpResponses.map(r => r.id);
      const allReceived = expectedIds.every(id => receivedIds.includes(id));

      // エラーレスポンスがないかチェック
      const hasErrors = this.output.mcpResponses.some(r => r.error);

      if (allReceived && !hasErrors) {
        return {
          name: 'Continuous JSON Processing',
          success: true,
          message: `Successfully processed ${requests.length} consecutive JSON requests`,
          duration: Date.now() - startTime,
          details: { receivedIds, totalResponses: this.output.mcpResponses.length }
        };
      } else {
        return {
          name: 'Continuous JSON Processing',
          success: false,
          message: `Failed to process all requests. Received: ${receivedIds.length}/${expectedIds.length}, Errors: ${hasErrors}`,
          duration: Date.now() - startTime,
          details: { receivedIds, expectedIds, errors: this.output.mcpResponses.filter(r => r.error) }
        };
      }

    } catch (error) {
      return {
        name: 'Continuous JSON Processing',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  // 要件2: 出力分離機能のテスト
  private async testOutputChannelSeparation(): Promise<TestResult> {
    const startTime = Date.now();
    this.clearOutput();

    try {
      console.log('📋 Testing output channel separation...');

      // 各チャネルにテストメッセージを送信
      await this.sendCommand('CTRL:status');
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"test_output","arguments":{"channel":"mcp","message":"test-mcp"}},"id":10}');
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"test_output","arguments":{"channel":"control","message":"test-control"}},"id":11}');
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"test_output","arguments":{"channel":"debug","message":"test-debug"}},"id":12}');
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"test_output","arguments":{"channel":"error","message":"test-error"}},"id":13}');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 各チャネルに適切な出力があるかチェック
      const hasControlResponse = this.output.controlResponses.some(r => r.includes('status:ok'));
      const hasMcpResponse = this.output.mcpResponses.some(r => r.id === 10);
      const hasDebugOutput = this.output.debugMessages.some(m => m.includes('test-debug'));
      const hasErrorOutput = this.output.errorMessages.some(m => m.includes('test-error'));

      const allChannelsWorking = hasControlResponse && hasMcpResponse && hasDebugOutput && hasErrorOutput;

      return {
        name: 'Output Channel Separation',
        success: allChannelsWorking,
        message: allChannelsWorking ? 
          'All output channels working correctly' : 
          'Some output channels not working properly',
        duration: Date.now() - startTime,
        details: {
          control: hasControlResponse,
          mcp: hasMcpResponse,
          debug: hasDebugOutput,
          error: hasErrorOutput
        }
      };

    } catch (error) {
      return {
        name: 'Output Channel Separation',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  // 要件3: プロセス管理機能のテスト
  private async testProcessManagement(): Promise<TestResult> {
    const startTime = Date.now();
    this.clearOutput();

    try {
      console.log('📋 Testing process management...');

      // プロセス管理コマンドをテスト
      await this.sendCommand('CTRL:status');
      await this.sendCommand('CTRL:health');
      await this.sendCommand('CTRL:mode:debug');
      await this.sendCommand('CTRL:logs:stats');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // 各コマンドが成功したかチェック
      const statusOk = this.output.controlResponses.some(r => r.includes('status:ok'));
      const healthOk = this.output.controlResponses.some(r => r.includes('health:ok'));
      const modeOk = this.output.controlResponses.some(r => r.includes('mode:ok'));
      const logsOk = this.output.controlResponses.some(r => r.includes('logs:ok'));

      const allCommandsWorking = statusOk && healthOk && modeOk && logsOk;

      return {
        name: 'Process Management',
        success: allCommandsWorking,
        message: allCommandsWorking ? 
          'All process management commands working' : 
          'Some process management commands failed',
        duration: Date.now() - startTime,
        details: {
          status: statusOk,
          health: healthOk,
          mode: modeOk,
          logs: logsOk,
          totalResponses: this.output.controlResponses.length
        }
      };

    } catch (error) {
      return {
        name: 'Process Management',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  // ログ蓄積機能のテスト
  private async testLogAccumulation(): Promise<TestResult> {
    const startTime = Date.now();

    try {
      console.log('📋 Testing log accumulation...');

      // ログを生成する操作を実行
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_info","arguments":{"type":"logs"}},"id":20}');
      await this.sendCommand('{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_info","arguments":{"type":"stats"}},"id":21}');

      await new Promise(resolve => setTimeout(resolve, 500));

      // ログが蓄積されているかチェック
      const logResponse = this.output.mcpResponses.find(r => r.id === 20);
      const statsResponse = this.output.mcpResponses.find(r => r.id === 21);

      const hasLogEntries = logResponse?.result?.content?.[0]?.text?.includes('Recent logs');
      const hasStats = statsResponse?.result?.content?.[0]?.text?.includes('Log entries:');

      return {
        name: 'Log Accumulation',
        success: !!(hasLogEntries && hasStats),
        message: hasLogEntries && hasStats ? 
          'Log accumulation working correctly' : 
          'Log accumulation not working properly',
        duration: Date.now() - startTime,
        details: {
          hasLogEntries,
          hasStats,
          logResponse: logResponse?.result?.content?.[0]?.text?.substring(0, 100),
          statsResponse: statsResponse?.result?.content?.[0]?.text?.substring(0, 100)
        }
      };

    } catch (error) {
      return {
        name: 'Log Accumulation',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  // 制御コマンド処理のテスト
  private async testControlCommands(): Promise<TestResult> {
    const startTime = Date.now();
    this.clearOutput();

    try {
      console.log('📋 Testing control commands...');

      // 様々な制御コマンドをテスト
      const commands = [
        'CTRL:status',
        'CTRL:health', 
        'CTRL:logs:stats',
        'CTRL:mode:test',
        'CTRL:invalid_command' // 無効なコマンドもテスト
      ];

      for (const cmd of commands) {
        await this.sendCommand(cmd);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

      // レスポンス数とエラーハンドリングをチェック
      const responseCount = this.output.controlResponses.length;
      const hasErrorResponse = this.output.controlResponses.some(r => r.includes('invalid_command:error'));

      return {
        name: 'Control Commands',
        success: responseCount >= commands.length && hasErrorResponse,
        message: `Processed ${responseCount} control commands, error handling working`,
        duration: Date.now() - startTime,
        details: {
          expectedCommands: commands.length,
          actualResponses: responseCount,
          hasErrorHandling: hasErrorResponse,
          responses: this.output.controlResponses
        }
      };

    } catch (error) {
      return {
        name: 'Control Commands',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  // エラー処理のテスト
  private async testErrorHandling(): Promise<TestResult> {
    const startTime = Date.now();
    this.clearOutput();

    try {
      console.log('📋 Testing error handling...');

      // 意図的にエラーを発生させる
      await this.sendCommand('{"invalid":"json","missing":"required_fields"}');
      await this.sendCommand('{"jsonrpc":"2.0","method":"nonexistent_method","id":99}');
      await this.sendCommand('CTRL:invalid_command');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // エラーレスポンスが適切に返されているかチェック
      const hasJsonRpcError = this.output.mcpResponses.some(r => r.error);
      const hasControlError = this.output.controlResponses.some(r => r.includes('error'));

      return {
        name: 'Error Handling',
        success: hasJsonRpcError && hasControlError,
        message: hasJsonRpcError && hasControlError ? 
          'Error handling working correctly' : 
          'Error handling not working properly',
        duration: Date.now() - startTime,
        details: {
          hasJsonRpcError,
          hasControlError,
          errorResponses: this.output.mcpResponses.filter(r => r.error),
          controlErrors: this.output.controlResponses.filter(r => r.includes('error'))
        }
      };

    } catch (error) {
      return {
        name: 'Error Handling',
        success: false,
        message: `Test failed: ${(error as Error).message}`,
        duration: Date.now() - startTime
      };
    }
  }

  private printResults(results: TestResult[]): void {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));

    let passed = 0;
    let failed = 0;

    results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const duration = `${result.duration}ms`;
      
      console.log(`${status} ${result.name.padEnd(30)} ${duration.padStart(8)}`);
      console.log(`     ${result.message}`);
      
      if (!result.success && result.details) {
        console.log(`     Details: ${JSON.stringify(result.details, null, 2).substring(0, 200)}...`);
      }
      
      console.log('');
      
      if (result.success) passed++;
      else failed++;
    });

    console.log('='.repeat(50));
    console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! MCP Debug Environment is working correctly.');
    } else {
      console.log(`\n⚠️  ${failed} test(s) failed. Please check the implementation.`);
    }
  }
}

// テスト実行
async function main() {
  const runner = new IntegrationTestRunner();
  
  try {
    const results = await runner.runAllTests();
    
    const allPassed = results.every(r => r.success);
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Integration tests failed:', error);
    process.exit(1);
  }
}

// 直接実行された場合のみテストを実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { IntegrationTestRunner };