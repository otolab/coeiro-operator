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
        if (line.startsWith('CTRL_RESPONSE:')) {
          this.output.controlResponses.push(line);
        } else if (line.startsWith('{') && line.includes('"jsonrpc"')) {
          const parsed = JSON.parse(line);
          this.output.mcpResponses.push(parsed);
        } else if (line.includes('Target server status') && line.includes('{')) {
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
        this.cliProcess!.on('close', () => {
          this.cliProcess = undefined;
          resolve();
        });
        
        // graceful shutdown
        this.cliProcess!.stdin?.write('exit\n');
        
        setTimeout(() => {
          if (this.cliProcess && !this.cliProcess.killed) {
            this.cliProcess.kill('SIGTERM');
          }
        }, 3000);
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
      
      await testRunner.sendControlCommand('status');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:target:status:success')
        ])
      );
    }, 25000);

    test('ターゲットサーバーの再起動テスト', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      await testRunner.sendControlCommand('restart');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:target:restart:success')
        ])
      );
    }, 25000);
  });

  describe('COEIRO Operator機能の統合テスト', () => {
    test('オペレータの一覧取得', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // オペレータ一覧を取得するMCPコマンドをシミュレート
      await testRunner.sendControlCommand('CTRL:target:send:operator_available');
      
      const output = testRunner.getOutput();
      
      // 何らかのレスポンスが返ってくることを確認
      expect(output.controlResponses.length).toBeGreaterThan(1);
    }, 25000);

    test('ログ機能の動作確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // ログ取得コマンド
      await testRunner.sendControlCommand('CTRL:logs:get:limit=5');
      
      const output = testRunner.getOutput();
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringContaining('CTRL_RESPONSE:logs:get:success')
        ])
      );
    }, 25000);

    test('音声設定の確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // デバッグ情報でCOEIRO Operator固有の設定確認
      await testRunner.sendControlCommand('CTRL:target:send:debug_info:config');
      
      const output = testRunner.getOutput();
      
      // 何らかの設定情報がレスポンスされることを確認
      expect(output.controlResponses.length).toBeGreaterThan(1);
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
          expect.stringContaining('CTRL_RESPONSE:target:reload:success')
        ])
      );
    }, 30000);
  });

  describe('エラー処理とレジリエンス', () => {
    test('COEIRO Operatorエラー時のデバッグ情報収集', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // 意図的にエラーを発生させるコマンド
      await testRunner.sendControlCommand('CTRL:target:send:invalid_command');
      
      const output = testRunner.getOutput();
      
      // エラーレスポンスが適切に処理されることを確認
      expect(output.controlResponses).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/error|failed/i)
        ])
      );
    }, 25000);

    test('長時間動作での安定性確認', async () => {
      await testRunner.startCOEIROOperatorWithDebug();
      
      // 複数のコマンドを連続実行
      const commands = [
        'status',
        'CTRL:logs:stats',
        'CTRL:target:health',
        'status'
      ];
      
      for (const cmd of commands) {
        await testRunner.sendControlCommand(cmd);
        await testRunner.waitForResponse(1000);
      }
      
      const output = testRunner.getOutput();
      
      // すべてのコマンドが処理されていることを確認
      expect(output.controlResponses.length).toBeGreaterThanOrEqual(commands.length);
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
          expect.stringContaining('CTRL_RESPONSE:target:health:success')
        ])
      );
    }, 25000);
  });
});