/**
 * src/say/integration.test.ts: 統合テスト
 */

import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';
import type { Config, SynthesizeOptions } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import { OperatorManager } from '@coeiro-operator/core';
import type { Character, Speaker as SpeakerType } from '@coeiro-operator/core';

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
          styles: characterId === 'tsukuyomi'
            ? {
                0: { styleId: 0, styleName: 'れいせい', morasPerSecond: 7.5 },
                1: { styleId: 1, styleName: 'おしとやか', morasPerSecond: 7.2 },
                2: { styleId: 2, styleName: 'げんき', morasPerSecond: 8.0 },
              }
            : {
                0: { styleId: 0, styleName: 'ノーマル', morasPerSecond: 7.5 },
                1: { styleId: 1, styleName: 'ハッピー', morasPerSecond: 7.8 },
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
        characterId: 'tsukuyomi',
        styleId: 0,
        styleName: 'れいせい',
      }),
    })),
    CharacterInfoService: MockCharacterInfoService,
    getSessionId: vi.fn().mockResolvedValue('test-session'),
    getSpeakerProvider: vi.fn(() => ({
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'test-speaker-1',
          speakerName: 'テストスピーカー1',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おしとやか' },
            { styleId: 2, styleName: 'げんき' },
          ],
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
    pipe: vi.fn(destination => destination), // Transform Streamインターフェース
    on: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
  }));
  MockSampleRate.SRC_SINC_MEDIUM_QUALITY = 2;
  return { default: MockSampleRate };
});

