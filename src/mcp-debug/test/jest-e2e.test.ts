/**
 * Jest E2E Tests for MCP Debug Environment
 * MCPデバッグ環境のJest E2Eテスト
 * 
 * 要件仕様の検証：
 * 1. 連続JSONオブジェクトの処理が安定している
 * 2. MCP/Control/Debug/Error出力が正しく分離される
 * 3. サーバーのプロセス管理機能が動作する
 * 4. Echo Back MCPサーバーが正常に動作する
 * 5. ログ蓄積機能が正常に動作する
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

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

class McpE2ETestRunner {
  private serverProcess?: ChildProcess;
  private output: OutputCapture = {
    stdout: [],
    stderr: [],
    mcpResponses: [],
    controlResponses: [],
    debugMessages: [],
    errorMessages: []
  };

  /**
   * Echo Back MCPサーバーを起動
   */
  async startEchoServer(debugMode = false): Promise<void> {
    const serverPath = path.resolve(__dirname, '../../../dist/mcp-debug/test/echo-server.js');
    const args = debugMode ? ['--debug'] : [];
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [serverPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.serverProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        this.output.stdout.push(...lines);
        this.parseOutput(lines);
      });

      this.serverProcess.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        this.output.stderr.push(...lines);
        this.parseErrorOutput(lines);
      });

      this.serverProcess.on('error', (error) => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // 初期化完了を待機
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 5000);

      const checkInitialized = () => {
        if (this.output.controlResponses.some(r => r.includes('init:ok'))) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkInitialized, 100);
        }
      };

      checkInitialized();
    });
  }

  /**
   * サーバーを停止
   */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      return new Promise((resolve) => {
        this.serverProcess!.on('close', () => {
          this.serverProcess = undefined;
          resolve();
        });
        this.serverProcess!.kill('SIGTERM');
      });
    }
  }

  /**
   * 出力を解析してカテゴリ分け
   */
  private parseOutput(lines: string[]): void {
    for (const line of lines) {
      try {
        if (line.startsWith('{') && line.includes('"jsonrpc"')) {
          // JSON-RPC レスポンス
          const parsed = JSON.parse(line);
          this.output.mcpResponses.push(parsed);
        } else if (line.startsWith('CTRL_RESPONSE:')) {
          // 制御レスポンス
          this.output.controlResponses.push(line);
        } else if (line.includes('DEBUG:') || line.includes('Test debug:')) {
          // デバッグメッセージ
          this.output.debugMessages.push(line);
        }
      } catch (e) {
        // JSON解析失敗は無視
      }
    }
  }

  /**
   * エラー出力を解析
   */
  private parseErrorOutput(lines: string[]): void {
    for (const line of lines) {
      if (line.includes('ERROR') || line.includes('Error') || line.includes('Test error:')) {
        this.output.errorMessages.push(line);
      }
    }
  }

  /**
   * コマンドを送信
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.serverProcess || !this.serverProcess.stdin) {
      throw new Error('Server not started');
    }

    return new Promise((resolve) => {
      this.serverProcess!.stdin!.write(command + '\n');
      // 処理時間を確保
      setTimeout(resolve, 100);
    });
  }

  /**
   * 出力をクリア
   */
  clearOutput(): void {
    this.output = {
      stdout: [],
      stderr: [],
      mcpResponses: [],
      controlResponses: [],
      debugMessages: [],
      errorMessages: []
    };
  }
}

