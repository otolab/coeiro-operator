/**
 * Test Helpers for MCP Debug Environment
 * テスト用ヘルパー関数
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

export interface TestConfig {
  serverPath?: string;
  debugMode?: boolean;
  timeout?: number;
  logLevel?: string;
}

export interface TestMessage {
  type: 'control' | 'mcp' | 'error';
  content: string;
  timestamp: Date;
}

export interface TestSession {
  process: ChildProcess;
  messages: TestMessage[];
  isRunning: boolean;
}

/**
 * MCPサーバーのテストセッションを管理
 */
export class McpTestSession {
  private process?: ChildProcess;
  private messages: TestMessage[] = [];
  private config: TestConfig;
  private responseHandlers: Map<string, (message: TestMessage) => void> = new Map();

  constructor(config: TestConfig = {}) {
    this.config = {
      serverPath: path.join(__dirname, '../server.js'),
      debugMode: true,
      timeout: 30000,
      logLevel: 'debug',
      ...config
    };
  }

  /**
   * テストセッションを開始
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Session already started');
    }

    const args = [this.config.serverPath!];
    if (this.config.debugMode) {
      args.push('--debug');
    }

    this.process = spawn('node', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.setupProcessHandlers();
    
    // サーバー起動待機
    await this.waitForReady();
  }

  /**
   * テストセッションを停止
   */
  async stop(): Promise<void> {
    if (!this.process) {
      return;
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);

      this.process!.on('close', () => {
        clearTimeout(timeout);
        this.process = undefined;
        resolve();
      });

      this.process!.kill('SIGTERM');
    });
  }

  /**
   * 制御コマンドを送信
   */
  async sendControlCommand(command: string): Promise<TestMessage | null> {
    if (!this.process) {
      throw new Error('Session not started');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, this.config.timeout);

      // レスポンスハンドラーを登録
      const handlerId = `ctrl_${Date.now()}`;
      this.responseHandlers.set(handlerId, (message) => {
        clearTimeout(timeout);
        this.responseHandlers.delete(handlerId);
        resolve(message);
      });

      // コマンドを送信
      this.process!.stdin?.write(command + '\n');
    });
  }

  /**
   * MCPツールコールを送信
   */
  async sendMcpTool(toolName: string, args: any = {}, id: number = 1): Promise<TestMessage | null> {
    const mcpMessage = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id
    };

    return this.sendMcpMessage(JSON.stringify(mcpMessage));
  }

  /**
   * MCPメッセージを送信
   */
  async sendMcpMessage(message: string): Promise<TestMessage | null> {
    if (!this.process) {
      throw new Error('Session not started');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MCP message timeout'));
      }, this.config.timeout);

      // レスポンスハンドラーを登録
      const handlerId = `mcp_${Date.now()}`;
      this.responseHandlers.set(handlerId, (message) => {
        clearTimeout(timeout);
        this.responseHandlers.delete(handlerId);
        resolve(message);
      });

      // メッセージを送信
      this.process!.stdin?.write(message + '\n');
    });
  }

  /**
   * ログメッセージを取得
   */
  getMessages(type?: 'control' | 'mcp' | 'error'): TestMessage[] {
    if (type) {
      return this.messages.filter(m => m.type === type);
    }
    return [...this.messages];
  }

  /**
   * 最新のメッセージを取得
   */
  getLatestMessage(type?: 'control' | 'mcp' | 'error'): TestMessage | null {
    const messages = this.getMessages(type);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  /**
   * メッセージをクリア
   */
  clearMessages(): void {
    this.messages = [];
  }

  /**
   * サーバーが動作中かチェック
   */
  isRunning(): boolean {
    return this.process?.killed === false;
  }

  private setupProcessHandlers(): void {
    if (!this.process) return;

    // 標準出力（MCPレスポンス + 制御レスポンス）
    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      this.parseOutput(output, 'stdout');
    });

    // 標準エラー出力（エラー + デバッグ）
    this.process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.parseOutput(output, 'stderr');
    });

    // プロセス終了
    this.process.on('close', (code) => {
      this.addMessage('error', `Process exited with code ${code}`);
    });

    // エラー
    this.process.on('error', (error) => {
      this.addMessage('error', `Process error: ${error.message}`);
    });
  }

  private parseOutput(output: string, source: 'stdout' | 'stderr'): void {
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      if (line.startsWith('CTRL_RESPONSE:')) {
        this.addMessage('control', line);
        this.notifyHandlers('control', line);
      } else if (line.startsWith('{') && line.includes('"jsonrpc"')) {
        this.addMessage('mcp', line);
        this.notifyHandlers('mcp', line);
      } else if (source === 'stderr') {
        this.addMessage('error', line);
      }
    }
  }

  private addMessage(type: 'control' | 'mcp' | 'error', content: string): void {
    this.messages.push({
      type,
      content,
      timestamp: new Date()
    });
  }

  private notifyHandlers(type: string, content: string): void {
    for (const [handlerId, handler] of this.responseHandlers) {
      if (handlerId.startsWith(type.substring(0, 3))) {
        handler({
          type: type as any,
          content,
          timestamp: new Date()
        });
      }
    }
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 10000);

      // サーバーからの初期メッセージを待機
      const checkReady = () => {
        if (this.isRunning()) {
          clearTimeout(timeout);
          // 少し待ってから準備完了とする
          setTimeout(resolve, 1000);
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }
}

