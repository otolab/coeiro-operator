/**
 * MCP E2E Tester
 * MCPサーバーのE2Eテスト用クラス
 */

import { MCPDebugClient, MCPDebugClientOptions } from '../core/mcp-debug-client.js';
import { MCPServerState } from '../core/state-manager.js';

export interface ToolCallResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
  duration?: number;
}

export interface ServerStatus {
  state: MCPServerState;
  isReady: boolean;
  pendingRequests: number;
  capabilities?: unknown;
}

/**
 * MCPサーバーのE2Eテストを実行するクラス
 *
 * @example
 * ```typescript
 * // Mocha/Jest/Vitest での使用例
 * describe('MCP Server', () => {
 *   let tester: MCPServiceE2ETester;
 *
 *   beforeEach(async () => {
 *     tester = await createMCPTester({ serverPath: 'dist/mcp/server.js' });
 *   });
 *
 *   afterEach(async () => {
 *     await tester.cleanup();
 *   });
 *
 *   it('should call tool', async () => {
 *     const result = await tester.callTool('operator_status', {});
 *     expect(result.success).toBe(true);
 *   });
 * });
 * ```
 */
export class MCPServiceE2ETester {
  private client: MCPDebugClient;
  private isStarted = false;

  constructor(private options: MCPDebugClientOptions) {
    this.client = new MCPDebugClient(options);
  }

  /**
   * テスト環境を起動
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      throw new Error('Tester is already started');
    }

    await this.client.start();
    this.isStarted = true;
  }

  /**
   * ツールを呼び出し
   */
  async callTool<T = unknown>(name: string, args?: unknown): Promise<ToolCallResult<T>> {
    if (!this.isStarted) {
      throw new Error('Tester is not started. Call start() first.');
    }

    const startTime = Date.now();

    try {
      const result = await this.client.callTool<T>(name, args);
      return {
        success: true,
        result,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 複数のツールを順次呼び出し
   */
  async callToolsSequentially(
    calls: Array<{ name: string; args?: unknown }>
  ): Promise<Array<ToolCallResult<unknown>>> {
    const results: Array<ToolCallResult<unknown>> = [];

    for (const call of calls) {
      const result = await this.callTool(call.name, call.args);
      results.push(result);
    }

    return results;
  }

  /**
   * 複数のツールを並行して呼び出し
   */
  async callToolsConcurrently(
    calls: Array<{ name: string; args?: unknown }>
  ): Promise<Array<ToolCallResult<unknown>>> {
    const promises = calls.map(call => this.callTool(call.name, call.args));
    return Promise.all(promises);
  }

  /**
   * カスタムJSON-RPCリクエストを送信
   */
  async sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.isStarted) {
      throw new Error('Tester is not started. Call start() first.');
    }

    return this.client.sendRequest<T>(method, params);
  }

  /**
   * カスタムJSON-RPC通知を送信
   */
  sendNotification(method: string, params?: unknown): void {
    if (!this.isStarted) {
      throw new Error('Tester is not started. Call start() first.');
    }

    this.client.sendNotification(method, params);
  }

  /**
   * サーバーの状態を取得
   */
  getStatus(): ServerStatus {
    return {
      state: this.client.getState(),
      isReady: this.client.isReady(),
      pendingRequests: this.client.getPendingRequestCount(),
      capabilities: this.client.getServerCapabilities(),
    };
  }

  /**
   * 利用可能なツール一覧を取得
   */
  getAvailableTools(): string[] {
    const capabilities = this.client.getServerCapabilities();
    if (capabilities && typeof capabilities === 'object' && 'tools' in capabilities && capabilities.tools) {
      return Object.keys(capabilities.tools as Record<string, unknown>);
    }
    return [];
  }

  /**
   * サーバーが特定の状態になるまで待機
   */
  async waitForState(state: MCPServerState, timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (this.client.getState() !== state) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Timeout waiting for state ${state}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * サーバーが準備完了するまで待機
   */
  async waitUntilReady(timeout = 5000): Promise<void> {
    const startTime = Date.now();

    while (!this.client.isReady()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for server to be ready');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * サーバーを再起動
   */
  async restart(): Promise<void> {
    if (!this.isStarted) {
      throw new Error('Tester is not started');
    }

    await this.client.restart();
  }

  /**
   * テスト環境を停止
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      return;
    }

    await this.client.stop();
    this.isStarted = false;
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.client.cleanup();
    this.isStarted = false;
  }

  /**
   * ログを取得
   * @param filter ログのフィルター条件
   * @returns ログエントリの配列
   */
  getLogs(filter?: { level?: 'stdout' | 'stderr'; since?: Date; limit?: number }): Array<{
    timestamp: Date;
    level: 'stdout' | 'stderr';
    message: string;
  }> {
    return this.client.getLogs(filter);
  }

  /**
   * ログをクリア
   */
  clearLogs(): void {
    this.client.clearLogs();
  }
}

/**
 * MCPサーバーテスターを作成して起動
 *
 * @example
 * ```typescript
 * const tester = await createMCPTester({ serverPath: 'dist/mcp/server.js' });
 * const result = await tester.callTool('operator_status', {});
 * await tester.cleanup();
 * ```
 */
export async function createMCPTester(
  options: MCPDebugClientOptions
): Promise<MCPServiceE2ETester> {
  const tester = new MCPServiceE2ETester(options);
  await tester.start();
  return tester;
}
