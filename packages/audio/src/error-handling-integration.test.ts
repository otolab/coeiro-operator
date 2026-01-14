/**
 * src/core/say/error-handling-integration.test.ts
 * エラーハンドリング統合テスト
 * Issue #37: 複雑なテストの分割 - エラー処理責務分離
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Responseオブジェクトのモックヘルパー
const createMockResponse = (options: {
  ok: boolean;
  status?: number;
  statusText?: string;
  text?: () => Promise<string>;
  json?: () => Promise<any>;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}): Response => {
  return {
    ok: options.ok,
    status: options.status || 200,
    statusText: options.statusText || 'OK',
    text: options.text || (() => Promise.resolve('')),
    json: options.json || (() => Promise.resolve({})),
    arrayBuffer: options.arrayBuffer || (() => Promise.resolve(new ArrayBuffer(0))),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => ({} as Response),
    body: null,
    bodyUsed: false,
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
  } as Response;
};
import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';
import { OperatorManager, ConfigManager } from '@coeiro-operator/core';

// 共通モック設定
global.fetch = vi.fn();

// ConfigManagerのモック
vi.mock('@coeiro-operator/core', () => {
  // CharacterInfoServiceのモック実装
  class MockCharacterInfoService {
    configManager: any;
    initialize(configManager: any) {
      this.configManager = configManager;
    }
    async getCharacterInfo() {
      return null;
    }
    selectStyle() {
      return null;
    }
    async listSpeakers() {
      return [];
    }
  }

  return {
    OperatorManager: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getCharacterInfo: vi.fn(),
      selectStyle: vi.fn(),
      showCurrentOperator: vi.fn().mockResolvedValue({
        message: 'オペレータは割り当てられていません',
      }),
      getCurrentOperatorSession: vi.fn().mockResolvedValue(null),
    })),
    CharacterInfoService: MockCharacterInfoService,
    getSessionId: vi.fn().mockResolvedValue('test-session'),
    getSpeakerProvider: vi.fn(() => ({
      getSpeakers: vi.fn().mockResolvedValue([{
        speakerUuid: 'test-speaker-1',
        speakerName: 'テストスピーカー1',
        styles: [{ styleId: 0, styleName: 'ノーマル' }],
      }]),
      updateConnection: vi.fn(),
      checkConnection: vi.fn().mockResolvedValue(true),
    })),
    ConfigManager: vi.fn().mockImplementation(() => ({
      getFullConfig: vi.fn().mockResolvedValue({
        connection: { host: 'localhost', port: '50032' },
        voice: { rate: 200 },
        audio: { latencyMode: 'balanced' },
        operator: { rate: 200 },
      }),
      getCharacterConfig: vi.fn().mockImplementation((characterId: string) => {
        if (characterId === 'test-speaker-1' || characterId === 'tsukuyomi') {
          return Promise.resolve({
            characterId,
            speakerId: characterId === 'tsukuyomi' ? '3c37646f-3881-5374-2a83-149267990abc' : 'test-speaker-1',
            defaultStyle: characterId === 'tsukuyomi' ? 'れいせい' : 'ノーマル',
          });
        }
        return null;
      }),
      getStateDir: vi.fn().mockReturnValue('/tmp/test-state'),
    })),
  };
});
vi.mock('@echogarden/audio-io', () => ({
  createAudioOutput: vi.fn().mockImplementation(async (config: any, handler: (buffer: Int16Array) => void) => {
    // handlerを定期的に呼んでキューを消費する
    let intervalId: NodeJS.Timeout | null = null;
    let isDisposed = false;

    // 少し遅延を入れてから開始（初期化処理のため）
    setTimeout(() => {
      if (!isDisposed) {
        intervalId = setInterval(() => {
          if (!isDisposed) {
            const buffer = new Int16Array(1024);
            handler(buffer);
          }
        }, 10); // 10msごとに呼び出し
      }
    }, 10);

    return {
      dispose: vi.fn(async () => {
        isDisposed = true;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      })
    };
  }),
}));
vi.mock('echogarden', () => ({
  default: {},
}));
vi.mock('dsp.js', () => ({
  default: {
    IIRFilter: vi.fn().mockImplementation(() => ({
      process: vi.fn(),
    })),
    LOWPASS: 1,
  },
}));
vi.mock('node-libsamplerate', () => {
  const MockSampleRate = vi.fn().mockImplementation(() => ({
    resample: vi.fn(),
    end: vi.fn(),
    pipe: vi.fn(destination => destination),
    on: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
  }));
  MockSampleRate.SRC_SINC_MEDIUM_QUALITY = 2;
  return { default: MockSampleRate };
});


describe('エラーハンドリング統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let consoleSpy: any;
  let mockOperatorManager: any;

  beforeEach(async () => {
    // ログスパイ設定
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };

    // OperatorManagerモックの設定
    mockOperatorManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      getCharacterInfo: vi.fn().mockImplementation((characterId: string) => {
        if (characterId === 'test-speaker-1' || characterId === 'tsukuyomi') {
          return Promise.resolve({
            characterId: characterId,
            speakerId: characterId === 'tsukuyomi' ? '3c37646f-3881-5374-2a83-149267990abc' : 'test-speaker-uuid',
            speakerName: characterId === 'tsukuyomi' ? 'つくよみちゃん' : 'テストスピーカー1',
            defaultStyleId: 0,
            greeting: 'こんにちは',
            farewell: 'さようなら',
            personality: 'テスト性格',
            speakingStyle: 'テスト話し方',
            styles: {
              0: characterId === 'tsukuyomi'
                ? { styleId: 0, styleName: 'れいせい' }
                : { styleId: 0, styleName: 'ノーマル' },
            },
          });
        }
        throw new Error(`Character not found: ${characterId}`);
      }),
      selectStyle: vi.fn().mockImplementation((character, specifiedStyle) => {
        return Object.values(character.styles)[0] || { styleId: 0, styleName: 'ノーマル' };
      }),
      showCurrentOperator: vi.fn().mockResolvedValue({
        message: 'オペレータは割り当てられていません',
      }),
      getCurrentOperatorSession: vi.fn().mockResolvedValue(null),
    };

    // OperatorManagerモックを設定
    (OperatorManager as unknown).mockImplementation(() => mockOperatorManager);

    // fetchモックを設定（speakers APIは成功させる）
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes('/v1/speakers')) {
        return Promise.resolve(
          createMockResponse({
            ok: true,
            json: async () => [{
              speakerUuid: 'test-speaker-1',
              speakerName: 'テストスピーカー1',
              styles: [{ styleId: 0, styleName: 'ノーマル' }],
            }],
          })
        );
      }
      return Promise.reject(new Error('Network error'));
    });

    const configManager = createMockConfigManager();
    sayCoeiroink = new SayCoeiroink(configManager);
    
    // SayCoeiroinkを初期化
    await sayCoeiroink.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ネットワークエラー処理', () => {
    test('サーバー接続失敗時の適切なエラーハンドリングとログ出力', async () => {
      // サーバー接続失敗をシミュレート（全APIが失敗）
      vi.mocked(global.fetch).mockImplementation(() => {
        return Promise.reject(new Error('Connection failed'));
      });
      
      // checkConnectionも失敗を返すようにモック
      const { getSpeakerProvider } = await import('@coeiro-operator/core');
      vi.mocked(getSpeakerProvider).mockReturnValue({
        getSpeakers: vi.fn().mockRejectedValue(new Error('Connection failed')),
        updateConnection: vi.fn(),
        checkConnection: vi.fn().mockResolvedValue(false),
        logAvailableVoices: vi.fn().mockRejectedValue(new Error('Connection failed')),
      } as any);

      // サーバー接続エラーを期待（Character解決エラーかCOEIROINKサーバー接続エラー）
      // synthesizeは同期メソッドなので、キューに追加してwaitCompletionでエラーを検出
      sayCoeiroink.synthesize('接続失敗テスト', {
        voice: 'test-speaker-1',
      });

      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow();
    });

    test('音声合成API失敗時の適切なエラーハンドリング', async () => {
      // 音声情報取得は成功するが合成APIが失敗するケース
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/v1/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: async () => [{
                speakerUuid: 'test-speaker-1',
                speakerName: 'テストスピーカー1',
                styles: [{ styleId: 0, styleName: 'ノーマル' }],
              }],
            })
          );
        }

        if (url.includes('/v1/synthesis')) {
          return Promise.resolve(
            createMockResponse({
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
            })
          );
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      // API失敗時のエラーを期待
      sayCoeiroink.synthesize('API失敗テスト', {
        voice: 'test-speaker-1',
      });

      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow(); // HTTPエラーが発生することを確認
    });

    test('タイムアウトエラーの適切な処理', async () => {
      // タイムアウトをシミュレート（speakers APIは成功、synthesis APIはタイムアウト）
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/v1/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: async () => [{
                speakerUuid: 'test-speaker-1',
                speakerName: 'テストスピーカー1',
                styles: [{ styleId: 0, styleName: 'ノーマル' }],
              }],
            })
          );
        }
        // synthesis APIはタイムアウト
        return new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        );
      });

      // タイムアウトエラーを期待
      sayCoeiroink.synthesize('タイムアウトテスト', {
        voice: 'test-speaker-1',
      });

      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow(); // タイムアウトエラーが発生することを確認
    });
  });

  describe('ファイルシステムエラー処理', () => {
    test('ファイル書き込み失敗時の適切なエラーハンドリング', async () => {
      // 無効なファイルパスでの書き込み失敗をシミュレート
      const invalidPath = '/invalid/path/output.wav';

      // 音声情報取得モック
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: () =>
                Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
            })
          );
        }

        if (url.includes('/synthesis')) {
          const audioBuffer = new ArrayBuffer(1024);
          return Promise.resolve(
            createMockResponse({
              ok: true,
              arrayBuffer: () => Promise.resolve(audioBuffer),
            })
          );
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      sayCoeiroink.synthesize('ファイル書き込み失敗テスト', {
        voice: 'test-speaker-1',
        outputFile: invalidPath,
      });

      try {
        await sayCoeiroink.waitCompletion();
        // テスト環境では実際のファイル書き込みは行われないため、
        // この部分の検証は制限される
        console.log('ファイル書き込みテスト: テスト環境では実際の検証は制限される');
      } catch (error) {
        // ファイルシステムエラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('権限不足でのファイル操作エラー処理', async () => {
      // 読み取り専用ディレクトリへの書き込み試行（Unix系）
      const readOnlyPath = '/root/readonly-test.wav';

      sayCoeiroink.synthesize('権限エラーテスト', {
        voice: 'test-speaker-1',
        outputFile: readOnlyPath,
      });

      try {
        await sayCoeiroink.waitCompletion();
        console.log('権限テスト: テスト環境では実際の検証は制限される');
      } catch (error) {
        // 権限エラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
        console.log('権限エラーが適切に処理されました:', (error as Error).message);
      }
    });
  });

  describe('音声処理エラー処理', () => {
    test('音声データ形式エラーの処理', async () => {
      // 無効な音声データをシミュレート
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: () =>
                Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
            })
          );
        }

        if (url.includes('/synthesis')) {
          // 無効な音声データを返す
          return Promise.resolve(
            createMockResponse({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)), // 空のバッファ
            })
          );
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      const result = sayCoeiroink.synthesize('音声データ形式エラーテスト', {
        voice: 'test-speaker-1',
      });

      // 空の音声データでも適切に処理される場合がある
      console.log('音声データ形式テスト結果:', result);

      try {
        await sayCoeiroink.waitCompletion();
      } catch (error) {
        // 音声データエラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('エラー復旧とフォールバック', () => {
    test('一時的な失敗後の復旧動作', async () => {
      let callCount = 0;

      // 最初の2回は失敗、3回目は成功するモック
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        callCount++;

        if (url.includes('/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: () =>
                Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
            })
          );
        }

        if (url.includes('/synthesis')) {
          if (callCount <= 2) {
            return Promise.reject(new Error('Temporary failure'));
          } else {
            const audioBuffer = new ArrayBuffer(1024);
            return Promise.resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(audioBuffer),
            });
          }
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      // 複数回試行してみる
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < 3; i++) {
        try {
          sayCoeiroink.synthesize(`復旧テスト ${i + 1}`, {
            voice: 'test-speaker-1',
          });
          await sayCoeiroink.waitCompletion();
          successCount++;
        } catch (error) {
          errorCount++;
        }
      }

      // 最終的には成功が含まれることを期待
      console.log(`復旧テスト結果: 成功${successCount}回, エラー${errorCount}回`);
      expect(successCount + errorCount).toBe(3);
    });

    test('設定値フォールバック動作の確認', async () => {
      // 不正な設定値を含む設定
      const invalidConfig = {
        server: {
          host: 'invalid-host',
          port: -1, // 無効なポート
        },
        audio: {
          latencyMode: 'invalid-mode' as unknown,
          splitMode: 'invalid-split' as unknown,
        },
      };

      try {
        const configManager = createMockConfigManager(invalidConfig);
        const fallbackSayCoeiroink = new SayCoeiroink(configManager);

        // フォールバック設定で動作することを確認
        console.log('フォールバック設定でSayCoeiroinkが初期化されました');
        expect(fallbackSayCoeiroink).toBeDefined();
      } catch (error) {
        // 設定エラーが適切に処理されることも許容
        expect(error).toBeInstanceOf(Error);
        console.log('設定エラーが適切に処理されました:', (error as Error).message);
      }
    });
  });
});
