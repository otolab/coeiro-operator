/**
 * Speech Tools Unit Tests
 * tools/speech.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SayCoeiroink } from '@coeiro-operator/audio';
import type { OperatorManager, CharacterInfoService, TerminalBackground } from '@coeiro-operator/core';
import { registerSayTool, registerParallelGenerationControlTool } from './speech.js';

describe('Speech Tools', () => {
  let mockServer: McpServer;
  let mockSayCoeiroink: SayCoeiroink;
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

    // SayCoeiroinkのモック
    mockSayCoeiroink = {
      synthesize: vi.fn(),
      setParallelGenerationEnabled: vi.fn(),
      getStreamControllerOptions: vi.fn(),
      getGenerationStats: vi.fn(),
      updateStreamControllerOptions: vi.fn(),
    } as any;

    // OperatorManagerのモック
    mockOperatorManager = {
      showCurrentOperator: vi.fn(),
      getAvailableOperators: vi.fn(),
      refreshOperatorReservation: vi.fn().mockResolvedValue(true),
    } as any;

    // CharacterInfoServiceのモック
    mockCharacterInfoService = {
      getCharacterInfo: vi.fn(),
    } as any;

    // TerminalBackgroundのモック
    mockTerminalBackground = {
      isEnabled: vi.fn(),
      clearBackground: vi.fn(),
    } as any;
  });

  describe('registerSayTool', () => {
    test('ツールが正しく登録されること', () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'say',
        expect.objectContaining({
          description: expect.stringContaining('音声を非同期で出力'),
        }),
        expect.any(Function)
      );
    });

    test('音声合成が成功すること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockSayCoeiroink.synthesize).mockReturnValue({
        success: true,
        taskId: 12345,
        queueLength: 1,
      });
      vi.mocked(mockOperatorManager.refreshOperatorReservation).mockResolvedValue(true);

      const tool = registeredTools.get('say');
      const result = await tool.handler({ message: 'テストメッセージ' });

      expect(result.content[0].text).toContain('音声合成を開始');
      expect(result.content[0].text).toContain('12345');
      expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
        'テストメッセージ',
        expect.objectContaining({
          allowFallback: false,
        })
      );
    });

    test('オペレータ未アサイン時にガイダンスメッセージが返ること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: null,
        characterName: null,
        message: 'オペレータが割り当てられていません',
      });
      vi.mocked(mockOperatorManager.getAvailableOperators).mockResolvedValue({
        available: ['tsukuyomi', 'alma'],
        busy: [],
      });
      vi.mocked(mockTerminalBackground.isEnabled).mockResolvedValue(false);

      const tool = registeredTools.get('say');
      const result = await tool.handler({ message: 'テストメッセージ' });

      expect(result.content[0].text).toContain('オペレータが割り当てられていません');
      expect(result.content[0].text).toContain('operator_assign');
      expect(result.content[0].text).toContain('tsukuyomi');
    });

    test('voice指定時にオペレータなしで動作すること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: null,
        characterName: null,
        message: 'オペレータが割り当てられていません',
      });
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue({
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
      } as any);
      vi.mocked(mockSayCoeiroink.synthesize).mockReturnValue({
        success: true,
        taskId: 12345,
        queueLength: 1,
      });

      const tool = registeredTools.get('say');
      const result = await tool.handler({ message: 'テストメッセージ', voice: 'alma' });

      expect(result.content[0].text).toContain('音声合成を開始');
      expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
        'テストメッセージ',
        expect.objectContaining({
          voice: 'alma',
          allowFallback: false,
        })
      );
    });

    test('voice形式のパースが正しく動作すること（characterId:styleName）', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: null,
        characterName: null,
        message: 'オペレータが割り当てられていません',
      });
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue({
        id: 'alma',
        name: 'ALMA',
        voice_id: 'voice-456',
        styles: {
          normal: {
            styleId: 'normal',
            styleName: 'のーまる',
            personality: 'クールで知的',
            speakingStyle: '敬語',
          },
        },
      } as any);
      vi.mocked(mockSayCoeiroink.synthesize).mockReturnValue({
        success: true,
        taskId: 12345,
        queueLength: 1,
      });

      const tool = registeredTools.get('say');
      await tool.handler({ message: 'テストメッセージ', voice: 'alma:のーまる' });

      expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
        'テストメッセージ',
        expect.objectContaining({
          voice: 'alma',
          style: 'のーまる',
        })
      );
    });

    test('不正なvoice形式でエラーが発生すること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: null,
        characterName: null,
        message: 'オペレータが割り当てられていません',
      });

      const tool = registeredTools.get('say');
      await expect(
        tool.handler({ message: 'テストメッセージ', voice: 'alma:のーまる:extra' })
      ).rejects.toThrow('不正なvoice形式');
    });

    test('rateとfactorの同時指定でエラーが発生すること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });

      const tool = registeredTools.get('say');
      await expect(
        tool.handler({ message: 'テストメッセージ', rate: 200, factor: 1.5 })
      ).rejects.toThrow('rateとfactorは同時に指定できません');
    });

    test('存在しないスタイル指定でエラーが発生すること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue({
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
        },
      } as any);

      const tool = registeredTools.get('say');
      await expect(
        tool.handler({ message: 'テストメッセージ', style: '存在しないスタイル' })
      ).rejects.toThrow('指定されたスタイル \'存在しないスタイル\' が つくよみちゃん には存在しません');
    });

    test('rate指定が正しく渡されること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockSayCoeiroink.synthesize).mockReturnValue({
        success: true,
        taskId: 12345,
        queueLength: 1,
      });
      vi.mocked(mockOperatorManager.refreshOperatorReservation).mockResolvedValue(true);

      const tool = registeredTools.get('say');
      await tool.handler({ message: 'テストメッセージ', rate: 300 });

      expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
        'テストメッセージ',
        expect.objectContaining({
          rate: 300,
        })
      );
    });

    test('factor指定が正しく渡されること', async () => {
      registerSayTool(
        mockServer,
        mockSayCoeiroink,
        mockOperatorManager,
        mockCharacterInfoService,
        mockTerminalBackground
      );

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockSayCoeiroink.synthesize).mockReturnValue({
        success: true,
        taskId: 12345,
        queueLength: 1,
      });
      vi.mocked(mockOperatorManager.refreshOperatorReservation).mockResolvedValue(true);

      const tool = registeredTools.get('say');
      await tool.handler({ message: 'テストメッセージ', factor: 1.5 });

      expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
        'テストメッセージ',
        expect.objectContaining({
          factor: 1.5,
        })
      );
    });
  });

  describe('registerParallelGenerationControlTool', () => {
    test('ツールが正しく登録されること', () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'parallel_generation_control',
        expect.objectContaining({
          description: expect.stringContaining('チャンク並行生成機能の制御'),
        }),
        expect.any(Function)
      );
    });

    test('enableアクションが正しく動作すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      const tool = registeredTools.get('parallel_generation_control');
      const result = await tool.handler({ action: 'enable' });

      expect(mockSayCoeiroink.setParallelGenerationEnabled).toHaveBeenCalledWith(true);
      expect(result.content[0].text).toContain('並行チャンク生成を有効化');
    });

    test('disableアクションが正しく動作すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      const tool = registeredTools.get('parallel_generation_control');
      const result = await tool.handler({ action: 'disable' });

      expect(mockSayCoeiroink.setParallelGenerationEnabled).toHaveBeenCalledWith(false);
      expect(result.content[0].text).toContain('並行チャンク生成を無効化');
    });

    test('statusアクションが正しく動作すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getStreamControllerOptions).mockReturnValue({
        maxConcurrency: 2,
        delayBetweenRequests: 50,
        bufferAheadCount: 1,
        pauseUntilFirstComplete: true,
      });
      vi.mocked(mockSayCoeiroink.getGenerationStats).mockReturnValue({
        activeTasks: 5,
        completedResults: 10,
        totalMemoryUsage: 2048,
      });

      const tool = registeredTools.get('parallel_generation_control');
      const result = await tool.handler({ action: 'status' });

      expect(result.content[0].text).toContain('並行生成ステータス');
      expect(result.content[0].text).toContain('最大並行数: 2');
      expect(result.content[0].text).toContain('アクティブタスク: 5');
    });

    test('update_optionsアクションが正しく動作すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getStreamControllerOptions).mockReturnValue({
        maxConcurrency: 3,
        delayBetweenRequests: 100,
        bufferAheadCount: 2,
        pauseUntilFirstComplete: false,
      });

      const tool = registeredTools.get('parallel_generation_control');
      const result = await tool.handler({
        action: 'update_options',
        options: {
          maxConcurrency: 3,
          delayBetweenRequests: 100,
        },
      });

      expect(mockSayCoeiroink.updateStreamControllerOptions).toHaveBeenCalledWith({
        maxConcurrency: 3,
        delayBetweenRequests: 100,
      });
      expect(result.content[0].text).toContain('オプション更新完了');
    });

    test('update_optionsでoptionsパラメータなしの場合エラーが発生すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      const tool = registeredTools.get('parallel_generation_control');
      await expect(tool.handler({ action: 'update_options' })).rejects.toThrow(
        'update_optionsアクションにはoptionsパラメータが必要です'
      );
    });

    test('無効なアクション指定でエラーが発生すること', async () => {
      registerParallelGenerationControlTool(mockServer, mockSayCoeiroink);

      const tool = registeredTools.get('parallel_generation_control');
      await expect(tool.handler({ action: 'invalid' as any })).rejects.toThrow(
        '並行生成制御エラー'
      );
    });
  });
});
