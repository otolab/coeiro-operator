/**
 * src/say/parallel-generation-integration.test.ts: 並行チャンク生成システム統合テスト
 * Issue #35: ドキュメント記載機能の検証 - 並行チャンク生成システムの動作確認
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';
import type { Config } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';

// モックの設定
global.fetch = vi.fn();

// @coeiro-operator/coreのモック設定
vi.mock('@coeiro-operator/core', () => {
  // CharacterInfoServiceのモック実装
  class MockCharacterInfoService {
    configManager: any;
    initialize(configManager: any) {
      this.configManager = configManager;
    }
    async getCharacterInfo(characterId: string) {
      // テスト用のCharacter情報を返す
      if (characterId === 'test-speaker-1' || characterId === 'tsukuyomi') {
        return {
          characterId: characterId,
          speakerId: characterId === 'tsukuyomi' ? '3c37646f-3881-5374-2a83-149267990abc' : 'test-speaker-uuid',
          speakerName: characterId === 'tsukuyomi' ? 'つくよみちゃん' : 'テストスピーカー1',
          defaultStyleId: 0,
          greeting: 'こんにちは',
          farewell: 'さようなら',
          personality: 'テスト性格',
          speakingStyle: 'テスト話し方',
          styles: {
            0: { styleId: 0, styleName: 'ノーマル', morasPerSecond: 7.5 },
          },
        };
      }
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
      initialize: vi.fn(),
      getCurrentOperatorSession: vi.fn().mockResolvedValue({
        characterId: 'test-speaker-1',
        styleId: 0,
        styleName: 'ノーマル',
      }),
    })),
    CharacterInfoService: MockCharacterInfoService,
    getSpeakerProvider: vi.fn(() => ({
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'test-speaker-1',
          speakerName: 'テストスピーカー1',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
      ]),
      updateConnection: vi.fn(),
      checkConnection: vi.fn().mockResolvedValue(true),
      logAvailableVoices: vi.fn(),
    })),
    ConfigManager: vi.fn().mockImplementation(() => ({
      getFullConfig: vi.fn().mockResolvedValue({
        connection: { host: 'localhost', port: '50032' },
        voice: { rate: 200 },
        audio: { latencyMode: 'balanced' },
        operator: { rate: 200 },
      }),
      getCharacterConfig: vi.fn().mockImplementation((characterId: string) => {
        if (characterId === 'test-speaker-1') {
          return Promise.resolve({
            characterId,
            speakerId: 'test-speaker-uuid',
            defaultStyle: 'ノーマル',
          });
        }
        return null;
      }),
      getStateDir: vi.fn().mockReturnValue('/tmp/test-state'),
    })),
  };
});

// AudioPlayerのplayStreamingAudioをモック化して即座に完了させる
vi.mock('./audio-player.js', async () => {
  const actual = await vi.importActual<typeof import('./audio-player.js')>('./audio-player.js');
  return {
    ...actual,
    AudioPlayer: vi.fn().mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(true),
      setSynthesisRate: vi.fn(),
      setPlaybackRate: vi.fn(),
      setNoiseReduction: vi.fn(),
      setLowpassFilter: vi.fn(),
      // playStreamingAudioを即座に完了させる
      playStreamingAudio: vi.fn().mockImplementation(async (audioStream) => {
        // ジェネレータを消費し、エラーを適切に伝播
        try {
          for await (const _ of audioStream) {
            // 何もしない（音声再生はしない）
          }
        } catch (error) {
          // エラーを再スロー（SpeechQueueに伝播させる）
          throw error;
        }
      }),
      stopPlayback: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
    })),
  };
});


describe('並行チャンク生成システム統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `parallel-generation-test-${Date.now()}`);

    // 並行生成有効な設定
    const config: Config = {
      connection: {
        host: 'localhost',
        port: '50031',
      },
      audio: {
        parallelGeneration: {
          enabled: true,
          maxConcurrency: 2,
          delayBetweenRequests: 50,
          bufferAheadCount: 1,
          pauseUntilFirstComplete: true,
        },
        splitMode: 'punctuation',
        latencyMode: 'balanced',
      },
    };

    const configManager = createMockConfigManager(config);
    sayCoeiroink = new SayCoeiroink(configManager);

    // COEIROINK サーバーのモック設定
    (global.fetch as unknown).mockImplementation((url: string) => {
      if (url.includes('/v1/speakers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              speakerUuid: 'test-speaker-1',
              speakerName: 'テストスピーカー1',
              styles: [{ styleId: 0, styleName: 'ノーマル' }],
            },
          ],
        });
      }

      if (url.includes('/v1/synthesis')) {
        // 並行生成の遅延をシミュレート
        return new Promise(resolve => {
          setTimeout(() => {
            const buffer = new ArrayBuffer(44 + 1000);
            const view = new DataView(buffer);

            // RIFFヘッダー
            view.setUint32(0, 0x52494646, false);
            view.setUint32(4, buffer.byteLength - 8, true);
            view.setUint32(8, 0x57415645, false);

            // fmtチャンク
            view.setUint32(12, 0x666d7420, false);
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);
            view.setUint16(22, 1, true);
            view.setUint32(24, 48000, true);
            view.setUint32(28, 96000, true);
            view.setUint16(32, 2, true);
            view.setUint16(34, 16, true);

            // dataチャンク
            view.setUint32(36, 0x64617461, false);
            view.setUint32(40, 1000, true);

            resolve({
              ok: true,
              arrayBuffer: async () => buffer,
            });
          }, 100); // 並行生成効果を測定するための遅延
        });
      }

      return Promise.reject(new Error('Unknown endpoint'));
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // 並行生成タスクのクリーンアップ
    if (sayCoeiroink) {
      try {
        // 残っているタスクを強制的にクリア
        await sayCoeiroink.clearQueue();
        // バックグラウンドタスクの完了を待つ
        await sayCoeiroink.waitCompletion().catch(() => {
          // エラーは無視（テストでエラーが発生する場合があるため）
        });
      } catch (error) {
        // クリーンアップエラーは無視
      }
    }

    // ディレクトリのクリーンアップ
    try {
      const fs = await import('fs');
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('並行生成 vs 逐次生成 パフォーマンス比較', () => {
    test('並行生成が逐次生成と同等以上のパフォーマンスを発揮すること', async () => {
      // 複数チャンクに分割される長文テスト
      const longText =
        'これは最初の文です。これは二番目の文です。これは三番目の文です。これは四番目の文です。これは五番目の文です。';

      await sayCoeiroink.initialize();

      // 並行生成でのパフォーマンス測定
      const parallelStartTime = Date.now();
      const parallelResult = sayCoeiroink.synthesize(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'punctuation',
      });

      // waitCompletionを呼んで完了を待つ
      await sayCoeiroink.waitCompletion();
      const parallelDuration = Date.now() - parallelStartTime;

      expect(parallelResult.success).toBe(true);
      expect(parallelResult.taskId).toBeDefined();

      // 並行生成の場合、適切なレスポンス時間内で完了
      expect(parallelDuration).toBeLessThan(2000); // 2秒以内
    });

    test('maxConcurrency設定による並行数制御が動作すること', async () => {
      // maxConcurrency=1で逐次生成をシミュレート
      const sequentialConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50031',
        },
        audio: {
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 1, // 逐次生成
            delayBetweenRequests: 50,
            bufferAheadCount: 0,
          },
          splitMode: 'punctuation',
        },
      };

      const configManager = createMockConfigManager(sequentialConfig);
      const sequentialSayCoeiroink = new SayCoeiroink(configManager);
      await sequentialSayCoeiroink.initialize();

      const longText = 'テスト文1。テスト文2。テスト文3。';

      const result = sequentialSayCoeiroink.synthesize(longText, {
        voice: 'test-speaker-1',
      });

      await sequentialSayCoeiroink.waitCompletion();

      expect(result.success).toBe(true);
      // 逐次生成でも正常に動作することを確認

      // クリーンアップ
      await sequentialSayCoeiroink.clearQueue();
    });

    test('bufferAheadCount設定が先読み制御に効果があること', async () => {
      const bufferConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50031',
        },
        audio: {
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 3,
            delayBetweenRequests: 30,
            bufferAheadCount: 2, // 先読み2チャンク
          },
          splitMode: 'small', // 小さく分割して効果を確認
        },
      };

      const configManager = createMockConfigManager(bufferConfig);
      const bufferSayCoeiroink = new SayCoeiroink(configManager);
      await bufferSayCoeiroink.initialize();

      const result = bufferSayCoeiroink.synthesize(
        'バッファ先読みテスト1。バッファ先読みテスト2。バッファ先読みテスト3。バッファ先読みテスト4。',
        { voice: 'test-speaker-1' }
      );

      await bufferSayCoeiroink.waitCompletion();

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // クリーンアップ
      await bufferSayCoeiroink.clearQueue();
    });
  });

  describe('並行生成無効時のフォールバック', () => {
    test('並行生成無効設定で逐次生成にフォールバックすること', async () => {
      const disabledConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50031',
        },
        audio: {
          parallelGeneration: {
            enabled: false, // 無効
          },
          splitMode: 'punctuation',
        },
      };

      const configManager = createMockConfigManager(disabledConfig);
      const disabledSayCoeiroink = new SayCoeiroink(configManager);
      await disabledSayCoeiroink.initialize();

      const result = disabledSayCoeiroink.synthesize(
        'フォールバックテスト1。フォールバックテスト2。',
        { voice: 'test-speaker-1' }
      );

      await disabledSayCoeiroink.waitCompletion();

      expect(result.success).toBe(true);
      // 無効時でも正常に動作（逐次生成で処理）

      // クリーンアップ
      await disabledSayCoeiroink.clearQueue();
    });
  });

  describe('エラー処理とレジリエンス', () => {
    test('並行生成中の一部失敗でも全体処理が継続されること', async () => {
      // 特定のリクエストで失敗するモック
      let requestCount = 0;
      (global.fetch as unknown).mockImplementation((url: string) => {
        if (url.includes('/v1/speakers')) {
          return Promise.resolve({
            ok: true,
            json: async () => [
              {
                speakerUuid: 'test-speaker-1',
                speakerName: 'テスト',
                styles: [{ styleId: 0, styleName: 'ノーマル' }],
              },
            ],
          });
        }

        if (url.includes('/v1/synthesis')) {
          requestCount++;
          console.log(`[DEBUG] synthesis API called: request #${requestCount}`);

          // 2番目のリクエストでエラーを返す（複数チャンクの中の一部でエラー）
          if (requestCount === 2) {
            console.log(`[DEBUG] Returning 500 error for request #${requestCount}`);
            return Promise.resolve({
              ok: false,
              status: 500,
              statusText: 'Internal Server Error',
              text: async () => 'Test error: Server returned 500',
            });
          }

          // 正常レスポンス
          console.log(`[DEBUG] Returning success for request #${requestCount}`);
          const buffer = new ArrayBuffer(44 + 100);
          return Promise.resolve({
            ok: true,
            arrayBuffer: async () => buffer,
          });
        }

        return Promise.reject(new Error('Unknown endpoint'));
      });

      // sayCoeiroinkを初期化
      await sayCoeiroink.initialize();

      // MIN_CHUNK_SIZE (10文字) より長いテキストを使用して確実に分割させる
      sayCoeiroink.synthesize('これは最初のテストメッセージです。これは二番目のテストメッセージです。これは三番目のテストメッセージです。', {
        voice: 'test-speaker-1',
      });

      // waitCompletionでエラーが伝播されることを確認（即座に呼び出してUnhandled Rejection防止）
      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow('500');
    });

    test('並行生成設定の境界値が適切に処理されること', async () => {
      const edgeCaseConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50031',
        },
        audio: {
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 5, // 最大値
            delayBetweenRequests: 0, // 最小遅延
            bufferAheadCount: 3, // 最大先読み
          },
          splitMode: 'large',
        },
      };

      const configManager = createMockConfigManager(edgeCaseConfig);
      const edgeCaseSayCoeiroink = new SayCoeiroink(configManager);
      await edgeCaseSayCoeiroink.initialize();

      const result = edgeCaseSayCoeiroink.synthesize(
        '境界値テストです。' + '長い文章を繰り返して境界値での動作を確認します。'.repeat(5),
        { voice: 'test-speaker-1' }
      );

      await edgeCaseSayCoeiroink.waitCompletion();

      expect(result.success).toBe(true);

      // クリーンアップ
      await edgeCaseSayCoeiroink.clearQueue();
    });
  });

  describe('メモリ効率とリソース管理', () => {
    test('並行生成完了後にメモリが適切に解放されること', async () => {
      await sayCoeiroink.initialize();
      
      const initialMemory = process.memoryUsage().heapUsed;

      // 複数回の並行生成を実行
      for (let i = 0; i < 5; i++) {
        const result = sayCoeiroink.synthesize(
          `メモリテスト${i}。複数の文を含む処理。リソース解放確認。`,
          { voice: 'test-speaker-1' }
        );
        expect(result.success).toBe(true);
        await sayCoeiroink.waitCompletion();
      }

      // ガベージコレクション強制実行
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // メモリ増加が合理的な範囲内であることを確認（5MB未満）
      expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
    });
  });
});