/**
 * 制御コマンドテスト用ヘルパー
 */
export class ControlCommandTester {
  private session: McpTestSession;

  constructor(session: McpTestSession) {
    this.session = session;
  }

  async testStatus(): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand('CTRL:status');
      return response?.content.includes('ok') || false;
    } catch {
      return false;
    }
  }

  async testHealth(): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand('CTRL:health');
      return response?.content.includes('ok') || false;
    } catch {
      return false;
    }
  }

  async testModeChange(mode: 'debug' | 'production' | 'test'): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand(`CTRL:mode:${mode}`);
      return response?.content.includes('ok') || false;
    } catch {
      return false;
    }
  }

  async testLogStats(): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand('CTRL:logs:stats');
      return response?.content.includes('ok') || false;
    } catch {
      return false;
    }
  }

  async testLogGet(limit: number = 10): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand(`CTRL:logs:get:limit=${limit}`);
      return response?.content.includes('ok') || false;
    } catch {
      return false;
    }
  }

  async testInvalidCommand(): Promise<boolean> {
    try {
      const response = await this.session.sendControlCommand('CTRL:invalid_command');
      return response?.content.includes('error') || false;
    } catch {
      return true; // エラーが期待される
    }
  }
}

/**
 * MCPツールテスト用ヘルパー
 */
export class McpToolTester {
  private session: McpTestSession;

  constructor(session: McpTestSession) {
    this.session = session;
  }

  async testServerStatus(): Promise<boolean> {
    try {
      const response = await this.session.sendMcpTool('server_status');
      return response?.content.includes('"result"') || false;
    } catch {
      return false;
    }
  }

  async testDebugLogs(action: 'get' | 'stats' | 'clear' = 'stats'): Promise<boolean> {
    try {
      const response = await this.session.sendMcpTool('debug_logs', { action });
      return response?.content.includes('"result"') || false;
    } catch {
      return false;
    }
  }

  async testInvalidTool(): Promise<boolean> {
    try {
      const response = await this.session.sendMcpTool('invalid_tool');
      return response?.content.includes('"error"') || false;
    } catch {
      return true; // エラーが期待される
    }
  }
}

/**
 * テストスイート実行用ヘルパー
 */
export class TestRunner {
  static async runFullTest(config: TestConfig = {}): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: Array<{ name: string; success: boolean; error?: string }>;
  }> {
    const session = new McpTestSession(config);
    const results: Array<{ name: string; success: boolean; error?: string }> = [];

    try {
      await session.start();

      const controlTester = new ControlCommandTester(session);
      const mcpTester = new McpToolTester(session);

      // 制御コマンドテスト
      const controlTests = [
        { name: 'Control Status', test: () => controlTester.testStatus() },
        { name: 'Control Health', test: () => controlTester.testHealth() },
        { name: 'Control Mode Change', test: () => controlTester.testModeChange('debug') },
        { name: 'Control Log Stats', test: () => controlTester.testLogStats() },
        { name: 'Control Log Get', test: () => controlTester.testLogGet(5) },
        { name: 'Control Invalid Command', test: () => controlTester.testInvalidCommand() }
      ];

      // MCPツールテスト
      const mcpTests = [
        { name: 'MCP Server Status', test: () => mcpTester.testServerStatus() },
        { name: 'MCP Debug Logs', test: () => mcpTester.testDebugLogs() },
        { name: 'MCP Invalid Tool', test: () => mcpTester.testInvalidTool() }
      ];

      // すべてのテストを実行
      for (const testGroup of [controlTests, mcpTests]) {
        for (const testCase of testGroup) {
          try {
            const success = await testCase.test();
            results.push({ name: testCase.name, success });
          } catch (error) {
            results.push({ 
              name: testCase.name, 
              success: false, 
              error: (error as Error).message 
            });
          }
        }
      }

    } finally {
      await session.stop();
    }

    const passed = results.filter(r => r.success).length;
    const failed = results.length - passed;

    return {
      passed,
      failed,
      total: results.length,
      results
    };
  }
}