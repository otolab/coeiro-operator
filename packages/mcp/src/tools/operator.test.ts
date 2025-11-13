/**
 * Operator Tools Unit Tests
 * tools/operator.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { OperatorManager, CharacterInfoService, TerminalBackground, Character } from '@coeiro-operator/core';
import {
  registerOperatorAssignTool,
  registerOperatorReleaseTool,
  registerOperatorStatusTool,
  registerOperatorAvailableTool,
  registerOperatorStylesTool,
} from './operator.js';

describe('Operator Tools', () => {
  let mockServer: McpServer;
  let mockOperatorManager: OperatorManager;
  let mockCharacterInfoService: CharacterInfoService;
  let mockTerminalBackground: TerminalBackground;
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

    // OperatorManagerのモック
    mockOperatorManager = {
      assignSpecificOperator: vi.fn(),
      assignRandomOperator: vi.fn(),
      releaseOperator: vi.fn(),
      showCurrentOperator: vi.fn(),
      getAvailableOperators: vi.fn(),
    } as any;

    // CharacterInfoServiceのモック
    mockCharacterInfoService = {
      getCharacterInfo: vi.fn(),
    } as any;

    // TerminalBackgroundのモック
    mockTerminalBackground = {
      isEnabled: vi.fn(),
      switchCharacter: vi.fn(),
      clearBackground: vi.fn(),
    } as any;
  });

  describe('registerOperatorAssignTool', () => {
    test('ツールが正しく登録されること', () => {
      registerOperatorAssignTool(
        mockServer,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'operator_assign',
        expect.objectContaining({
          description: expect.stringContaining('オペレータを割り当てます'),
        }),
        expect.any(Function)
      );
    });

    test('オペレータ割り当てが成功すること', async () => {
      registerOperatorAssignTool(
        mockServer,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      const mockAssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        currentStyle: {
          styleId: 'normal',
          styleName: 'ノーマル',
          personality: '素直で優しい',
          speakingStyle: '丁寧語',
        },
        speakerConfig: {
          speakerId: 'speaker-123',
          styleId: 0,
        },
      };

      const mockCharacter: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直で優しい',
        speakingStyle: '丁寧語',
        styles: {
          0: {
            styleName: 'ノーマル',
            personality: '素直で優しい',
            speakingStyle: '丁寧語',
            disabled: false,
          },
        },
      };

      vi.mocked(mockOperatorManager.assignSpecificOperator).mockResolvedValue(mockAssignResult);
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(false);

      const tool = registeredTools.get('operator_assign');
      const result = await tool.handler({ operator: 'tsukuyomi' });

      expect(result.content[0].text).toContain('つくよみちゃん');
      expect(result.content[0].text).toContain('ノーマル');
    });

    test('オペレータ割り当てでエラーが発生すること', async () => {
      registerOperatorAssignTool(
        mockServer,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.assignSpecificOperator).mockRejectedValue(
        new Error('オペレータが見つかりません')
      );

      const tool = registeredTools.get('operator_assign');
      await expect(tool.handler({ operator: 'invalid' })).rejects.toThrow(
        'オペレータ割り当てエラー'
      );
    });

    test('背景画像が切り替わること', async () => {
      registerOperatorAssignTool(
        mockServer,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      const mockAssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        currentStyle: {
          styleId: '0',
          styleName: 'ノーマル',
          personality: '素直',
          speakingStyle: '丁寧語',
        },
        speakerConfig: {
          speakerId: 'speaker-123',
          styleId: 0,
        },
      };

      const mockCharacter: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {},
      };

      vi.mocked(mockOperatorManager.assignSpecificOperator).mockResolvedValue(mockAssignResult);
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(true);

      const tool = registeredTools.get('operator_assign');
      await tool.handler({ operator: 'tsukuyomi' });

      expect(mockTerminalBackground.switchCharacter).toHaveBeenCalledWith('tsukuyomi');
    });
  });

  describe('registerOperatorReleaseTool', () => {
    test('ツールが正しく登録されること', () => {
      registerOperatorReleaseTool(mockServer, mockOperatorManager, mockTerminalBackground);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'operator_release',
        expect.objectContaining({
          description: expect.stringContaining('現在のオペレータを解放'),
        }),
        expect.any(Function)
      );
    });

    test('オペレータ解放が成功すること', async () => {
      registerOperatorReleaseTool(mockServer, mockOperatorManager, mockTerminalBackground);

      vi.mocked(mockOperatorManager.releaseOperator).mockResolvedValue({
        wasAssigned: true,
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
      });
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(false);

      const tool = registeredTools.get('operator_release');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('オペレータを解放しました');
      expect(result.content[0].text).toContain('つくよみちゃん');
    });

    test('未割り当て時のメッセージが返ること', async () => {
      registerOperatorReleaseTool(mockServer, mockOperatorManager, mockTerminalBackground);

      vi.mocked(mockOperatorManager.releaseOperator).mockResolvedValue({
        wasAssigned: false,
      });
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(false);

      const tool = registeredTools.get('operator_release');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('オペレータは割り当てられていません');
    });

    test('背景画像がクリアされること', async () => {
      registerOperatorReleaseTool(mockServer, mockOperatorManager, mockTerminalBackground);

      vi.mocked(mockOperatorManager.releaseOperator).mockResolvedValue({
        wasAssigned: true,
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
      });
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(true);

      const tool = registeredTools.get('operator_release');
      await tool.handler({});

      expect(mockTerminalBackground.clearBackground).toHaveBeenCalled();
    });
  });

  describe('registerOperatorStatusTool', () => {
    test('ツールが正しく登録されること', () => {
      registerOperatorStatusTool(mockServer, mockOperatorManager);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'operator_status',
        expect.objectContaining({
          description: expect.stringContaining('現在のオペレータ状況を確認'),
        }),
        expect.any(Function)
      );
    });

    test('ステータスが取得できること', async () => {
      registerOperatorStatusTool(mockServer, mockOperatorManager);

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        message: '現在のオペレータ: つくよみちゃん',
      });

      const tool = registeredTools.get('operator_status');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('つくよみちゃん');
    });
  });

  describe('registerOperatorAvailableTool', () => {
    test('ツールが正しく登録されること', () => {
      registerOperatorAvailableTool(mockServer, mockOperatorManager);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'operator_available',
        expect.objectContaining({
          description: expect.stringContaining('利用可能なオペレータ一覧'),
        }),
        expect.any(Function)
      );
    });

    test('利用可能なオペレータ一覧が取得できること', async () => {
      registerOperatorAvailableTool(mockServer, mockOperatorManager);

      vi.mocked(mockOperatorManager.getAvailableOperators).mockResolvedValue({
        available: ['tsukuyomi', 'alma'],
        busy: ['mana'],
      });

      const tool = registeredTools.get('operator_available');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('tsukuyomi');
      expect(result.content[0].text).toContain('alma');
      expect(result.content[0].text).toContain('mana');
    });

    test('利用可能なオペレータがいない場合のメッセージが返ること', async () => {
      registerOperatorAvailableTool(mockServer, mockOperatorManager);

      vi.mocked(mockOperatorManager.getAvailableOperators).mockResolvedValue({
        available: [],
        busy: [],
      });

      const tool = registeredTools.get('operator_available');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('利用可能なオペレータがありません');
    });
  });

  describe('registerOperatorStylesTool', () => {
    test('ツールが正しく登録されること', () => {
      registerOperatorStylesTool(mockServer, mockOperatorManager, mockCharacterInfoService);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'operator_styles',
        expect.objectContaining({
          description: expect.stringContaining('利用可能なスタイル一覧'),
        }),
        expect.any(Function)
      );
    });

    test('現在のオペレータのスタイル一覧が取得できること', async () => {
      registerOperatorStylesTool(mockServer, mockOperatorManager, mockCharacterInfoService);

      const mockCharacter: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {
          0: {
            styleName: 'ノーマル',
            personality: '素直で優しい',
            speakingStyle: '丁寧語',
            disabled: false,
          },
          1: {
            styleName: 'ハッピー',
            personality: '明るく元気',
            speakingStyle: '関西弁',
            disabled: false,
          },
        },
      };

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);

      const tool = registeredTools.get('operator_styles');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('つくよみちゃん');
      expect(result.content[0].text).toContain('ノーマル');
      expect(result.content[0].text).toContain('ハッピー');
    });

    test('指定したキャラクターのスタイル一覧が取得できること', async () => {
      registerOperatorStylesTool(mockServer, mockOperatorManager, mockCharacterInfoService);

      const mockCharacter: Character = {
        characterId: 'alma',
        speakerId: 'speaker-456',
        speakerName: 'ALMA',
        defaultStyleId: 0,
        greeting: 'Hello',
        farewell: 'Goodbye',
        personality: 'クールで知的',
        speakingStyle: '敬語',
        styles: {
          0: {
            styleName: 'のーまる',
            personality: 'クールで知的',
            speakingStyle: '敬語',
            disabled: false,
          },
        },
      };

      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);

      const tool = registeredTools.get('operator_styles');
      const result = await tool.handler({ character: 'alma' });

      expect(result.content[0].text).toContain('ALMA');
      expect(result.content[0].text).toContain('のーまる');
    });

    test('存在しないキャラクター指定時にエラーが発生すること', async () => {
      registerOperatorStylesTool(mockServer, mockOperatorManager, mockCharacterInfoService);

      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(null);

      const tool = registeredTools.get('operator_styles');
      await expect(tool.handler({ character: 'invalid' })).rejects.toThrow(
        'スタイル情報取得エラー'
      );
    });
  });
});
