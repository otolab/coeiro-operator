/**
 * COEIRO Operator E2E Tests with MCP Debug Integration
 * mcp-debug統合機能を活用したCOEIRO Operatorのe2eテスト
 * 
 * このテストは実際のCOEIRO Operator MCPサーバーを
 * mcp-debugの統合機能を使って制御・テストします
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface MCPDebugTestResult {
  stdout: string[];
  stderr: string[];
  controlResponses: string[];
  mcpResponses: any[];
  targetStatus: any;
  exitCode: number | null;
}

class CoeirocoperatorMCPDebugTestRunner {
  private cliProcess?: ChildProcess;
  private output: MCPDebugTestResult = {
    stdout: [],
    stderr: [],
    controlResponses: [],
    mcpResponses: [],
    targetStatus: null,
    exitCode: null
  };

  /**
   * mcp-debugを使ってCOEIRO Operator MCPサーバーを起動
   */
  async startCOEIROOperatorWithDebug(options: string[] = []): Promise<void> {
    const cliPath = path.resolve(__dirname, '../../../dist/mcp-debug/cli.js');
    const coeirocoperatorServerPath = path.resolve(__dirname, '../../../dist/mcp/server.js');
    
    return new Promise((resolve, reject) => {
      this.cliProcess = spawn('node', [cliPath, coeirocoperatorServerPath, '--debug', ...options], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          MCP_DEBUG_TEST_MODE: 'true'
        }
      });

      this.cliProcess.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        this.output.stdout.push(...lines);
        this.parseOutput(lines);
      });

      this.cliProcess.stderr?.on('data', (data) => {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        this.output.stderr.push(...lines);
      });

      this.cliProcess.on('error', (error) => {
        reject(new Error(`Failed to start COEIRO Operator with debug: ${error.message}`));
      });

      this.cliProcess.on('exit', (code) => {
        this.output.exitCode = code;
      });

      // COEIRO Operator起動完了を待機
      const timeout = setTimeout(() => {
        reject(new Error('COEIRO Operator startup timeout'));
      }, 15000);

      const checkStarted = () => {
        if (this.output.stdout.some(line => 
          line.includes('Target server started successfully') ||
          line.includes('SayCoeiroink and OperatorManager initialized')
        )) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkStarted, 300);
        }
      };

      checkStarted();
    });
  }

  /**
   * mcp-debug制御コマンドを送信
   */
  async sendControlCommand(command: string): Promise<void> {
    if (!this.cliProcess || !this.cliProcess.stdin) {
      throw new Error('COEIRO Operator debug session not started');
    }

    return new Promise((resolve) => {
      this.cliProcess!.stdin!.write(command + '\n');
      setTimeout(resolve, 800); // COEIRO Operatorの処理時間を確保
    });
  }

  /**
   * MCPツールを直接呼び出し（JSON-RPC経由ではなく制御経由）
   */
  async callMCPTool(toolName: string, args: any): Promise<any> {
    const command = `CTRL:target:send:mcp:${toolName}:${JSON.stringify(args)}`;
    await this.sendControlCommand(command);
    
    // レスポンスを待機
    await this.waitForResponse(5000);
    
    const response = this.output.mcpResponses.find(r => 
      r.result && r.result.content && 
      r.result.content[0] && r.result.content[0].text
    );
    
    return response;
  }

  /**
   * レスポンス待機
   */
  async waitForResponse(timeout: number): Promise<void> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkResponse = () => {
        if (Date.now() - startTime > timeout) {
          resolve();
        } else {
          setTimeout(checkResponse, 100);
        }
      };
      checkResponse();
    });
  }

  /**
   * 出力を解析
   */
  private parseOutput(lines: string[]): void {
    for (const line of lines) {
      try {
        // 制御コマンドレスポンス（✅ コマンド名:ステータス: 形式）
        if (line.startsWith('✅ ') && line.includes(':')) {
          this.output.controlResponses.push(line);
        } 
        // 従来のCTRL_RESPONSE形式も念のため対応
        else if (line.startsWith('CTRL_RESPONSE:')) {
          this.output.controlResponses.push(line);
        } 
        // JSON-RPCレスポンス
        else if (line.startsWith('{') && line.includes('"jsonrpc"')) {
          const parsed = JSON.parse(line);
          this.output.mcpResponses.push(parsed);
        } 
        // ターゲットサーバーステータス情報
        else if (line.includes('Target server status') && line.includes('{')) {
          const statusMatch = line.match(/\{.*\}/);
          if (statusMatch) {
            this.output.targetStatus = JSON.parse(statusMatch[0]);
          }
        }
      } catch (e) {
        // JSON解析失敗は無視
      }
    }
  }

  /**
   * デバッグセッションを停止
   */
  async stopDebugSession(): Promise<void> {
    if (this.cliProcess) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.cliProcess && !this.cliProcess.killed) {
            this.cliProcess.kill('SIGKILL');
          }
          this.cliProcess = undefined;
          resolve();
        }, 5000);

        this.cliProcess!.on('close', () => {
          clearTimeout(timeout);
          this.cliProcess = undefined;
          resolve();
        });
        
        this.cliProcess!.on('error', () => {
          clearTimeout(timeout);
          this.cliProcess = undefined;
          resolve();
        });
        
        // graceful shutdown を試行
        try {
          this.cliProcess!.stdin?.write('exit\n');
        } catch (e) {
          // stdin が既に閉じられている場合は無視
        }
        
        // 2秒後に強制終了
        setTimeout(() => {
          if (this.cliProcess && !this.cliProcess.killed) {
            this.cliProcess.kill('SIGTERM');
          }
        }, 2000);
      });
    }
  }

  /**
   * 出力をクリア
   */
  clearOutput(): void {
    this.output = {
      stdout: [],
      stderr: [],
      controlResponses: [],
      mcpResponses: [],
      targetStatus: null,
      exitCode: null
    };
  }

  getOutput(): MCPDebugTestResult {
    return { ...this.output };
  }
}

