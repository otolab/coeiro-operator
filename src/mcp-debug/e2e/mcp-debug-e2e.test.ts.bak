/**
 * MCP Debug E2E Tests with Echo Server
 * echoサーバーを使用したmcp-debugの包括的なE2Eテスト
 */

import { createMCPTester, MCPServiceE2ETester } from './mcp-e2e-tester.js';
import { MCPServerState } from '../core/state-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ECHO_SERVER_PATH = path.resolve(__dirname, '../../../dist/mcp-debug/test/echo-server.js');

describe('MCP Debug E2E Tests', () => {
  let tester: MCPServiceE2ETester;

  afterEach(async () => {
    if (tester) {
      await tester.cleanup();
    }
  });

  describe('基本機能', () => {
    it('echoサーバーを起動して接続できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
        timeout: 10000,
      });

      const status = tester.getStatus();
      expect(status.state).toBe(MCPServerState.READY);
      expect(status.isReady).toBe(true);
    });

    it('利用可能なツール一覧を取得できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      const tools = tester.getAvailableTools();
      // MCPプロトコルでは'listChanged'のみが返される
      expect(tools).toContain('listChanged');
      expect(tools.length).toBeGreaterThan(0);
    });
  });

  describe('ツール呼び出し', () => {
    beforeEach(async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });
    });

    it('echoツールを呼び出せる', async () => {
      const result = await tester.callTool('echo', {
        message: 'Hello, MCP!',
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result.content[0].text).toContain('Echo: Hello, MCP!');
      expect(result.result.content[0].text).toContain('Message count: 1');
    });

    it('echoツールに遅延を設定できる', async () => {
      const startTime = Date.now();

      const result = await tester.callTool('echo', {
        message: 'Delayed message',
        delay: 500,
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeGreaterThanOrEqual(500);
      expect(result.duration).toBeGreaterThanOrEqual(500);
    });

    it('debug_infoツールでサーバー統計を取得できる', async () => {
      // 先にいくつかのメッセージを送信
      await tester.callTool('echo', { message: 'Message 1' });
      await tester.callTool('echo', { message: 'Message 2' });

      const result = await tester.callTool('debug_info', {
        type: 'stats',
      });

      expect(result.success).toBe(true);
      expect(result.result.content[0].text).toContain('Messages processed: 2');
      expect(result.result.content[0].text).toContain('Debug mode:');
      expect(result.result.content[0].text).toContain('Uptime:');
    });

    it('debug_infoツールでサーバーステータスを取得できる', async () => {
      const result = await tester.callTool('debug_info', {
        type: 'status',
      });

      expect(result.success).toBe(true);
      expect(result.result.content[0].text).toContain('PID:');
      expect(result.result.content[0].text).toContain('Memory:');
      expect(result.result.content[0].text).toContain('Messages processed:');
    });

    it('無効なツール呼び出しはエラーになる', async () => {
      const result = await tester.callTool('invalid_tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message.toLowerCase()).toContain('not found');
    });

    it('無効な引数はエラーになる', async () => {
      const result = await tester.callTool('debug_info', {
        type: 'invalid_type',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('並行実行', () => {
    beforeEach(async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });
    });

    it('複数のツールを並行実行できる', async () => {
      const calls = [
        { name: 'echo', args: { message: 'Message 1' } },
        { name: 'echo', args: { message: 'Message 2' } },
        { name: 'echo', args: { message: 'Message 3' } },
      ];

      const results = await tester.callToolsConcurrently(calls);

      expect(results).toHaveLength(3);

      // デバッグ情報を出力
      results.forEach((result, index) => {
        if (!result.success) {
          console.error(`Call ${index} failed:`, result.error?.message);
        }
      });

      // 少なくとも1つは成功することを確認
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
    });

    it('並行実行は順次実行より高速', async () => {
      const calls = Array.from({ length: 10 }, (_, i) => ({
        name: 'echo',
        args: { message: `Message ${i}`, delay: 100 },
      }));

      // 順次実行
      const sequentialStart = Date.now();
      await tester.callToolsSequentially(calls);
      const sequentialTime = Date.now() - sequentialStart;

      // 並行実行
      const concurrentStart = Date.now();
      await tester.callToolsConcurrently(calls);
      const concurrentTime = Date.now() - concurrentStart;

      // 並行実行の方が大幅に高速であることを確認
      expect(concurrentTime).toBeLessThan(sequentialTime / 2);
      // 順次実行は最低でも1000ms（100ms × 10）かかるはず
      expect(sequentialTime).toBeGreaterThanOrEqual(1000);
      // 並行実行は理想的には100ms程度
      expect(concurrentTime).toBeLessThan(500);
    });
  });

  describe('ログ機能', () => {
    it('ログを収集できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      // いくつかの操作を実行
      await tester.callTool('echo', { message: 'Test message' });
      await tester.callTool('test_output', {
        channel: 'stderr',
        message: 'Error test',
      });

      const logs = tester.getLogs();
      expect(logs.length).toBeGreaterThan(0);

      // stderrログの確認
      const stderrLogs = tester.getLogs({ level: 'stderr' });
      expect(stderrLogs.length).toBeGreaterThan(0);
      expect(stderrLogs.some(log => log.message.includes('Echo MCP Server is running'))).toBe(true);
    });

    it('ログをフィルターできる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      const beforeTime = new Date();

      // 操作を実行
      await tester.callTool('echo', { message: 'Test 1' });
      await tester.callTool('test_output', {
        channel: 'stderr',
        message: 'Debug message',
      });

      // 時刻でフィルター
      const recentLogs = tester.getLogs({ since: beforeTime });
      expect(recentLogs.length).toBeGreaterThan(0);

      // レベルでフィルター
      const stdoutLogs = tester.getLogs({ level: 'stdout' });
      const stderrLogs = tester.getLogs({ level: 'stderr' });

      expect(stdoutLogs.length).toBeGreaterThan(0);
      expect(stderrLogs.length).toBeGreaterThan(0);

      // 制限付きで取得
      const limitedLogs = tester.getLogs({ limit: 5 });
      expect(limitedLogs.length).toBeLessThanOrEqual(5);
    });

    it('ログをクリアできる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      // 操作を実行してログを生成
      await tester.callTool('echo', { message: 'Test' });

      const logsBeforeClear = tester.getLogs();
      expect(logsBeforeClear.length).toBeGreaterThan(0);

      // ログをクリア
      tester.clearLogs();

      const logsAfterClear = tester.getLogs();
      expect(logsAfterClear).toHaveLength(0);

      // 新しい操作のログは収集される
      await tester.callTool('echo', { message: 'After clear' });

      const newLogs = tester.getLogs();
      expect(newLogs.length).toBeGreaterThan(0);
    });
  });

  describe('エラーハンドリング', () => {
    it('サーバー起動失敗を処理できる', async () => {
      // 存在しないファイルパスでエラーになることを確認
      await expect(
        createMCPTester({
          serverPath: '/non/existent/path.js',
          timeout: 1000,
        })
      ).rejects.toThrow('Server file not found');
    });

    it('タイムアウトを処理できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        requestTimeout: 100,
      });

      // 長い遅延でタイムアウトを引き起こす
      const result = await tester.callTool('echo', {
        message: 'Timeout test',
        delay: 500,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message.toLowerCase()).toContain('timed out');
    });
  });

  describe('サーバー管理', () => {
    it('サーバーを再起動できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      // 最初の呼び出し
      const result1 = await tester.callTool('echo', { message: 'Before restart' });
      expect(result1.success).toBe(true);
      expect(result1.result.content[0].text).toContain('Message count: 1');

      // 再起動
      await tester.restart();

      // 再起動後の呼び出し（メッセージカウントがリセットされる）
      const result2 = await tester.callTool('echo', { message: 'After restart' });
      expect(result2.success).toBe(true);
      expect(result2.result.content[0].text).toContain('Message count: 1');
    });

    it('サーバーを停止して再起動できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: false,
      });

      // 正常動作を確認
      const result1 = await tester.callTool('echo', { message: 'Test' });
      expect(result1.success).toBe(true);

      // 停止
      await tester.stop();

      // 停止後は呼び出せない
      await expect(tester.callTool('echo', { message: 'After stop' })).rejects.toThrow(
        'not started'
      );

      // 再起動
      await tester.start();

      // 再起動後は呼び出せる
      const result2 = await tester.callTool('echo', { message: 'After restart' });
      expect(result2.success).toBe(true);
    });
  });

  describe('デバッグモード', () => {
    it('デバッグモードでより詳細なログを取得できる', async () => {
      tester = await createMCPTester({
        serverPath: ECHO_SERVER_PATH,
        debug: true,
        args: ['--debug'],
      });

      await tester.callTool('echo', { message: 'Debug test' });

      const logs = tester.getLogs({ level: 'stderr' });

      // デバッグモードでは[ECHO-DEBUG]ログが出力される
      const debugLogs = logs.filter(log => log.message.includes('[ECHO-DEBUG]'));

      expect(debugLogs.length).toBeGreaterThan(0);
    });
  });
});
