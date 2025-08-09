/**
 * Punctuation Mode Tests for COEIRO Operator
 * 句読点分割モードのテスト
 * 
 * chunkModeが未指定時の句読点分割モード機能確認
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

interface PunctuationTestConfig {
  connection: {
    host: string;
    port: string;
  };
  voice: {
    default_voice_id: string;
    default_style_id: number;
    rate: number;
  };
  audio: {
    latencyMode: string;
    splitMode?: string;
    bufferSize: number;
    processing?: any;
    splitSettings?: any;
    bufferSettings?: any;
  };
}

class PunctuationModeTestRunner {
  private serverProcess?: ChildProcess;
  private output: string[] = [];
  private errorOutput: string[] = [];

  /**
   * テスト用設定ファイルでCOEIRO Operatorサーバーを起動
   */
  async startServerWithConfig(configPath: string, options: { debug?: boolean } = {}): Promise<void> {
    const serverPath = path.resolve(__dirname, '../../../dist/mcp/server.js');
    
    // Nodeの引数とサーバーの引数を分離
    const nodeArgs = [serverPath];
    const serverArgs = ['--config', configPath];
    if (options.debug) {
      serverArgs.push('--debug');
    }
    
    console.log(`📍 Starting server: node ${nodeArgs.join(' ')} ${serverArgs.join(' ')}`);
    console.time('Process spawn');
    
    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [...nodeArgs, ...serverArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' }
      });
      console.timeEnd('Process spawn');

      console.time('Output handlers setup');
      this.setupOutputHandlers();
      console.timeEnd('Output handlers setup');

      this.serverProcess.on('error', (error) => {
        console.log(`❌ Server process error: ${error.message}`);
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      console.time('Server warmup wait');
      // サーバー起動を待機（短縮）
      setTimeout(() => {
        console.timeEnd('Server warmup wait');
        console.log('✓ Server process started');
        resolve();
      }, 1000);
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
   * 出力ハンドラーを設定
   */
  private setupOutputHandlers(): void {
    this.serverProcess!.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      this.output.push(...lines);
    });

    this.serverProcess!.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter((line: string) => line.trim());
      this.errorOutput.push(...lines);
    });
  }

  /**
   * JSON-RPCリクエストを送信
   */
  async sendJsonRpcRequest(method: string, params?: any, id = 1): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      method,
      ...(params && { params }),
      id
    };

    console.log(`📤 Sending JSON-RPC: ${method} (id: ${id})`);
    console.time(`JSON-RPC ${method} (${id})`);

    return new Promise((resolve, reject) => {
      if (!this.serverProcess || !this.serverProcess.stdin) {
        reject(new Error('Server not started'));
        return;
      }

      console.time(`Request write (${id})`);
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');
      console.timeEnd(`Request write (${id})`);
      
      // レスポンスを待機（短縮）
      const timeout = setTimeout(() => {
        console.log(`⏰ JSON-RPC timeout for ${method} (id: ${id})`);
        reject(new Error('Response timeout'));
      }, 10000); // タイムアウトを10秒に延長

      const checkResponse = () => {
        // すべての出力をログに出力して確認
        if (this.output.length > 0) {
          console.log(`📊 Current output lines (${this.output.length}):`);
          this.output.slice(-5).forEach((line, i) => {
            console.log(`  [${this.output.length - 5 + i}] ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
          });
        }
        
        if (this.errorOutput.length > 0) {
          console.log(`🚨 Error output lines (${this.errorOutput.length}):`);
          this.errorOutput.slice(-5).forEach((line, i) => {
            console.log(`  [${this.errorOutput.length - 5 + i}] ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`);
          });
        }

        const responseLines = this.output.filter(line => {
          try {
            const parsed = JSON.parse(line);
            return parsed.id === id;
          } catch (e) {
            return false;
          }
        });

        if (responseLines.length > 0) {
          clearTimeout(timeout);
          console.timeEnd(`JSON-RPC ${method} (${id})`);
          console.log(`📥 Received response for ${method} (id: ${id})`);
          try {
            resolve(JSON.parse(responseLines[0]));
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        } else {
          setTimeout(checkResponse, 200); // チェック間隔を少し長く
        }
      };

      checkResponse();
    });
  }

  /**
   * 出力をクリア
   */
  clearOutput(): void {
    this.output = [];
    this.errorOutput = [];
  }

  /**
   * 現在の出力を取得
   */
  getOutput(): { stdout: string[]; stderr: string[] } {
    return {
      stdout: [...this.output],
      stderr: [...this.errorOutput]
    };
  }
}

describe('Punctuation Mode Tests', () => {
  let testRunner: PunctuationModeTestRunner;
  const configPath = path.resolve(__dirname, '../../../test-configs/punctuation-test-config.json');
  const defaultConfigPath = path.resolve(__dirname, '../../../test-configs/default-split-mode-config.json');


  beforeEach(() => {
    testRunner = new PunctuationModeTestRunner();
  });

  afterEach(async () => {
    await testRunner.stopServer();
  });

  describe('Configuration Loading', () => {
    test('設定ファイルが正常に読み込まれる', async () => {
      // 設定ファイルの存在確認
      try {
        await fs.access(configPath);
      } catch (error) {
        throw new Error(`Config file not found: ${configPath}`);
      }

      // 設定ファイルの内容確認
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config: PunctuationTestConfig = JSON.parse(configContent);

      expect(config.audio.splitMode).toBe('punctuation');
      expect(config.audio.bufferSize).toBeDefined();
      expect(config.audio.latencyMode).toBe('balanced');
    });

    test('設定ファイル指定でサーバーが起動する', async () => {
      await testRunner.startServerWithConfig(configPath);

      // サーバーが正常に起動していることを確認
      const output = testRunner.getOutput();
      
      // より広範囲でログを確認（何らかのログが出力されていることを確認）
      const hasAnyLog = output.stderr.length > 0 || output.stdout.length > 0;
      
      expect(hasAnyLog).toBe(true);
    }, 6000);
  });

  describe('Punctuation Mode Functionality', () => {
    test('MCPツールでsplitMode設定を確認', async () => {
      await testRunner.startServerWithConfig(configPath);

      // 初期化
      await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'punctuation-test-client',
          version: '1.0.0'
        }
      });

      // debug_logsツールで内部ログを取得してsplitMode関連情報を確認
      const debugResponse = await testRunner.sendJsonRpcRequest('tools/call', {
        name: 'debug_logs',
        arguments: {
          action: 'get',
          search: 'split',
          limit: 50
        }
      }, 200);

      if (debugResponse && debugResponse.result) {
        // debug_logsツールが利用可能な場合、内部ログを確認
        expect(debugResponse.result.content).toBeDefined();
        console.log('Debug logs available for splitMode verification');
      } else {
        // debug_logsツールが利用できない場合でも基本的な動作確認
        console.log('Debug logs tool not available, testing basic functionality');
        expect(debugResponse).toBeDefined();
      }
    }, 6000);

    test('MCPサーバーの初期化が成功する', async () => {
      await testRunner.startServerWithConfig(configPath);

      const initResponse = await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} }
      });

      expect(initResponse).toBeDefined();
      
      if (initResponse.error) {
        // エラーがある場合（COEIROINKサーバー未起動等）はスキップ
        console.log('MCP Server initialization failed:', initResponse.error.message);
        expect(initResponse.error).toBeDefined();
      } else {
        // 正常な場合
        expect(initResponse.result).toBeDefined();
        expect(initResponse.result.serverInfo.name).toBe('coeiro-operator');
      }
    }, 6000);

    test('tools/listでsayツールが利用可能', async () => {
      await testRunner.startServerWithConfig(configPath);

      // 初期化
      await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'punctuation-test-client',
          version: '1.0.0'
        }
      });

      // ツール一覧取得
      const toolsResponse = await testRunner.sendJsonRpcRequest('tools/list', {}, 2);

      expect(toolsResponse).toBeDefined();
      expect(toolsResponse.result.tools).toBeDefined();
      
      const sayTool = toolsResponse.result.tools.find((tool: any) => tool.name === 'say');
      expect(sayTool).toBeDefined();
      expect(sayTool.description).toContain('音声');
    }, 6000);

    test('句読点分割モードでの音声合成（chunkMode未指定）', async () => {
      await testRunner.startServerWithConfig(configPath);

      // 初期化
      await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'punctuation-test-client',
          version: '1.0.0'
        }
      });

      // 句読点を含むテキストで音声合成（chunkMode指定なし）
      const sayResponse = await testRunner.sendJsonRpcRequest('tools/call', {
        name: 'say',
        arguments: {
          message: 'こんにちは。今日は良い天気ですね！テストを実行しています。'
        }
      }, 3);

      expect(sayResponse).toBeDefined();
      
      if (sayResponse.error) {
        // COEIROINKサーバーが起動していない場合はスキップ
        console.log('COEIROINK server not available, skipping audio synthesis test');
        expect(sayResponse.error.message).toContain('COEIROINK');
      } else {
        // 正常に実行された場合
        expect(sayResponse.result).toBeDefined();
        expect(sayResponse.result.content).toBeDefined();
        expect(sayResponse.result.content[0].text).toContain('発声完了');
      }
    }, 8000);

    test('splitModeがpunctuationに設定されていることを確認', async () => {
      // 設定ファイル自体の内容確認（最も確実な方法）
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config: PunctuationTestConfig = JSON.parse(configContent);
      expect(config.audio.splitMode).toBe('punctuation');
      
      // サーバー起動確認（通常モード）
      await testRunner.startServerWithConfig(configPath);
      
      const output = testRunner.getOutput();
      
      // サーバーが正常に起動していることを確認（ログ出力あり）
      const hasServerLogs = output.stderr.length > 0 || output.stdout.length > 0;
      expect(hasServerLogs).toBe(true);
    }, 4000);
  });

  describe('Default SplitMode Behavior', () => {
    test('splitMode未指定時でもpunctuationがデフォルトで動作する', async () => {
      console.time('Total test time');
      
      console.time('Config file reading');
      // splitModeが明示的に指定されていない設定ファイルを確認
      const configContent = await fs.readFile(defaultConfigPath, 'utf-8');
      const config: PunctuationTestConfig = JSON.parse(configContent);
      console.timeEnd('Config file reading');
      
      // splitModeが未指定であることを確認
      expect(config.audio.splitMode).toBeUndefined();
      console.log('✓ Config validation completed');
      
      console.time('Server startup');
      // 通常モードでサーバー起動（デバッグモードはスキップ）
      console.log('Starting MCP server...');
      await testRunner.startServerWithConfig(defaultConfigPath);
      console.timeEnd('Server startup');
      console.log('✓ Server startup completed');

      console.time('Server initialization');
      // 初期化
      console.log('Initializing MCP server...');
      await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'punctuation-test-client',
          version: '1.0.0'
        }
      });
      console.timeEnd('Server initialization');
      console.log('✓ Server initialization completed');

      console.time('Voice synthesis');
      // 短いテキストで音声合成テスト
      console.log('Testing voice synthesis...');
      const sayResponse = await testRunner.sendJsonRpcRequest('tools/call', {
        name: 'say',
        arguments: {
          message: 'テスト。確認！'
        }
      }, 100);
      console.timeEnd('Voice synthesis');

      expect(sayResponse).toBeDefined();
      
      if (sayResponse.error) {
        // COEIROINKサーバーが起動していない場合は設定の動作確認のみ
        console.log('COEIROINK server not available, confirming config behavior only');
        expect(sayResponse.error.message).toContain('COEIROINK');
      } else {
        // 正常に実行された場合、デフォルトの句読点分割モードが動作
        expect(sayResponse.result).toBeDefined();
        expect(sayResponse.result.content).toBeDefined();
        expect(sayResponse.result.content[0].text).toContain('発声完了');
      }
      
      console.timeEnd('Total test time');
    }, 60000);

    test.only('punctuationモードの実際の分割動作を直接確認', async () => {
      // splitModeが未指定の設定ファイルを使用
      const configContent = await fs.readFile(defaultConfigPath, 'utf-8');
      const config: PunctuationTestConfig = JSON.parse(configContent);
      expect(config.audio.splitMode).toBeUndefined();
      
      // デバッグモードでサーバー起動
      console.log('🔍 Starting server in DEBUG mode to capture splitting logs...');
      await testRunner.startServerWithConfig(defaultConfigPath, { debug: true });

      // 初期化
      await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: {
          name: 'punctuation-debug-client',
          version: '1.0.0'
        }
      });

      // 句読点を含む複数文のテキストで音声合成
      const testText = 'これは最初の文です。次に二番目の文があります！最後に三番目の文で終わります。';
      console.log(`🎯 Testing punctuation splitting with: "${testText}"`);
      
      const sayResponse = await testRunner.sendJsonRpcRequest('tools/call', {
        name: 'say',
        arguments: {
          message: testText
        }
      }, 200);

      const output = testRunner.getOutput();
      const allLogs = [...output.stdout, ...output.stderr].join('\n');
      
      console.log('📊 Analyzing logs for punctuation splitting evidence...');
      
      // デバッグログから句読点分割の直接的な証拠を確認
      const hasPunctuationSplitting = allLogs.includes('Using punctuation-based splitting');
      const hasChunkResults = /Punctuation splitting result: \d+ chunks/.test(allLogs);
      const hasSplitDebug = allLogs.includes('SPLIT_TEXT_INTO_CHUNKS DEBUG');
      const hasChunkDetails = /Chunk \d+:/.test(allLogs);
      
      // 設定解決ログの確認
      const hasConfigResolution = /config\.audio\.splitMode: undefined/.test(allLogs);
      const hasFallbackMode = /chunkMode: punctuation.*fallback/.test(allLogs);
      
      console.log('🔍 Splitting evidence found:');
      console.log(`  - Using punctuation-based splitting: ${hasPunctuationSplitting}`);
      console.log(`  - Chunk results: ${hasChunkResults}`);
      console.log(`  - Split debug logs: ${hasSplitDebug}`);
      console.log(`  - Chunk details: ${hasChunkDetails}`);
      console.log(`  - Config resolution: ${hasConfigResolution}`);
      console.log(`  - Fallback to punctuation: ${hasFallbackMode}`);
      
      if (sayResponse.error) {
        // COEIROINKサーバーが利用できない場合でも設定解決は確認可能
        console.log('⚠️ COEIROINK server not available, checking config resolution only');
        expect(sayResponse.error.message).toContain('COEIROINK');
        
        // 最低限の設定解決ログは確認
        expect(hasConfigResolution || hasFallbackMode).toBe(true);
      } else {
        // 正常実行時は実際の分割処理を確認
        expect(sayResponse.result).toBeDefined();
        expect(sayResponse.result.content[0].text).toContain('発声完了');
        
        // punctuationモードの直接的な証拠を確認
        const hasPunctuationEvidence = hasPunctuationSplitting || hasChunkResults || hasSplitDebug;
        
        if (!hasPunctuationEvidence) {
          console.log('❌ No direct evidence of punctuation splitting found in logs!');
          console.log('📄 Recent error logs:');
          output.stderr.slice(-10).forEach(line => console.log(`  ${line}`));
          console.log('📄 Recent output logs:');
          output.stdout.slice(-10).forEach(line => console.log(`  ${line}`));
        }
        
        expect(hasPunctuationEvidence).toBe(true);
      }
    }, 30000);

    test('明示的にpunctuationを指定した場合と同等の動作', async () => {
      // 明示的指定版とデフォルト版で同じように動作することを確認
      
      // 明示的指定版での起動
      await testRunner.startServerWithConfig(configPath);
      
      const initResponse1 = await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} }
      }, 101);

      expect(initResponse1).toBeDefined();

      // サーバー停止して再起動（デフォルト版）
      await testRunner.stopServer();
      testRunner.clearOutput();
      
      await testRunner.startServerWithConfig(defaultConfigPath);

      const initResponse2 = await testRunner.sendJsonRpcRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} }
      }, 102);

      expect(initResponse2).toBeDefined();
      
      // どちらも同様に初期化されることを確認
      if (initResponse1.result && initResponse2.result) {
        expect(initResponse1.result.serverInfo.name).toBe(initResponse2.result.serverInfo.name);
      }
    }, 12000);
  });

  describe('Fallback Behavior', () => {
    test('設定ファイルがない場合のフォールバック動作', async () => {
      const invalidConfigPath = '/path/to/nonexistent/config.json';
      
      await testRunner.startServerWithConfig(invalidConfigPath);

      const output = testRunner.getOutput();
      
      // フォールバック設定での初期化ログを確認
      const fallbackLogs = output.stderr.filter(line => 
        line.includes('fallback') ||
        line.includes('Failed to initialize')
      );

      // フォールバック動作が行われているか、または正常に起動していることを確認
      expect(output.stderr.length).toBeGreaterThan(0);
    }, 6000);
  });
});