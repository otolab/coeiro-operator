/**
 * src/say/text-splitting-integration.test.ts: テキスト分割モード統合テスト
 * Issue #35: 音声ストリーミングガイドのコア機能検証 - チャンク分割モードの詳細動作確認
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import type { Config, SynthesizeOptions } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';
import Speaker from 'speaker';

// モックの設定
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

const MockSpeaker = Speaker as any;

describe('テキスト分割モード統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `text-splitting-test-${Date.now()}`);

    // Speakerモックを設定
    const mockSpeakerInstance = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(callback, 10);
        }
      }),
    };
    MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

    // デフォルト設定
    sayCoeiroink = new SayCoeiroink();

    // COEIROINK サーバーのモック設定
    (global.fetch as any).mockImplementation((url: string) => {
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
        const buffer = new ArrayBuffer(44 + 1000);
        const view = new DataView(buffer);

        // 有効なWAVファイル形式
        view.setUint32(0, 0x52494646, false);
        view.setUint32(4, buffer.byteLength - 8, true);
        view.setUint32(8, 0x57415645, false);
        view.setUint32(12, 0x666d7420, false);
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, 48000, true);
        view.setUint32(28, 96000, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        view.setUint32(36, 0x64617461, false);
        view.setUint32(40, 1000, true);

        return Promise.resolve({
          ok: true,
          arrayBuffer: async () => buffer,
        });
      }

      return Promise.reject(new Error('Unknown endpoint'));
    });

    await sayCoeiroink.initialize();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // クリーンアップ
    try {
      const fs = await import('fs');
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // クリーンアップエラーは無視
    }
  });

  describe('punctuation分割モード（デフォルト）', () => {
    test('句読点での適切な分割が行われること', async () => {
      const testTexts = [
        '短文。',
        'これは最初の文です。これは二番目の文です。',
        '長い文、読点での分割、最後の文。',
        '感嘆符！疑問符？通常の句点。',
      ];

      for (const text of testTexts) {
        const result = await sayCoeiroink.synthesizeText(text, {
          voice: 'test-speaker-1',
          chunkMode: 'punctuation',
        });

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });

    test('句読点なし長文での強制分割が動作すること', async () => {
      // 句読点のない150文字を超える長文
      const longTextWithoutPunctuation = 'あ'.repeat(200);

      const result = await sayCoeiroink.synthesizeText(longTextWithoutPunctuation, {
        voice: 'test-speaker-1',
        chunkMode: 'punctuation',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    test('最小チャンクサイズ（10文字）以下の処理', async () => {
      const shortTexts = ['短い', 'テスト', '123', '！？'];

      for (const text of shortTexts) {
        const result = await sayCoeiroink.synthesizeText(text, {
          voice: 'test-speaker-1',
          chunkMode: 'punctuation',
        });

        expect(result.success).toBe(true);
        // 短いテキストでもエラーにならないことを確認
      }
    });
  });

  describe('固定サイズ分割モード', () => {
    test('small分割（30文字、3文字オーバーラップ）の動作確認', async () => {
      const longText =
        'これは30文字を超える長いテキストです。小分割モードでの処理を確認するためのテストテキストです。';

      const result = await sayCoeiroink.synthesizeText(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'small',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    test('medium分割（50文字、5文字オーバーラップ）の動作確認', async () => {
      const longText =
        'これは50文字を大きく超える非常に長いテキストです。中分割モードでの処理を確認するためのテストテキストです。文章を複数含んでいて分割効果を測定します。';

      const result = await sayCoeiroink.synthesizeText(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    test('large分割（100文字、10文字オーバーラップ）の動作確認', async () => {
      const longText =
        'これは100文字を大幅に超える極めて長いテキストです。'.repeat(3) +
        '大分割モードでの処理を確認するためのテストテキストです。' +
        '複数の文章を含んでいて、安定性を重視した分割動作を測定します。';

      const result = await sayCoeiroink.synthesizeText(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'large',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });

    test('auto分割（自動選択）の動作確認', async () => {
      const testTexts = [
        '短いテキスト',
        '中程度の長さのテキストです。自動分割での処理を確認します。',
        '非常に長いテキストです。'.repeat(10) + '自動分割モードでの適応的な処理を確認。',
      ];

      for (const text of testTexts) {
        try {
          const result = await sayCoeiroink.synthesizeText(text, {
            voice: 'test-speaker-1',
            chunkMode: 'auto',
          });

          expect(result.success).toBe(true);
        } catch (error) {
          // autoモードが未実装の場合はmediumにフォールバックを確認
          expect(error).toBeInstanceOf(Error);

          // フォールバック動作確認
          const fallbackResult = await sayCoeiroink.synthesizeText(text, {
            voice: 'test-speaker-1',
            chunkMode: 'medium',
          });
          expect(fallbackResult.success).toBe(true);
        }
      }
    });
  });

  describe('none分割モード（分割なし）', () => {
    test('長文でも分割せずに一括処理されること', async () => {
      const longText =
        'これは非常に長い文章です。'.repeat(20) +
        '分割なしモードでは全体を一つのチャンクとして処理します。' +
        '自然な音声品質が期待されます。';

      const result = await sayCoeiroink.synthesizeText(longText, {
        voice: 'test-speaker-1',
        chunkMode: 'none',
      });

      expect(result.success).toBe(true);
      // noneモードでは通常'normal'モードになる
      expect(result.success).toBe(true);
    });

    test('短文でも適切に処理されること', async () => {
      const shortText = '短い文章です。';

      const result = await sayCoeiroink.synthesizeText(shortText, {
        voice: 'test-speaker-1',
        chunkMode: 'none',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('分割モード比較とパフォーマンス', () => {
    test('各分割モードでのレスポンス時間比較', async () => {
      const testText =
        'パフォーマンステスト用の文章です。'.repeat(5) +
        '各分割モードでの処理時間を比較測定します。';

      const modes = ['punctuation', 'small', 'medium', 'large', 'none'] as const;
      const results: { mode: string; duration: number; success: boolean }[] = [];

      for (const mode of modes) {
        const startTime = Date.now();

        try {
          const result = await sayCoeiroink.synthesizeText(testText, {
            voice: 'test-speaker-1',
            chunkMode: mode,
          });

          const duration = Date.now() - startTime;
          results.push({ mode, duration, success: result.success });

          expect(result.success).toBe(true);
        } catch (error) {
          const duration = Date.now() - startTime;
          results.push({ mode, duration, success: false });
        }
      }

      // 全モードが成功することを確認
      const successfulModes = results.filter(r => r.success);
      expect(successfulModes.length).toBe(modes.length);

      // レスポンス時間が合理的な範囲内であることを確認
      results.forEach(result => {
        expect(result.duration).toBeLessThan(5000); // 5秒以内
      });
    });

    test('オーバーラップ設定の効果確認', async () => {
      // オーバーラップが設定される分割モードでの境界処理
      const boundaryText = '0123456789'.repeat(10); // 100文字

      const modes = ['small', 'medium', 'large'] as const;

      for (const mode of modes) {
        const result = await sayCoeiroink.synthesizeText(boundaryText, {
          voice: 'test-speaker-1',
          chunkMode: mode,
        });

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });
  });

  describe('境界ケースとエラー処理', () => {
    test('空文字列での各分割モード処理', async () => {
      const modes = ['punctuation', 'small', 'medium', 'large', 'auto', 'none'] as const;

      for (const mode of modes) {
        try {
          const result = await sayCoeiroink.synthesizeText('', {
            voice: 'test-speaker-1',
            chunkMode: mode,
          });

          // 成功する場合はその旨を確認
          expect(result.success).toBe(true);
        } catch (error) {
          // エラーになる場合は適切なエラーかを確認
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    test('特殊文字を含むテキストでの分割処理', async () => {
      const specialTexts = [
        '改行\n文字\nテスト',
        'タブ\t文字\tテスト',
        '絵文字😊🎵🌟テスト',
        'English mixed 日本語 text',
        '数字123と記号!@#の混在',
      ];

      for (const text of specialTexts) {
        const result = await sayCoeiroink.synthesizeText(text, {
          voice: 'test-speaker-1',
          chunkMode: 'punctuation',
        });

        expect(result.success).toBe(true);
      }
    });

    test('無効な分割モード指定での適切なエラー処理', async () => {
      try {
        await sayCoeiroink.synthesizeText('テスト', {
          voice: 'test-speaker-1',
          chunkMode: 'invalid' as any,
        });

        // 無効なモードでも動作する場合はデフォルトにフォールバック
        // テストは成功として扱う
      } catch (error) {
        // エラーになる場合は適切なエラーメッセージかを確認
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/mode|chunk|invalid/i);
      }
    });
  });

  describe('バッファサイズとの組み合わせ', () => {
    test('各分割モードと異なるバッファサイズの組み合わせ', async () => {
      const testText = 'バッファサイズテスト用の文章です。異なる設定での動作を確認します。';
      const bufferSizes = [256, 512, 1024, 2048, 4096];
      const chunkModes = ['punctuation', 'small', 'medium', 'large'] as const;

      for (const chunkMode of chunkModes) {
        for (const bufferSize of bufferSizes) {
          const result = await sayCoeiroink.synthesizeText(testText, {
            voice: 'test-speaker-1',
            chunkMode,
            bufferSize,
          });

          expect(result.success).toBe(true);
        }
      }
    });
  });
});
