/**
 * Dictionary Tools Unit Tests
 * tools/dictionary.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DictionaryService } from '@coeiro-operator/core';
import { registerDictionaryRegisterTool } from './dictionary.js';

describe('Dictionary Tools', () => {
  let mockServer: McpServer;
  let mockDictionaryService: DictionaryService;
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

    // DictionaryServiceのモック
    mockDictionaryService = {
      checkConnection: vi.fn(),
      addWord: vi.fn(),
    } as any;
  });

  describe('registerDictionaryRegisterTool', () => {
    test('ツールが正しく登録されること', () => {
      registerDictionaryRegisterTool(mockServer, mockDictionaryService);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'dictionary_register',
        expect.objectContaining({
          description: expect.stringContaining('Register a word in the user dictionary'),
        }),
        expect.any(Function)
      );
    });

    test('単語登録が成功すること', async () => {
      registerDictionaryRegisterTool(mockServer, mockDictionaryService);

      vi.mocked(mockDictionaryService.checkConnection).mockResolvedValue(true);
      vi.mocked(mockDictionaryService.addWord).mockResolvedValue(true);

      const tool = registeredTools.get('dictionary_register');
      const result = await tool.handler({
        word: 'COEIROINK',
        yomi: 'コエイロインク',
        accent: 4,
        numMoras: 7,
      });

      expect(mockDictionaryService.addWord).toHaveBeenCalledWith({
        word: 'COEIROINK',
        yomi: 'コエイロインク',
        accent: 4,
        numMoras: 7,
      });
      expect(result.content[0].text).toContain('単語を辞書に登録しました');
      expect(result.content[0].text).toContain('COEIROINK');
      expect(result.content[0].text).toContain('コエイロインク');
    });

    test('接続エラー時のメッセージが返ること', async () => {
      registerDictionaryRegisterTool(mockServer, mockDictionaryService);

      vi.mocked(mockDictionaryService.checkConnection).mockResolvedValue(false);

      const tool = registeredTools.get('dictionary_register');
      const result = await tool.handler({
        word: 'COEIROINK',
        yomi: 'コエイロインク',
        accent: 4,
        numMoras: 7,
      });

      expect(result.content[0].text).toContain('COEIROINKサーバーに接続できません');
    });

    test('登録失敗時のメッセージが返ること', async () => {
      registerDictionaryRegisterTool(mockServer, mockDictionaryService);

      vi.mocked(mockDictionaryService.checkConnection).mockResolvedValue(true);
      vi.mocked(mockDictionaryService.addWord).mockResolvedValue(false);

      const tool = registeredTools.get('dictionary_register');
      const result = await tool.handler({
        word: 'COEIROINK',
        yomi: 'コエイロインク',
        accent: 4,
        numMoras: 7,
      });

      expect(result.content[0].text).toContain('辞書登録に失敗しました');
    });

    test('エラー時に適切な例外が投げられること', async () => {
      registerDictionaryRegisterTool(mockServer, mockDictionaryService);

      vi.mocked(mockDictionaryService.checkConnection).mockRejectedValue(
        new Error('接続タイムアウト')
      );

      const tool = registeredTools.get('dictionary_register');
      await expect(
        tool.handler({
          word: 'COEIROINK',
          yomi: 'コエイロインク',
          accent: 4,
          numMoras: 7,
        })
      ).rejects.toThrow('辞書登録エラー');
    });
  });
});