describe('MCP Debug Environment E2E Tests', () => {
  let testRunner: McpE2ETestRunner;

  beforeEach(() => {
    testRunner = new McpE2ETestRunner();
  });

  afterEach(async () => {
    await testRunner.stopServer();
  });

  describe('Echo Back MCP Server', () => {
    test('サーバーの起動と初期化', async () => {
      await testRunner.startEchoServer();
      
      // 初期化完了の確認
      expect(testRunner['output'].controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:init:ok')
        ])
      );
    }, 10000);

    test('制御コマンドの処理', async () => {
      await testRunner.startEchoServer();
      
      // ステータス取得コマンド
      await testRunner.sendCommand('CTRL:status');
      
      expect(testRunner['output'].controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:status:ok')
        ])
      );
    }, 10000);

    test('JSON-RPC処理 - tools/list', async () => {
      await testRunner.startEchoServer();
      
      const toolsListRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      });
      
      await testRunner.sendCommand(toolsListRequest);
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const toolsResponse = mcpResponses.find(r => r.id === 1);
      
      expect(toolsResponse).toBeDefined();
      expect(toolsResponse.result.tools).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'echo' }),
          expect.objectContaining({ name: 'debug_info' }),
          expect.objectContaining({ name: 'test_output' })
        ])
      );
    }, 10000);

    test('JSON-RPC処理 - echo ツール', async () => {
      await testRunner.startEchoServer();
      
      const echoRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'echo',
          arguments: {
            message: 'テストメッセージ'
          }
        },
        id: 2
      });
      
      await testRunner.sendCommand(echoRequest);
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const echoResponse = mcpResponses.find(r => r.id === 2);
      
      expect(echoResponse).toBeDefined();
      expect(echoResponse.result.content[0].text).toContain('🔄 Echo: テストメッセージ');
    }, 10000);
  });

  describe('出力チャネル分離', () => {
    test('各出力チャネルの正常な分離', async () => {
      await testRunner.startEchoServer(true); // デバッグモード
      
      // テスト用出力の生成
      const testOutputRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'test_output',
          arguments: {
            channel: 'error',
            message: 'test-error'
          }
        },
        id: 3
      });
      
      await testRunner.sendCommand(testOutputRequest);
      
      // エラーチャネルの確認
      expect(testRunner['output'].errorMessages).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Test error: test-error')
        ])
      );
    }, 10000);

    test('制御レスポンスの分離', async () => {
      await testRunner.startEchoServer();
      
      await testRunner.sendCommand('CTRL:health');
      
      const controlResponses = testRunner['output'].controlResponses;
      expect(controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:health:ok')
        ])
      );
    }, 10000);
  });

  describe('連続処理テスト', () => {
    test('連続JSON-RPCリクエストの処理', async () => {
      await testRunner.startEchoServer();
      
      // 複数のリクエストを連続送信
      const requests = [
        { jsonrpc: '2.0', method: 'tools/list', id: 10 },
        { jsonrpc: '2.0', method: 'tools/call', params: { name: 'echo', arguments: { message: 'test1' } }, id: 11 },
        { jsonrpc: '2.0', method: 'tools/call', params: { name: 'echo', arguments: { message: 'test2' } }, id: 12 }
      ];
      
      for (const req of requests) {
        await testRunner.sendCommand(JSON.stringify(req));
      }
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mcpResponses = testRunner['output'].mcpResponses;
      expect(mcpResponses.filter(r => [10, 11, 12].includes(r.id))).toHaveLength(3);
    }, 15000);

    test('制御コマンドとJSON-RPCの混在処理', async () => {
      await testRunner.startEchoServer();
      
      // 混在コマンド送信
      await testRunner.sendCommand('CTRL:status');
      await testRunner.sendCommand(JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'echo', arguments: { message: 'mixed-test' } },
        id: 20
      }));
      await testRunner.sendCommand('CTRL:health');
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 両方の形式が正常に処理されていることを確認
      expect(testRunner['output'].controlResponses.length).toBeGreaterThanOrEqual(3); // init + status + health
      expect(testRunner['output'].mcpResponses.find(r => r.id === 20)).toBeDefined();
    }, 10000);
  });

  describe('デバッグ情報取得', () => {
    test('debug_info ツール - ログ取得', async () => {
      await testRunner.startEchoServer();
      
      const debugInfoRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'debug_info',
          arguments: {
            type: 'logs'
          }
        },
        id: 30
      });
      
      await testRunner.sendCommand(debugInfoRequest);
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const debugResponse = mcpResponses.find(r => r.id === 30);
      
      expect(debugResponse).toBeDefined();
      expect(debugResponse.result.content[0].text).toContain('📋 Recent logs');
    }, 10000);

    test('debug_info ツール - 統計情報', async () => {
      await testRunner.startEchoServer();
      
      const statsRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'debug_info',
          arguments: {
            type: 'stats'
          }
        },
        id: 31
      });
      
      await testRunner.sendCommand(statsRequest);
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const statsResponse = mcpResponses.find(r => r.id === 31);
      
      expect(statsResponse).toBeDefined();
      expect(statsResponse.result.content[0].text).toContain('📊 Server Statistics');
      expect(statsResponse.result.content[0].text).toContain('Messages processed:');
    }, 10000);
  });

  describe('エラーハンドリング', () => {
    test('不正なJSON-RPCリクエストの処理', async () => {
      await testRunner.startEchoServer();
      
      // 不正なJSONを送信
      await testRunner.sendCommand('{"invalid": json}');
      
      // 少し待機
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const errorResponse = mcpResponses.find(r => r.error && r.error.code === -32700);
      
      expect(errorResponse).toBeDefined();
      expect(errorResponse.error.message).toBe('Parse error');
    }, 10000);

    test('存在しないツールの呼び出し', async () => {
      await testRunner.startEchoServer();
      
      const invalidToolRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'nonexistent_tool',
          arguments: {}
        },
        id: 40
      });
      
      await testRunner.sendCommand(invalidToolRequest);
      
      const mcpResponses = testRunner['output'].mcpResponses;
      const errorResponse = mcpResponses.find(r => r.id === 40);
      
      expect(errorResponse).toBeDefined();
      expect(errorResponse.error.message).toContain('Unknown tool: nonexistent_tool');
    }, 10000);

    test('不正な制御コマンドの処理', async () => {
      await testRunner.startEchoServer();
      
      await testRunner.sendCommand('CTRL:invalid_command');
      
      const controlResponses = testRunner['output'].controlResponses;
      expect(controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:invalid_command:error')
        ])
      );
    }, 10000);
  });
});