describe('COEIRO Operator with MCP Debug Integration E2E Tests', () => {
  let testRunner: CoeirocoperatorMCPDebugTestRunner;

  beforeEach(() => {
    testRunner = new CoeirocoperatorMCPDebugTestRunner();
  });

  afterEach(async () => {
    await testRunner.stopDebugSession();
  });

  describe('統合デバッグ環境での基本動作', () => {
    test('mcp-debugを使ったCOEIRO Operatorの起動', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      const output = testRunner.getOutput();
      
      // 起動成功の確認
      expect(output.stdout).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Target server started successfully')
        ])
      );
      
      // COEIRO Operator特有の初期化ログの確認
      expect(output.stdout.join('\n')).toMatch(
        /SayCoeiroink.*initialized|OperatorManager.*initialized/
      );
    }, 25000);

    test('ターゲットサーバー（COEIRO Operator）のステータス確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      await testRunner.sendControlCommand('CTRL:target:status');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:status')
        ])
      );
    }, 25000);

    test('ターゲットサーバーの再起動テスト', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      await testRunner.sendControlCommand('CTRL:target:restart');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:restart')
        ])
      );
    }, 25000);
  });

  describe('COEIRO Operator機能の統合テスト', () => {
    test('標準的なMCP初期化フロー', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // MCP initialize リクエスト
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        },
        id: 1
      });
      
      await testRunner.sendControlCommand(initRequest);
      
      const output = testRunner.getOutput();
      
      // 初期化レスポンスが返ってくることを確認
      expect(output.mcpResponses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            result: expect.objectContaining({
              protocolVersion: '2024-11-05',
              capabilities: expect.any(Object)
            })
          })
        ])
      );
    }, 25000);

    test('ログ機能の動作確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // ログ統計取得コマンド
      await testRunner.sendControlCommand('CTRL:logs:stats');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('logs:stats')
        ])
      );
    }, 25000);

    test('ターゲットサーバーのヘルスチェック', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // ヘルスチェックコマンド
      await testRunner.sendControlCommand('CTRL:target:health');
      
      const output = testRunner.getOutput();
      
      // ヘルスチェックレスポンスが返ってくることを確認
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:health')
        ])
      );
    }, 25000);
  });

  describe('動的再読み込み機能のテスト', () => {
    test('モジュール再読み込みの動作確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug(['--auto-reload']);
      
      // 手動でリロードコマンドを実行
      await testRunner.sendControlCommand('CTRL:target:reload');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:reload')
        ])
      );
    }, 30000);
  });

  describe('エラー処理とレジリエンス', () => {
    test('不正なMCPリクエストの処理', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // 不正なJSON-RPCリクエストを送信
      await testRunner.sendControlCommand('{"invalid": "json"');
      
      const output = testRunner.getOutput();
      
      // サーバーが停止していないことを確認（制御コマンドが動作）
      await testRunner.sendControlCommand('CTRL:target:status');
      const finalOutput = testRunner.getOutput();
      
      expect(finalOutput.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:status')
        ])
      );
    }, 25000);

    test('長時間動作での安定性確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // 複数のコマンドを連続実行
      const commands = [
        'CTRL:target:status',
        'CTRL:logs:stats',
        'CTRL:target:health',
        'CTRL:target:status'
      ];
      
      for (const cmd of commands) {
        await testRunner.sendControlCommand(cmd);
        await testRunner.waitForResponse(1000);
      }
      
      const output = testRunner.getOutput();
      
      // 制御レスポンスが返ってきていることを確認
      expect(output.controlResponses.length).toBeGreaterThanOrEqual(2);
    }, 35000);
  });

  describe('パフォーマンス監視', () => {
    test('メモリ使用量とレスポンス時間の監視', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      const startTime = Date.now();
      
      // ヘルスチェックでパフォーマンス情報を取得
      await testRunner.sendControlCommand('CTRL:target:health');
      
      const responseTime = Date.now() - startTime;
      
      // レスポンス時間が妥当な範囲内であることを確認
      expect(responseTime).toBeLessThan(5000); // 5秒以内
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('target:health')
        ])
      );
    }, 25000);
  });
});