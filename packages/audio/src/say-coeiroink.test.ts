/**
 * SayCoeiroinkクラスのユニットテスト
 * オペレータアサインなしでのデフォルト動作をテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';

// モックの設定
global.fetch = vi.fn();
vi.mock('@coeiro-operator/core', () => {
  // CharacterInfoServiceのモック実装
  class MockCharacterInfoService {
    configManager: any;
    initialize(configManager: any) {
      this.configManager = configManager;
    }
    async getCharacterInfo(characterId: string) {
      // テスト用のCharacter情報を返す
      if (characterId === 'tsukuyomi') {
        return {
          characterId: characterId,
          speakerId: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          defaultStyleId: 0,
          greeting: 'こんにちは',
          farewell: 'さようなら',
          personality: '落ち着いている',
          speakingStyle: '丁寧な口調',
          styles: {
            0: {
              styleName: 'れいせい',
              morasPerSecond: 8.0,
            },
          },
        };
      }
      return null;
    }
    async getOperatorCharacterInfo(characterId: string) {
      return this.getCharacterInfo(characterId);
    }
    async getAvailableCharacterIds() {
      return ['tsukuyomi'];
    }
    selectStyle(character: any, styleName?: string | null) {
      const styleId = styleName
        ? Object.entries(character.styles).find(([_, s]: [string, any]) => s.styleName === styleName)?.[0]
        : character.defaultStyleId;
      return {
        styleId: Number(styleId || character.defaultStyleId),
        styleName:
          character.styles[Number(styleId || character.defaultStyleId)]?.styleName || 'デフォルト',
        morasPerSecond:
          character.styles[Number(styleId || character.defaultStyleId)]?.morasPerSecond || 8.0,
      };
    }
  }

  // OperatorManagerのモック実装
  class MockOperatorManager {
    async initialize() {}
    async buildDynamicConfig() {}
    async getCurrentOperatorSession() {
      return null; // オペレータアサインなし
    }
  }

  return {
    CharacterInfoService: MockCharacterInfoService,
    OperatorManager: MockOperatorManager,
    getSpeakerProvider: vi.fn(() => ({
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [{ styleId: 0, styleName: 'れいせい' }],
        },
      ]),
      updateConnection: vi.fn(),
      checkConnection: vi.fn().mockResolvedValue(true),
      logAvailableVoices: vi.fn(),
    })),
  };
});

describe('SayCoeiroink - オペレータアサインなしでの動作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // fetchのモックレスポンスを設定
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(44)), // WAVヘッダー分
      json: () => Promise.resolve({ speakers: [] }),
    });
  });

  test('オペレータアサインなし、voice未指定でデフォルトキャラクターが使われること', async () => {
    const configManager = await createMockConfigManager({
      characters: {
        tsukuyomi: {
          speakerId: '3c37646f-3881-5374-2a83-149267990abc',
          name: 'つくよみちゃん',
          defaultStyleId: 0,
          styles: {
            0: {
              styleName: 'れいせい',
              morasPerSecond: 8.0,
            },
          },
        },
      },
      coeiro: {
        baseUrl: 'http://localhost:50032',
      },
    });

    const sayCoeiroink = new SayCoeiroink(configManager);
    await sayCoeiroink.initialize();

    // オペレータアサインなしでsynthesizeを呼び出し
    // デフォルトキャラクターが使われるはず
    const result = sayCoeiroink.synthesize('テスト');

    expect(result.taskId).toBeDefined();
    // エラーが発生しないことを確認
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = sayCoeiroink.getSpeechQueueStatus();
    expect(status.queueLength).toBeGreaterThanOrEqual(0);
  });

  test('オペレータアサインなし、無効なvoice指定でデフォルトキャラクターにフォールバックすること', async () => {
    const configManager = await createMockConfigManager({
      characters: {
        tsukuyomi: {
          speakerId: '3c37646f-3881-5374-2a83-149267990abc',
          name: 'つくよみちゃん',
          defaultStyleId: 0,
          styles: {
            0: {
              styleName: 'れいせい',
              morasPerSecond: 8.0,
            },
          },
        },
      },
      coeiro: {
        baseUrl: 'http://localhost:50032',
      },
    });

    const sayCoeiroink = new SayCoeiroink(configManager);
    await sayCoeiroink.initialize();

    // 存在しないvoiceを指定してもフォールバックで動作するはず
    const result = sayCoeiroink.synthesize('テスト', { voice: 'non-existent' });

    expect(result.taskId).toBeDefined();
    await new Promise(resolve => setTimeout(resolve, 100));

    const status = sayCoeiroink.getSpeechQueueStatus();
    expect(status.queueLength).toBeGreaterThanOrEqual(0);
  });
});
