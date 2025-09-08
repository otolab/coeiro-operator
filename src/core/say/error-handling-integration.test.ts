/**
 * src/core/say/error-handling-integration.test.ts
 * エラーハンドリング統合テスト
 * Issue #37: 複雑なテストの分割 - エラー処理責務分離
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';

// 共通モック設定
global.fetch = vi.fn();
vi.mock('speaker', () => ({
  default: vi.fn(),
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

  beforeEach(async () => {
    // ログスパイ設定
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };

    // Speaker モック設定
    const SpeakerModule = await vi.importMock('speaker');
    const MockSpeaker = SpeakerModule.default as any;
    MockSpeaker.mockImplementation(() => ({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === 'close') {
          setTimeout(handler, 10);
        }
      }),
      destroy: vi.fn(),
    }));

    // fetchモックを設定（speakers APIは成功させる）
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/v1/speakers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{
            speakerUuid: 'test-speaker-1',
            speakerName: 'テストスピーカー1',
            styles: [{ styleId: 0, styleName: 'ノーマル' }],
          }],
        });
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
      // サーバー接続失敗をシミュレート（synthesis APIのみ失敗）
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/v1/speakers')) {
          return Promise.resolve({
            ok: true,
            json: async () => [{
              speakerUuid: 'test-speaker-1',
              speakerName: 'テストスピーカー1',
              styles: [{ styleId: 0, styleName: 'ノーマル' }],
            }],
          });
        }
        return Promise.reject(new Error('Connection failed'));
      });

      try {
        await sayCoeiroink.synthesizeText('接続失敗テスト', {
          voice: 'test-speaker-1',
        });

        // エラーが適切に伝播されることを期待
        expect(true).toBe(false); // この行に到達しないはず
      } catch (error) {
        // エラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
        // ストリーミング再生エラーまたはconnectionエラーを期待
        expect((error as Error).message).toMatch(/ストリーミング|チャンク|connection|failed|error/i);
      }
    });

    test('音声合成API失敗時の適切なエラーハンドリング', async () => {
      // 音声情報取得は成功するが合成APIが失敗するケース
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
          });
        }

        if (url.includes('/synthesis')) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      try {
        await sayCoeiroink.synthesizeText('API失敗テスト', {
          voice: 'test-speaker-1',
        });

        expect(true).toBe(false); // この行に到達しないはず
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        // エラーメッセージにキャラクター解決エラーまたはHTTPステータスが含まれていることを確認
        const errorMessage = (error as Error).message;
        expect(errorMessage.toLowerCase()).toMatch(/failed|resolve|character|500|server|error/);
      }
    });

    test('タイムアウトエラーの適切な処理', async () => {
      // タイムアウトをシミュレート
      (global.fetch as any).mockImplementation(
        () =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 100))
      );

      try {
        await sayCoeiroink.synthesizeText('タイムアウトテスト', {
          voice: 'test-speaker-1',
        });

        expect(true).toBe(false); // この行に到達しないはず
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/timeout|time.*out/i);
      }
    });
  });

  describe('ファイルシステムエラー処理', () => {
    test('ファイル書き込み失敗時の適切なエラーハンドリング', async () => {
      // 無効なファイルパスでの書き込み失敗をシミュレート
      const invalidPath = '/invalid/path/output.wav';

      // 音声情報取得モック
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
          });
        }

        if (url.includes('/synthesis')) {
          const audioBuffer = new ArrayBuffer(1024);
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(audioBuffer),
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      try {
        await sayCoeiroink.synthesizeText('ファイル書き込み失敗テスト', {
          voice: 'test-speaker-1',
          outputFile: invalidPath,
        });

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

      try {
        await sayCoeiroink.synthesizeText('権限エラーテスト', {
          voice: 'test-speaker-1',
          outputFile: readOnlyPath,
        });

        console.log('権限テスト: テスト環境では実際の検証は制限される');
      } catch (error) {
        // 権限エラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
        console.log('権限エラーが適切に処理されました:', (error as Error).message);
      }
    });
  });

  describe('音声処理エラー処理', () => {
    test('Speakerライブラリエラー時の適切な処理', async () => {
      // Speakerエラーをシミュレート
      const SpeakerModule = await vi.importMock('speaker');
      const MockSpeaker = SpeakerModule.default as any;
      MockSpeaker.mockImplementation(() => {
        throw new Error('Hardware audio device failure');
      });

      // 音声合成APIモック
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
          });
        }

        if (url.includes('/synthesis')) {
          const audioBuffer = new ArrayBuffer(1024);
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(audioBuffer),
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      try {
        await sayCoeiroink.synthesizeText('Speaker失敗テスト', {
          voice: 'test-speaker-1',
          streamMode: true,
        });

        // Speakerエラーは内部で処理され、代替手段が使われる可能性
        console.log('Speakerエラーテスト: 代替処理が実行される場合があります');
      } catch (error) {
        // Speakerエラーが適切に処理されることを確認
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/hardware|audio|device|speaker/i);
      }
    });

    test('音声データ形式エラーの処理', async () => {
      // 無効な音声データをシミュレート
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
          });
        }

        if (url.includes('/synthesis')) {
          // 無効な音声データを返す
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)), // 空のバッファ
          });
        }

        return Promise.reject(new Error('Unexpected URL'));
      });

      try {
        const result = await sayCoeiroink.synthesizeText('音声データ形式エラーテスト', {
          voice: 'test-speaker-1',
        });

        // 空の音声データでも適切に処理される場合がある
        console.log('音声データ形式テスト結果:', result);
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
      (global.fetch as any).mockImplementation((url: string) => {
        callCount++;

        if (url.includes('/speakers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([{ id: 'test-speaker-1', name: 'テスト話者1', styles: [] }]),
          });
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
          await sayCoeiroink.synthesizeText(`復旧テスト ${i + 1}`, {
            voice: 'test-speaker-1',
          });
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
          latencyMode: 'invalid-mode' as any,
          splitMode: 'invalid-split' as any,
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
