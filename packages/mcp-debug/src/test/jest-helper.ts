/**
 * Vitest Test Helper for MCP Debug Environment
 * MCPデバッグ環境のVitestテストヘルパー
 */

import { beforeEach, afterEach } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

export interface McpTestConfig {
  timeout?: number;
  debugMode?: boolean;
  maxRetries?: number;
}

export interface McpTestResult {
  success: boolean;
  message: string;
  duration: number;
  details?: any;
}

export interface OutputCapture {
  stdout: string[];
  stderr: string[];
  mcpResponses: any[];
  controlResponses: any[];
  debugMessages: string[];
  errorMessages: string[];
}

/**
 * MCPサーバーテスト用のヘルパークラス
 */
export class McpTestHelper {
  private serverProcess?: ChildProcess;
  private output: OutputCapture = {
    stdout: [],
    stderr: [],
    mcpResponses: [],
    controlResponses: [],
    debugMessages: [],
    errorMessages: [],
  };

  constructor(private config: McpTestConfig = {}) {
    this.config = {
      timeout: 10000,
      debugMode: false,
      maxRetries: 3,
      ...config,
    };
  }

  /**
   * Echo Back MCPサーバーを起動
   */
  async startEchoServer(): Promise<void> {
    const serverPath = path.resolve(__dirname, '../../../dist/mcp-debug/test/echo-server.js');
    const args = this.config.debugMode ? ['--debug'] : [];

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [serverPath, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.setupOutputHandlers();

      this.serverProcess.on('error', error => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // 初期化完了を待機
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, this.config.timeout);

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
   * COEIRO Operator MCPサーバーを起動
   */
  async startCoeitoOperatorServer(): Promise<void> {
    const serverPath = path.resolve(__dirname, '../../../dist/mcp/server.js');

    return new Promise((resolve, reject) => {
      this.serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.setupOutputHandlers();

      this.serverProcess.on('error', error => {
        reject(new Error(`Failed to start server: ${error.message}`));
      });

      // サーバー起動を少し待機
      setTimeout(resolve, 1000);
    });
  }

  /**
   * サーバーを停止
   */
  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      return new Promise(resolve => {
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
    this.serverProcess!.stdout?.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim());
      this.output.stdout.push(...lines);
      this.parseOutput(lines);
    });

    this.serverProcess!.stderr?.on('data', data => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim());
      this.output.stderr.push(...lines);
      this.parseErrorOutput(lines);
    });
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
      } catch {
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

    return new Promise(resolve => {
      this.serverProcess!.stdin!.write(command + '\n');
      // 処理時間を確保
      setTimeout(resolve, 100);
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
      id,
    };

    await this.sendCommand(JSON.stringify(request));

    // レスポンスを待機
    await new Promise(resolve => setTimeout(resolve, 200));

    return this.output.mcpResponses.find(r => r.id === id);
  }

  /**
   * 制御コマンドを送信
   */
  async sendControlCommand(command: string): Promise<string | undefined> {
    await this.sendCommand(`CTRL:${command}`);

    // レスポンスを待機
    await new Promise(resolve => setTimeout(resolve, 200));

    return this.output.controlResponses.find(r => r.includes(`CTRL_RESPONSE:${command}:`));
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
      errorMessages: [],
    };
  }

  /**
   * 現在の出力を取得
   */
  getOutput(): OutputCapture {
    return { ...this.output };
  }

  /**
   * 特定の条件が満たされるまで待機
   */
  async waitForCondition(condition: () => boolean, timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  /**
   * レスポンスを待機
   */
  async waitForResponse(
    type: 'mcp' | 'control',
    matcher: (response: any) => boolean,
    timeoutMs = 5000
  ): Promise<any> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const responses = type === 'mcp' ? this.output.mcpResponses : this.output.controlResponses;
      const match = responses.find(matcher);
      if (match) {
        return match;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for ${type} response`);
  }
}

/**
 * Node.jsスクリプトを実行してJSONレスポンスを取得
 */
export async function executeNodeScript(script: string, cwd?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['--input-type=module', '-e', script], {
      cwd: cwd || path.resolve(__dirname, '../../..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errorOutput = '';

    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      errorOutput += data.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch {
          reject(new Error(`Failed to parse output: ${output}`));
        }
      } else {
        reject(new Error(`Process exited with code ${code}. Error: ${errorOutput}`));
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

/**
 * Vitest beforeEach/afterEach 用のセットアップヘルパー
 */
export function setupMcpTest(config?: McpTestConfig) {
  let helper: McpTestHelper;

  beforeEach(() => {
    helper = new McpTestHelper(config);
  });

  afterEach(async () => {
    if (helper) {
      await helper.stopServer();
    }
  });

  return () => helper;
}