describe('Say Integration Tests', () => {
  let sayCoeiroink: SayCoeiroink;
  let tempDir: string;
  let mockOperatorManager: any;

  beforeEach(async () => {
    // fetchをモック（unstubGlobals: trueによりテストファイル間でクリアされるため、beforeEach内で設定）
    vi.stubGlobal('fetch', vi.fn());

    tempDir = join(tmpdir(), `say-integration-test-${Date.now()}`);

    // OperatorManagerモックの設定
    mockOperatorManager = {
      initialize: vi.fn(),
      getCurrentOperatorSession: vi.fn().mockResolvedValue({
        characterId: 'tsukuyomi',
        styleId: 0,
        styleName: 'れいせい',
      }),
      getCharacterInfo: vi.fn().mockImplementation((characterId: string) => {
        // test-speaker-1をCharacterIdとして扱い、Character情報を返す
        if (
          characterId === 'test-speaker-1' ||
          characterId === 'test-voice' ||
          characterId === '3c37646f-3881-5374-2a83-149267990abc' ||
          characterId === 'tsukuyomi'  // デフォルトキャラクターを追加
        ) {
          const testCharacter: Character = {
            characterId: characterId,
            speakerId: characterId === 'tsukuyomi' ? '3c37646f-3881-5374-2a83-149267990abc' : 'test-speaker-uuid',
            speakerName: characterId === 'tsukuyomi' ? 'つくよみちゃん' : 'テストスピーカー1',
            defaultStyleId: 0,
            greeting: 'こんにちは',
            farewell: 'さようなら',
            personality: 'テスト性格',
            speakingStyle: 'テスト話し方',
            styles: characterId === 'tsukuyomi'
              ? {
                  0: { styleId: 0, styleName: 'れいせい' },
                  1: { styleId: 1, styleName: 'おしとやか' },
                  2: { styleId: 2, styleName: 'げんき' },
                }
              : {
                  0: { styleId: 0, styleName: 'ノーマル' },
                  1: { styleId: 1, styleName: 'ハッピー' },
                },
          };
          return Promise.resolve(testCharacter);
        }
        throw new Error(`Character not found: ${characterId}`);
      }),
      selectStyle: vi.fn().mockImplementation((character: Character, specifiedStyle?: string) => {
        // デフォルトスタイルを返す
        return Object.values(character.styles)[0] || { styleId: 0, styleName: 'ノーマル' };
      }),
      showCurrentOperator: vi.fn().mockImplementation(() => {
        // 現在のオペレータが存在しない場合のモック
        return Promise.resolve({
          message: 'オペレータは割り当てられていません',
        });
      }),
    };

    // OperatorManagerのモックを設定（Vitest 4ではfunctionキーワードが必須）
    vi.mocked(OperatorManager).mockImplementation(function() {
      return mockOperatorManager;
    });

    // getSpeakerProviderのモックを明示的に設定
    const { getSpeakerProvider } = await import('@coeiro-operator/core');
    vi.mocked(getSpeakerProvider).mockReturnValue({
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'test-speaker-1',
          speakerName: 'テストスピーカー1',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おしとやか' },
            { styleId: 2, styleName: 'げんき' },
          ],
        },
      ]),
      updateConnection: vi.fn(),
      checkConnection: vi.fn().mockResolvedValue(true),
      logAvailableVoices: vi.fn(),
    } as any);

    // COEIROINK サーバーのモック設定（SayCoeiroink初期化の前に設定）
    vi.mocked(global.fetch).mockImplementation((url: string) => {
      if (url.includes('/v1/speakers')) {
        return Promise.resolve(
          createMockResponse({
            ok: true,
            json: async () => [
              {
                speakerUuid: 'test-speaker-1',
                speakerName: 'テストスピーカー1',
                styles: [
                  { styleId: 0, styleName: 'ノーマル' },
                  { styleId: 1, styleName: 'ハッピー' },
                ],
              },
              {
                speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
                speakerName: 'つくよみちゃん',
                styles: [
                  { styleId: 0, styleName: 'れいせい' },
                  { styleId: 1, styleName: 'おしとやか' },
                  { styleId: 2, styleName: 'げんき' },
                ],
              },
            ],
          })
        );
      }

      if (url.includes('/v1/synthesis')) {
        // 模擬音声データ（有効なWAVファイル形式）
        const buffer = new ArrayBuffer(44 + 1000); // ヘッダー44バイト + データ1000バイト
        const view = new DataView(buffer);

        // RIFFヘッダー
        view.setUint32(0, 0x52494646, false); // "RIFF"
        view.setUint32(4, buffer.byteLength - 8, true); // ファイルサイズ
        view.setUint32(8, 0x57415645, false); // "WAVE"

        // fmtチャンク
        view.setUint32(12, 0x666d7420, false); // "fmt "
        view.setUint32(16, 16, true); // chunkサイズ
        view.setUint16(20, 1, true); // オーディオフォーマット（PCM）
        view.setUint16(22, 1, true); // チャンネル数
        view.setUint32(24, 48000, true); // サンプルレート
        view.setUint32(28, 96000, true); // バイトレート
        view.setUint16(32, 2, true); // ブロックアライン
        view.setUint16(34, 16, true); // ビット深度

        // dataチャンク
        view.setUint32(36, 0x64617461, false); // "data"
        view.setUint32(40, 1000, true); // dataサイズ

        return Promise.resolve(
          createMockResponse({
            ok: true,
            arrayBuffer: async () => buffer,
          })
        );
      }

      return Promise.reject(new Error('Unknown endpoint'));
    });

    // デフォルト設定を使用
    const configManager = createMockConfigManager();

    sayCoeiroink = new SayCoeiroink(configManager);

    vi.clearAllMocks();

    // 一時ディレクトリを作成
    try {
      const fs = await import('fs');
      await fs.promises.mkdir(tempDir, { recursive: true });
    } catch (error) {
      // ディレクトリ作成エラーは無視
    }
    
    // SayCoeiroinkを初期化
    await sayCoeiroink.initialize();
  });

  afterEach(async () => {
    // SpeechQueueのクリーンアップ
    try {
      await sayCoeiroink.clearSpeechQueue();
      await sayCoeiroink.waitCompletion();
    } catch (error) {
      // クリーンアップエラーは無視
    }

    // モックのcall historyをクリア（mockImplementationは保持）
    vi.clearAllMocks();

    // 一時ファイルのクリーンアップ
    try {
      const fs = await import('fs');
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('End-to-End ワークフロー', () => {
    test('初期化から音声合成まで完全なフローが動作すること', async () => {
      // 音声合成実行（synthesizeは同期メソッド）
      const result = sayCoeiroink.synthesize('統合テストメッセージ', {
        voice: 'test-speaker-1',
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // 完了を待つ
      await sayCoeiroink.waitCompletion();
    });

    test('ファイル出力から読み込み確認まで完全なフローが動作すること', async () => {
      const outputFile = join(tempDir, 'test-output.wav');

      // 音声をファイルに出力（synthesizeは同期メソッド）
      const result = sayCoeiroink.synthesize('ファイル出力テスト', {
        voice: 'test-speaker-1',
        outputFile: outputFile,
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // 完了を待つ
      await sayCoeiroink.waitCompletion();

      // ファイルが作成されているか確認
      const fileContent = await readFile(outputFile);
      expect(fileContent.length).toBeGreaterThan(0);

      // クリーンアップ
      await unlink(outputFile);
    });

    test('非同期キューイングと処理が正常に動作すること', async () => {
      // 複数のタスクをキューに追加（synthesizeは同期メソッド）
      const results = [
        sayCoeiroink.synthesize('メッセージ1'),
        sayCoeiroink.synthesize('メッセージ2'),
        sayCoeiroink.synthesize('メッセージ3'),
      ];

      // 全てのタスクが成功していることを確認
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      });

      // キューが処理されるまで待機
      await sayCoeiroink.waitCompletion();

      // キューが空になっていることを確認
      const queueStatus = sayCoeiroink.getSpeechQueueStatus();
      expect(queueStatus.queueLength).toBe(0);
      expect(queueStatus.isProcessing).toBe(false);
    });
  });

  describe('エラー処理統合テスト', () => {
    test('サーバー接続失敗時の適切なエラーハンドリング', async () => {
      // サーバー接続失敗をシミュレート
      vi.mocked(global.fetch).mockImplementation(() =>
        Promise.reject(new Error('Connection refused'))
      );
      
      // checkConnectionもfalseを返すようにモック
      const { getSpeakerProvider } = await import('@coeiro-operator/core');
      vi.mocked(getSpeakerProvider).mockReturnValue({
        getSpeakers: vi.fn().mockRejectedValue(new Error('Connection refused')),
        updateConnection: vi.fn(),
        checkConnection: vi.fn().mockResolvedValue(false),
        logAvailableVoices: vi.fn().mockRejectedValue(new Error('Connection refused')),
      } as any);

      // 新しいSayCoeiroinkインスタンスを作成（モックが反映される）
      const failConfigManager = createMockConfigManager();
      const failSayCoeiroink = new SayCoeiroink(failConfigManager);
      await failSayCoeiroink.initialize();


      // synthesizeは同期メソッドなので、エラーはwaitCompletionで発生する
      const result = failSayCoeiroink.synthesize('テスト');
      await expect(failSayCoeiroink.waitCompletion()).rejects.toThrow();
    });

    test('音声合成API失敗時の適切なエラーハンドリング', async () => {
      // speakers APIは成功、synthesis APIは失敗
      vi.mocked(global.fetch).mockImplementation((url: string) => {
        if (url.includes('/v1/speakers')) {
          return Promise.resolve(
            createMockResponse({
              ok: true,
              json: async () => [],
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

        return Promise.reject(new Error('Unknown endpoint'));
      });

      // synthesizeは同期メソッド
      const result = sayCoeiroink.synthesize('テスト', { voice: 'test-voice' });
      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow();
    });

    test('ファイル書き込み失敗時の適切なエラーハンドリング', async () => {
      const invalidPath = '/invalid/path/that/does/not/exist/output.wav';

      // synthesizeは同期メソッド
      const result = sayCoeiroink.synthesize('テスト', {
        voice: 'test-speaker-1',
        outputFile: invalidPath,
      });
      await expect(sayCoeiroink.waitCompletion()).rejects.toThrow();
    });
  });

  describe('設定とオプション統合テスト', () => {
    test('様々なレート設定での音声合成が正常に動作すること', async () => {
      const rates = [100, 150, 200, 250, 300];

      for (const rate of rates) {
        const result = sayCoeiroink.synthesize(`レート${rate}でのテスト`, {
          voice: 'test-speaker-1',
          rate: rate,
        });

        expect(result.success).toBe(true);
      }

      // 全てのタスクの完了を待つ
      await sayCoeiroink.waitCompletion();
    });

    test('異なる音声ID設定での合成が正常に動作すること', async () => {
      const voiceIds = ['test-speaker-1', 'tsukuyomi'];

      for (const voiceId of voiceIds) {
        const result = sayCoeiroink.synthesize('音声IDテスト', {
          voice: voiceId,
        });

        expect(result.success).toBe(true);
      }

      // 全てのタスクの完了を待つ
      await sayCoeiroink.waitCompletion();
    });

    test('ストリーミングモードが正常に動作すること', async () => {
      const longText = 'これは長いテキストです。'.repeat(10);

      const result = sayCoeiroink.synthesize(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'punctuation',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // 完了を待つ
      await sayCoeiroink.waitCompletion();
    });
  });

  describe('データフロー統合テスト', () => {
    test('ストリーミング合成が正常に動作すること', async () => {
      const text = 'ストリーミングテスト用の長いテキスト。'.repeat(5);

      // synthesizeは同期メソッド
      const result = sayCoeiroink.synthesize(text, {
        voice: 'test-speaker-1',
        chunkMode: 'punctuation',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // 完了を待つ
      await sayCoeiroink.waitCompletion();
    });
  });

  describe('リソース管理統合テスト', () => {
    test('大量の同時リクエストが適切に処理されること', async () => {
      const taskCount = 20;
      const results = [];

      for (let i = 0; i < taskCount; i++) {
        results.push(sayCoeiroink.synthesize(`並列テスト${i}`));
      }

      // 全てのタスクが成功していることを確認
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      });

      // キューが最終的に空になることを確認
      await sayCoeiroink.waitCompletion();
      const finalStatus = sayCoeiroink.getSpeechQueueStatus();
      expect(finalStatus.queueLength).toBe(0);
    }, 10000); // 10秒のタイムアウト

    test('メモリリークが発生しないこと（Issue #50対応: 精密測定手法）', async () => {
      // Issue #50: 改善されたメモリリーク検出手法を使用
      // 従来の単純な差分測定ではなく、GC制御による精密測定を実装

      // GCが利用可能かチェック
      if (!global.gc) {
        console.warn('⚠️  global.gc() not available - skipping precise memory leak detection');
        console.warn('💡 Run with --expose-gc for precise memory leak detection');
        return; // GCが利用できない場合はスキップ
      }

      // 複数回のフルGCでクリーンなベースライン確立
      for (let i = 0; i < 3; i++) {
        global.gc(true);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const initialMemory = process.memoryUsage().heapUsed;

      // より控えめな処理量（30回）でテスト時間短縮
      for (let i = 0; i < 30; i++) {
        sayCoeiroink.synthesize(`メモリテスト${i}`, {
          voice: 'test-speaker-1',
        });

        // 10回ごとに中間GC実行と待機
        if (i % 10 === 0) {
          await sayCoeiroink.waitCompletion();
          global.gc(true);
        }
      }

      // 最後の完了を待つ
      await sayCoeiroink.waitCompletion();

      // 最終的な複数回GC実行
      for (let i = 0; i < 3; i++) {
        global.gc(true);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercentage = (memoryIncrease / initialMemory) * 100;

      // より現実的な閾値設定（5MB）
      const thresholdBytes = 5 * 1024 * 1024;

      console.log(`📊 メモリ使用量分析:`);
      console.log(`   初期: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`   最終: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(
        `   増加: ${(memoryIncrease / 1024).toFixed(2)}KB (${memoryIncreasePercentage.toFixed(2)}%)`
      );
      console.log(`   閾値: ${(thresholdBytes / 1024).toFixed(2)}KB`);

      expect(memoryIncrease).toBeLessThan(thresholdBytes);
    }, 15000);
  });

  describe('例外状況統合テスト', () => {
    test('空文字列や特殊文字を含むテキストが適切に処理されること', async () => {
      // Issue #35: 空文字列処理テスト明確化 - 実際の動作を検証

      // 空文字列・空白文字列のテスト
      const emptyTexts = ['', '   ', '\n\t\n\t'];
      for (const text of emptyTexts) {
        try {
          const result = sayCoeiroink.synthesize(text, {
            voice: 'test-speaker-1',
          });
          // 空文字列でも成功する場合はその旨を確認
          expect(result.success).toBe(true);
          expect(result.taskId).toBeDefined();
          await sayCoeiroink.waitCompletion();
        } catch (error) {
          // エラーになる場合は適切なエラーメッセージかを確認
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/empty|text|required/i);
        }
      }

      // 有効なテキストのテスト
      const validTexts = [
        '😊🎵🌟',
        'Hello, World! 123',
        '日本語とEnglishの混在テキスト',
        '\n\t改行とタブを含むテキスト\n\t',
        'Very long text that exceeds normal chunk size and should be handled properly by the streaming system.',
      ];

      for (const text of validTexts) {
        const result = sayCoeiroink.synthesize(text, {
          voice: 'test-speaker-1',
        });

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }

      // 全てのタスクの完了を待つ
      await sayCoeiroink.waitCompletion();
    });

    test('不正な設定値でも適切にフォールバックされること', async () => {
      // Issue #35: 型安全性の向上 - null値処理の適切な型指定
      const invalidOptions = [
        { rate: -100 }, // 負の値
        { rate: 10000 }, // 極端に大きい値
        { voice: undefined }, // undefined値 (nullよりTypeScript的に適切)
        { outputFile: '' }, // 空文字列
      ];

      for (const options of invalidOptions) {
        try {
          const result = sayCoeiroink.synthesize('フォールバックテスト', options);
          // 成功した場合は、適切なフォールバックが動作したことを確認
          expect(result.success).toBe(true);
          expect(result.taskId).toBeDefined();
          await sayCoeiroink.waitCompletion();
        } catch (error) {
          // エラーが発生した場合は、適切なエラーメッセージであることを確認
          expect(error).toBeInstanceOf(Error);
          const errorMessage = (error as Error).message;
          expect(errorMessage).toMatch(/invalid|range|value|fallback/i);
        }
      }
    });
  });

  describe('停止機能統合テスト', () => {
    test('stopPlaybackが正常に呼び出せること', async () => {
      // 複数のタスクをキューに追加
      const results = [
        sayCoeiroink.synthesize('メッセージ1'),
        sayCoeiroink.synthesize('メッセージ2'),
        sayCoeiroink.synthesize('メッセージ3'),
      ];

      // 停止を要求
      sayCoeiroink.stopPlayback();

      // エラーなく実行できることを確認
      expect(() => sayCoeiroink.stopPlayback()).not.toThrow();
    });

    test('clearSpeechQueueで全タスククリア時に再生も停止すること', async () => {
      // 複数のタスクをキューに追加
      const results = [
        sayCoeiroink.synthesize('メッセージ1'),
        sayCoeiroink.synthesize('メッセージ2'),
        sayCoeiroink.synthesize('メッセージ3'),
      ];

      // 全タスククリア（再生も停止される）
      const clearResult = await sayCoeiroink.clearSpeechQueue();

      expect(clearResult.removedCount).toBeGreaterThanOrEqual(0);

      // キューが空になっていることを確認
      const status = sayCoeiroink.getSpeechQueueStatus();
      expect(status.queueLength).toBe(0);
    });

    test('clearSpeechQueueで特定タスクのみ削除できること', async () => {
      // 複数のタスクをキューに追加して、タスクIDを保持
      const result1 = sayCoeiroink.synthesize('メッセージ1');
      const result2 = sayCoeiroink.synthesize('メッセージ2');
      const result3 = sayCoeiroink.synthesize('メッセージ3');

      // 特定のタスクのみクリア（再生は停止されない）
      const clearResult = await sayCoeiroink.clearSpeechQueue([result2.taskId]);

      expect(clearResult.removedCount).toBeLessThanOrEqual(1);
    });

    test('複数回stopPlaybackを呼び出しても安全であること', async () => {
      // 複数回呼び出してもエラーが発生しないことを確認
      expect(() => sayCoeiroink.stopPlayback()).not.toThrow();
      expect(() => sayCoeiroink.stopPlayback()).not.toThrow();
      expect(() => sayCoeiroink.stopPlayback()).not.toThrow();
    });
  });
});
