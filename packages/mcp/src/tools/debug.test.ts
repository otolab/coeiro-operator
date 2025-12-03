/**
 * Debug Tools Unit Tests
 * tools/debug.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger } from '@coeiro-operator/common';
import { registerDebugLogsTool } from './debug.js';

// loggerをモック
vi.mock('@coeiro-operator/common', () => ({
  logger: {
    getLogEntries: vi.fn(),
    getLogStats: vi.fn(),
    clearLogEntries: vi.fn(),
    isAccumulating: vi.fn(),
  },
}));

describe('Debug Tools', () => {
  let mockServer: McpServer;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = new Map();

    // モックサーバーの作成
    mockServer = {
      registerTool: vi.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('registerDebugLogsTool', () => {
    test('ツールが正しく登録されること', () => {
      registerDebugLogsTool(mockServer);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'debug_logs',
        expect.objectContaining({
          description: expect.stringContaining('Retrieve and display debug logs'),
        }),
        expect.any(Function)
      );
    });

    test('getアクションでログが取得できること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogEntries).mockReturnValue([
        {
          level: 'info',
          timestamp: '2025-01-01T00:00:00.000Z',
          message: 'テストログ1',
          args: [],
          formatted: '[INFO] 2025-01-01T00:00:00.000Z テストログ1',
        },
        {
          level: 'error',
          timestamp: '2025-01-01T00:01:00.000Z',
          message: 'テストログ2',
          args: ['追加情報'],
          formatted: '[ERROR] 2025-01-01T00:01:00.000Z テストログ2 追加情報',
        },
      ]);

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'get', format: 'formatted' });

      expect(result.content[0].text).toContain('ログエントリ (2件)');
      expect(result.content[0].text).toContain('テストログ1');
      expect(result.content[0].text).toContain('テストログ2');
      expect(result.content[0].text).toContain('[INFO]');
      expect(result.content[0].text).toContain('[ERROR]');
    });

    test('getアクションでログが空の場合のメッセージが返ること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogEntries).mockReturnValue([]);

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'get', format: 'formatted' });

      expect(result.content[0].text).toContain('条件に一致するログエントリが見つかりませんでした');
    });

    test('getアクションでlevelフィルタが適用されること', async () => {
      registerDebugLogsTool(mockServer);

      const tool = registeredTools.get('debug_logs');
      await tool.handler({ action: 'get', level: ['error'] });

      expect(logger.getLogEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          level: ['error'],
        })
      );
    });

    test('getアクションでsinceフィルタが適用されること', async () => {
      registerDebugLogsTool(mockServer);

      const tool = registeredTools.get('debug_logs');
      await tool.handler({ action: 'get', since: '2025-01-01T00:00:00.000Z' });

      expect(logger.getLogEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          since: expect.any(Date),
        })
      );
    });

    test('getアクションでlimitが適用されること', async () => {
      registerDebugLogsTool(mockServer);

      const tool = registeredTools.get('debug_logs');
      await tool.handler({ action: 'get', limit: 50 });

      expect(logger.getLogEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });

    test('getアクションでsearchフィルタが適用されること', async () => {
      registerDebugLogsTool(mockServer);

      const tool = registeredTools.get('debug_logs');
      await tool.handler({ action: 'get', search: 'エラー' });

      expect(logger.getLogEntries).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'エラー',
        })
      );
    });

    test('getアクションでraw形式が選択できること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogEntries).mockReturnValue([
        {
          level: 'info',
          timestamp: '2025-01-01T00:00:00.000Z',
          message: 'テストログ',
          args: [],
          formatted: '[INFO] 2025-01-01T00:00:00.000Z テストログ',
        },
      ]);

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'get', format: 'raw' });

      expect(result.content[0].text).toContain('ログエントリ (1件)');
      // JSON形式での出力を確認
      expect(result.content[0].text).toMatch(/"level":\s*"info"/);
    });

    test('getアクションで無効な日時形式の場合も処理されること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogEntries).mockReturnValue([
        {
          level: 'info',
          timestamp: '2025-01-01T00:00:00.000Z',
          message: 'テストログ',
          args: [],
          formatted: '[INFO] 2025-01-01T00:00:00.000Z テストログ',
        },
      ]);

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'get', since: 'invalid-date' });

      // 無効な日時でもエラーにならず、Invalid Dateオブジェクトが作成されて処理される
      expect(logger.getLogEntries).toHaveBeenCalled();
      expect(result.content[0].text).toContain('ログエントリ');
    });

    test('statsアクションで統計情報が取得できること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogStats).mockReturnValue({
        totalEntries: 100,
        entriesByLevel: {
          quiet: 0,
          error: 5,
          warn: 10,
          info: 50,
          verbose: 20,
          debug: 15,
        },
        oldestEntry: '2025-01-01T00:00:00.000Z',
        newestEntry: '2025-01-01T12:00:00.000Z',
      });
      vi.mocked(logger.isAccumulating).mockReturnValue(true);

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'stats' });

      expect(result.content[0].text).toContain('総エントリ数: 100');
      expect(result.content[0].text).toContain('ERROR: 5');
      expect(result.content[0].text).toContain('WARN:  10');
      expect(result.content[0].text).toContain('INFO:  50');
      expect(result.content[0].text).toContain('蓄積モード: ON');
    });

    test('clearアクションでログがクリアされること', async () => {
      registerDebugLogsTool(mockServer);

      vi.mocked(logger.getLogStats).mockReturnValue({
        totalEntries: 50,
        entriesByLevel: {
          quiet: 0,
          error: 0,
          warn: 0,
          info: 0,
          verbose: 0,
          debug: 0,
        },
      });

      const tool = registeredTools.get('debug_logs');
      const result = await tool.handler({ action: 'clear' });

      expect(logger.clearLogEntries).toHaveBeenCalled();
      expect(result.content[0].text).toContain('50件削除');
    });

    test('無効なアクション指定でエラーが発生すること', async () => {
      registerDebugLogsTool(mockServer);

      const tool = registeredTools.get('debug_logs');
      await expect(tool.handler({ action: 'invalid' as any })).rejects.toThrow(
        'ログ取得エラー'
      );
    });
  });
});
