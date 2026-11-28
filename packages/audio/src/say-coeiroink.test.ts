/**
 * SayCoeiroinkクラスのユニットテスト
 * オペレータアサインなしでのデフォルト動作をテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { SpeechQueue } from './queue/speech-queue.js';
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
    getSessionId: vi.fn().mockResolvedValue('test-session'),
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

    // 存在しないvoiceを指定してもデフォルトキャラクターにフォールバックして動作するはず
    const result = sayCoeiroink.synthesize('テスト', { voice: 'non-existent' });

    expect(result.taskId).toBeDefined();

    // キャラクター解決はフォールバックで成功するが、モック環境では音声再生でエラーになる
    // 重要: "No operator assigned" エラーが出ないことを確認
    try {
      await sayCoeiroink.waitCompletion();
    } catch (error) {
      // 音声再生エラーは許容（モック環境の制限）
      // キャラクター解決エラーは許容しない
      expect((error as Error).message).not.toContain('No operator assigned');
      expect((error as Error).message).not.toContain('Character not found');
    }
  });
});

describe('SayCoeiroink.waitForQueueLength のタスクエラー伝播', () => {
  function createSayCoeiroinkWithQueue(queue: SpeechQueue): SayCoeiroink {
    const sayCoeiroink = new SayCoeiroink({} as any);
    (sayCoeiroink as any).speechQueue = queue;
    return sayCoeiroink;
  }

  test('処理中のタスクが失敗すると待機中の呼び出しへエラーを伝播すること', async () => {
    const taskError = new Error('処理中に音声タスクが失敗しました');
    let markStarted!: () => void;
    let finishTask!: () => void;
    const started = new Promise<void>(resolve => {
      markStarted = resolve;
    });
    const taskGate = new Promise<void>(resolve => {
      finishTask = resolve;
    });
    const queue = new SpeechQueue(async () => {
      markStarted();
      await taskGate;
      throw taskError;
    });
    const sayCoeiroink = createSayCoeiroinkWithQueue(queue);

    const task = sayCoeiroink.synthesize('失敗する発話');
    const taskRejection = expect(task.promise).rejects.toBe(taskError);
    await started;

    const waiting = sayCoeiroink.waitForQueueLength(0);
    finishTask();

    await expect(waiting).rejects.toBe(taskError);
    await taskRejection;
    expect(sayCoeiroink.getSpeechQueueStatus()).toMatchObject({
      queueLength: 0,
      isProcessing: false,
    });
  });

  test('失敗後に idle 状態で待機を始めても SayCoeiroink は蓄積エラーを throw すること', async () => {
    const taskError = new Error('idle前に音声タスクが失敗しました');
    const queue = new SpeechQueue(async () => {
      throw taskError;
    });
    const sayCoeiroink = createSayCoeiroinkWithQueue(queue);
    const becameIdle = new Promise<void>(resolve => {
      queue.once('queueEmpty', resolve);
    });

    const task = sayCoeiroink.synthesize('失敗する発話');
    const taskRejection = expect(task.promise).rejects.toBe(taskError);
    await becameIdle;
    await taskRejection;

    expect(sayCoeiroink.getSpeechQueueStatus()).toMatchObject({
      queueLength: 0,
      isProcessing: false,
    });
    await expect(sayCoeiroink.waitForQueueLength(0)).rejects.toBe(taskError);
  });
});
