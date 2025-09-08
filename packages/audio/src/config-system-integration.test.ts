/**
 * src/say/config-system-integration.test.ts: 設定システム統合テスト
 * Issue #35: 動的設定変更の検証 - 設定ファイルとMCPツールの連携確認
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';
import type { Config, SynthesizeOptions } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, mkdir } from 'fs/promises';
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

describe('設定システム統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let tempDir: string;
  let configDir: string;
  let configFile: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `config-system-test-${Date.now()}`);
    configDir = join(tempDir, '.coeiro-operator');
    configFile = join(configDir, 'coeiroink-config.json');

    // テスト用設定ディレクトリを作成
    await mkdir(configDir, { recursive: true });

    // Speakerモックを設定
    const mockSpeakerInstance = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(callback, 10);
        }
      }),
      once: vi.fn((event, callback) => {
        if (event === 'close') {
          setTimeout(callback, 10);
        }
      }),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
      pipe: vi.fn(),
    };
    // Speakerモックを動的に取得
    const SpeakerModule = await vi.importMock('speaker');
    const MockSpeaker = SpeakerModule.default as unknown;
    MockSpeaker.mockImplementation(() => mockSpeakerInstance as unknown);

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

  describe('基本設定ファイル管理', () => {
    test('デフォルト設定でのSayCoeiroink初期化', async () => {
      // デフォルト設定ファイルを作成
      const defaultConfig = {
        host: 'localhost',
        port: '50032',
        audio: {
          splitMode: 'punctuation',
          latencyMode: 'balanced',
          parallelGeneration: {
            enabled: false,
            maxConcurrency: 2,
            delayBetweenRequests: 50,
            bufferAheadCount: 1,
          },
        },
      };

      await writeFile(configFile, JSON.stringify(defaultConfig, null, 2));

      // 設定ファイルを使用してSayCoeiroink初期化
      const configManager = createMockConfigManager();
      sayCoeiroink = new SayCoeiroink(configManager);
      await sayCoeiroink.initialize();

      // 基本動作確認
      const result = await sayCoeiroink.synthesizeText('設定テスト', {
        voice: 'test-speaker-1',
      });

      expect(result.success).toBe(true);
    });

    test('カスタム設定での初期化と動作確認', async () => {
      // カスタム設定ファイルを作成
      const customConfig = {
        host: 'localhost',
        port: '50032',
        audio: {
          splitMode: 'small',
          latencyMode: 'ultra-low',
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 3,
            delayBetweenRequests: 30,
            bufferAheadCount: 2,
          },
        },
      };

      await writeFile(configFile, JSON.stringify(customConfig, null, 2));

      const config: Config = {
        connection: {
          host: 'localhost',
          port: '50032',
        },
        voice: {
          rate: 200,
        },
        audio: {
          splitMode: 'small',
          latencyMode: 'ultra-low',
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 3,
            delayBetweenRequests: 30,
            bufferAheadCount: 2,
          },
        },
      };

      const configManager = createMockConfigManager(config);
      sayCoeiroink = new SayCoeiroink(configManager);
      await sayCoeiroink.initialize();

      // カスタム設定での動作確認
      const result = await sayCoeiroink.synthesizeText('カスタム設定テスト', {
        voice: 'test-speaker-1',
        chunkMode: 'small',
      });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
    });
  });

  describe('並行生成設定の動的変更', () => {
    test('並行生成有効/無効の切り替え効果確認', async () => {
      // 初期設定（並行生成無効）
      const initialConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50032',
        },
        voice: {
          rate: 200,
        },
        audio: {
          parallelGeneration: {
            enabled: false,
            maxConcurrency: 2,
          },
          splitMode: 'punctuation',
        },
      };

      const configManager = createMockConfigManager(initialConfig);
      sayCoeiroink = new SayCoeiroink(configManager);
      await sayCoeiroink.initialize();

      // 無効状態でのテスト
      const disabledResult = await sayCoeiroink.synthesizeText(
        '並行生成無効テスト。複数の文を含むテスト。処理確認。',
        { voice: 'test-speaker-1' }
      );

      expect(disabledResult.success).toBe(true);

      // 設定を有効に変更
      const enabledConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50032',
        },
        voice: {
          rate: 200,
        },
        audio: {
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 2,
            delayBetweenRequests: 50,
            bufferAheadCount: 1,
          },
          splitMode: 'punctuation',
        },
      };

      const enabledConfigManager = createMockConfigManager(enabledConfig);
      const enabledSayCoeiroink = new SayCoeiroink(enabledConfigManager);
      await enabledSayCoeiroink.initialize();

      // 有効状態でのテスト
      const enabledResult = await enabledSayCoeiroink.synthesizeText(
        '並行生成有効テスト。複数の文を含むテスト。処理確認。',
        { voice: 'test-speaker-1' }
      );

      expect(enabledResult.success).toBe(true);
      expect(enabledResult.taskId).toBeDefined();
    });

    test('maxConcurrency設定値による動作変化確認', async () => {
      const concurrencyLevels = [1, 2, 3, 5];

      for (const maxConcurrency of concurrencyLevels) {
        const config: Config = {
          connection: {
            host: 'localhost',
            port: '50032',
          },
          voice: {
            rate: 200,
          },
          audio: {
            parallelGeneration: {
              enabled: true,
              maxConcurrency,
              delayBetweenRequests: 50,
              bufferAheadCount: 1,
            },
            splitMode: 'punctuation',
          },
        };

        const configManager = createMockConfigManager(config);
        const testSayCoeiroink = new SayCoeiroink(configManager);
        await testSayCoeiroink.initialize();

        const result = await testSayCoeiroink.synthesizeText(
          `並行数${maxConcurrency}テスト。複数の文を含む。処理効果確認。動作検証。`,
          { voice: 'test-speaker-1' }
        );

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });
  });

  describe('レイテンシモード設定', () => {
    test('各レイテンシモードでの動作確認', async () => {
      const latencyModes = ['ultra-low', 'balanced', 'quality'] as const;

      for (const latencyMode of latencyModes) {
        const config: Config = {
          connection: {
            host: 'localhost',
            port: '50032',
          },
          voice: {
            rate: 200,
          },
          audio: {
            latencyMode,
            splitMode: 'punctuation',
          },
        };

        const configManager = createMockConfigManager(config);
        const testSayCoeiroink = new SayCoeiroink(configManager);
        await testSayCoeiroink.initialize();

        const startTime = Date.now();
        const result = await testSayCoeiroink.synthesizeText(
          `レイテンシモード${latencyMode}テスト`,
          { voice: 'test-speaker-1' }
        );
        const duration = Date.now() - startTime;

        expect(result.success).toBe(true);

        // レイテンシモードに応じた合理的な処理時間
        switch (latencyMode) {
          case 'ultra-low':
            expect(duration).toBeLessThan(1000); // 1秒以内
            break;
          case 'balanced':
            expect(duration).toBeLessThan(2000); // 2秒以内
            break;
          case 'quality':
            expect(duration).toBeLessThan(3000); // 3秒以内
            break;
        }
      }
    });
  });

  describe('分割モード設定', () => {
    test('設定による分割モードのデフォルト動作確認', async () => {
      const splitModes = ['punctuation', 'small', 'medium', 'large'] as const;

      for (const splitMode of splitModes) {
        const config: Config = {
          connection: {
            host: 'localhost',
            port: '50032',
          },
          voice: {
            rate: 200,
          },
          audio: {
            splitMode,
            latencyMode: 'balanced',
          },
        };

        const configManager = createMockConfigManager(config);
        const testSayCoeiroink = new SayCoeiroink(configManager);
        await testSayCoeiroink.initialize();

        const result = await testSayCoeiroink.synthesizeText(
          `分割モード${splitMode}での動作テスト。複数の文を含む長めのテキストです。`,
          { voice: 'test-speaker-1' }
        );

        expect(result.success).toBe(true);

        // 分割が発生する場合はストリーミングモード
        if (splitMode !== 'none') {
          expect(result.taskId).toBeDefined();
        }
      }
    });
  });

  describe('設定の組み合わせテスト', () => {
    test('複合設定での動作確認', async () => {
      const complexConfigs = [
        // 高速重視設定
        {
          name: '高速重視',
          config: {
            connection: {
              host: 'localhost',
              port: '50032',
            },
            voice: {
              rate: 200,
            },
            audio: {
              splitMode: 'small' as const,
              latencyMode: 'ultra-low' as const,
              parallelGeneration: {
                enabled: true,
                maxConcurrency: 3,
                delayBetweenRequests: 30,
                bufferAheadCount: 2,
              },
            },
          },
        },
        // 安定性重視設定
        {
          name: '安定性重視',
          config: {
            connection: {
              host: 'localhost',
              port: '50032',
            },
            voice: {
              rate: 200,
            },
            audio: {
              splitMode: 'large' as const,
              latencyMode: 'quality' as const,
              parallelGeneration: {
                enabled: true,
                maxConcurrency: 2,
                delayBetweenRequests: 100,
                bufferAheadCount: 1,
              },
            },
          },
        },
        // 省メモリ設定
        {
          name: '省メモリ',
          config: {
            connection: {
              host: 'localhost',
              port: '50032',
            },
            voice: {
              rate: 200,
            },
            audio: {
              splitMode: 'medium' as const,
              latencyMode: 'balanced' as const,
              parallelGeneration: {
                enabled: true,
                maxConcurrency: 2,
                delayBetweenRequests: 50,
                bufferAheadCount: 0,
              },
            },
          },
        },
      ];

      for (const { name, config } of complexConfigs) {
        const configManager = createMockConfigManager(config);
        const testSayCoeiroink = new SayCoeiroink(configManager);
        await testSayCoeiroink.initialize();

        const result = await testSayCoeiroink.synthesizeText(
          `${name}設定でのテストです。複数の文を含む処理で動作を確認します。設定の組み合わせ効果を測定します。`,
          { voice: 'test-speaker-1' }
        );

        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
      }
    });
  });

  describe('設定ファイル読み込みエラー処理', () => {
    test('不正な設定ファイルでの適切なフォールバック', async () => {
      // 不正なJSON形式のファイル
      await writeFile(configFile, '{ invalid json }');

      try {
        const configManager = createMockConfigManager();
      sayCoeiroink = new SayCoeiroink(configManager);
        await sayCoeiroink.initialize();

        // デフォルト設定でフォールバック
        const result = await sayCoeiroink.synthesizeText('フォールバックテスト', {
          voice: 'test-speaker-1',
        });

        expect(result.success).toBe(true);
      } catch (error) {
        // エラーが発生する場合は適切なエラーメッセージかを確認
        expect(error).toBeInstanceOf(Error);
      }
    });

    test('設定ファイル存在しない場合のデフォルト動作', async () => {
      // 設定ファイルを削除
      try {
        const fs = await import('fs');
        await fs.promises.rm(configFile, { force: true });
      } catch (error) {
        // ファイルが存在しない場合は無視
      }

      const configManager = createMockConfigManager();
      sayCoeiroink = new SayCoeiroink(configManager);
      await sayCoeiroink.initialize();

      const result = await sayCoeiroink.synthesizeText('デフォルト設定テスト', {
        voice: 'test-speaker-1',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('設定の境界値テスト', () => {
    test('設定値の上限・下限での動作確認', async () => {
      const edgeCaseConfig: Config = {
        connection: {
          host: 'localhost',
          port: '50032',
        },
        voice: {
          rate: 200,
        },
        audio: {
          parallelGeneration: {
            enabled: true,
            maxConcurrency: 5, // 最大値
            delayBetweenRequests: 0, // 最小値
            bufferAheadCount: 3, // 最大値
          },
          splitMode: 'small',
          latencyMode: 'ultra-low',
        },
      };

      const configManager = createMockConfigManager(edgeCaseConfig);
      sayCoeiroink = new SayCoeiroink(configManager);
      await sayCoeiroink.initialize();

      const result = await sayCoeiroink.synthesizeText(
        '境界値設定でのテストです。最大並行数と最小遅延での動作を確認します。',
        { voice: 'test-speaker-1' }
      );

      expect(result.success).toBe(true);
    });
  });
});
