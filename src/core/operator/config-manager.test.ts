/**
 * src/operator/config-manager.test.ts: ConfigManager テスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config-manager.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    tempDir = join(tmpdir(), `coeiro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    configManager = new ConfigManager(tempDir);

    // モックをリセット
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // 一時ディレクトリをクリーンアップ
    try {
      const fs = await import('fs');
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // クリーンアップエラーは無視
    }
  });

  describe('設定ファイルの読み書き', () => {
    test('存在するJSONファイルを正しく読み込む', async () => {
      const testData = { test: 'value' };
      const testFile = join(tempDir, 'test.json');
      await writeFile(testFile, JSON.stringify(testData), 'utf8');

      const result = await configManager.readJsonFile(testFile, {});
      expect(result).toEqual(testData);
    });

    test('存在しないファイルの場合デフォルト値を返す', async () => {
      const defaultValue = { default: true };
      const nonExistentFile = join(tempDir, 'non-existent.json');

      const result = await configManager.readJsonFile(nonExistentFile, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('無効なJSONファイルの場合デフォルト値を返す', async () => {
      const defaultValue = { default: true };
      const invalidJsonFile = join(tempDir, 'invalid.json');
      await writeFile(invalidJsonFile, 'invalid json content', 'utf8');

      const result = await configManager.readJsonFile(invalidJsonFile, defaultValue);
      expect(result).toEqual(defaultValue);
    });

    test('JSONファイルを正しく書き込む', async () => {
      const testData = { test: 'value', number: 42 };
      const testFile = join(tempDir, 'output.json');

      await configManager.writeJsonFile(testFile, testData);

      const content = await readFile(testFile, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toEqual(testData);
    });
  });

  describe('動的設定の構築', () => {
    test('サーバーからスピーカー情報を取得して設定を構築', async () => {
      // speakerProviderのモック設定
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おしとやか' },
          ],
        },
      ]);
      
      // configManagerのspeakerProviderを直接置き換え
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config).toBeDefined();
      expect(config?.characters).toBeDefined();
      expect(config?.characters['tsukuyomi']).toBeDefined();
      expect(config?.characters['tsukuyomi'].availableStyles).toContain('れいせい');
      expect(config?.characters['tsukuyomi'].availableStyles).toContain('おしとやか');
    });

    test('サーバーエラー時は空の設定でフォールバック', async () => {
      const mockGetSpeakers = vi.fn().mockRejectedValue(new Error('Connection failed'));
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // エラーがコンソールに出力されることを確認
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config).toBeDefined();
      expect(config?.characters).toEqual({});
      expect(config?.operatorTimeout).toBe(14400000);
      expect(consoleSpy).toHaveBeenCalledWith(
        '動的設定構築エラー:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    test('ユーザー設定でキャラクターを無効化', async () => {
      // 設定ファイルを作成
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          characters: {
            tsukuyomi: { disabled: true },
          },
        }),
        'utf8'
      );

      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
      ]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config?.characters['tsukuyomi']).toBeUndefined();
    });

    test('カスタム接続設定を適用', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          connection: {
            host: 'custom.host',
            port: '12345',
          },
        }),
        'utf8'
      );

      const mockUpdateConnection = vi.fn();
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as any).speakerProvider = {
        updateConnection: mockUpdateConnection,
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();

      expect(mockUpdateConnection).toHaveBeenCalledWith({
        host: 'custom.host',
        port: '12345',
      });
    });
  });

  describe('設定の取得', () => {
    test('キャラクター設定を取得', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
      ]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const characterConfig = await configManager.getCharacterConfig('tsukuyomi');
      
      expect(characterConfig).toBeDefined();
      expect(characterConfig?.name).toBe('つくよみちゃん');
      expect(characterConfig?.speakerId).toBe('3c37646f-3881-5374-2a83-149267990abc');
    });

    test('存在しないキャラクターの場合nullを返す', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const characterConfig = await configManager.getCharacterConfig('non-existent');
      
      expect(characterConfig).toBeNull();
    });

    test('利用可能なキャラクターIDを取得', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
        {
          speakerUuid: 'maru-uuid',
          speakerName: 'ずんだもん',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
      ]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const ids = await configManager.getAvailableCharacterIds();
      
      expect(ids).toContain('tsukuyomi');
      // maruは内蔵設定に存在しない場合は含まれない
    });

    test('オペレータタイムアウトを取得', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          operator: {
            timeout: 60000,
          },
        }),
        'utf8'
      );

      // buildDynamicConfigを実行するために必要なモック
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const timeout = await configManager.getOperatorTimeout();
      expect(timeout).toBe(60000);
    });

    test('話速（rate）を取得', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          operator: {
            rate: 250,
          },
        }),
        'utf8'
      );

      const rate = await configManager.getRate();
      expect(rate).toBe(250);
    });

    test('音声設定を取得', async () => {
      const audioConfig = {
        latencyMode: 'ultra-low',
        splitMode: 'punctuation',
        bufferSize: 512,
      };

      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          audio: audioConfig,
        }),
        'utf8'
      );

      const result = await configManager.getAudioConfig();
      expect(result).toEqual(audioConfig);
    });

    test('接続設定を取得', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          connection: {
            host: 'test.host',
            port: '9999',
          },
        }),
        'utf8'
      );

      const result = await configManager.getConnectionConfig();
      expect(result).toEqual({
        host: 'test.host',
        port: '9999',
      });
    });

    test('デフォルト接続設定を取得', async () => {
      const result = await configManager.getConnectionConfig();
      expect(result).toEqual({
        host: 'localhost',
        port: '50032',
      });
    });
  });

  describe('完全な設定の取得', () => {
    test('getFullConfigで完全な設定を取得', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          connection: {
            host: 'test.host',
            port: '8888',
          },
          audio: {
            latencyMode: 'balanced',
          },
          operator: {
            rate: 180,
            timeout: 30000,
          },
        }),
        'utf8'
      );

      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const fullConfig = await configManager.getFullConfig();

      expect(fullConfig).toBeDefined();
      expect(fullConfig.connection).toEqual({
        host: 'test.host',
        port: '8888',
      });
      expect(fullConfig.audio?.latencyMode).toBe('balanced');
      expect(fullConfig.operator.rate).toBe(180);
      expect(fullConfig.operator.timeout).toBe(30000);
      expect(fullConfig.characters).toBeDefined();
    });
  });

  describe('設定ディレクトリ管理', () => {
    test('設定ディレクトリの存在確認と作成', async () => {
      const newDir = join(tempDir, 'new-config-dir');
      const newConfigManager = new ConfigManager(newDir);
      
      await newConfigManager.ensureConfigDir();

      // ディレクトリが作成されたか確認
      const fs = await import('fs');
      const stats = await fs.promises.stat(newDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('本質的な失敗を検出するテスト', () => {
    test('設定ファイルが破損している場合でも動作する', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(configFile, '{ invalid json }', 'utf8');

      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // エラーをスローせずにデフォルト設定で動作すること
      const config = await configManager.loadConfig();
      expect(config).toEqual({});
      
      const fullConfig = await configManager.getFullConfig();
      expect(fullConfig).toBeDefined();
      expect(fullConfig.operator.rate).toBe(200); // デフォルト値
    });

    test('設定のマージが正しく動作する', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          characters: {
            tsukuyomi: {
              defaultStyle: 'カスタムスタイル',
            },
          },
        }),
        'utf8'
      );

      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'ノーマル' },
            { styleId: 1, styleName: 'カスタムスタイル' },
          ],
        },
      ]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const character = await configManager.getCharacterConfig('tsukuyomi');
      
      expect(character?.defaultStyle).toBe('カスタムスタイル');
    });

    test('複数回buildDynamicConfigを呼んでも安定して動作する', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          speakerName: 'つくよみちゃん',
          styles: [{ styleId: 0, styleName: 'ノーマル' }],
        },
      ]);
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // 複数回呼び出す
      await configManager.buildDynamicConfig();
      await configManager.buildDynamicConfig();
      await configManager.buildDynamicConfig();

      const config = configManager.getMergedConfig();
      expect(config?.characters['tsukuyomi']).toBeDefined();
      
      // getSpeakersが3回呼ばれていることを確認
      expect(mockGetSpeakers).toHaveBeenCalledTimes(3);
    });

    test('サーバーが一時的にエラーを返してもリトライできる', async () => {
      let callCount = 0;
      const mockGetSpeakers = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('一時的なエラー'));
        }
        return Promise.resolve([
          {
            speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
            speakerName: 'つくよみちゃん',
            styles: [{ styleId: 0, styleName: 'ノーマル' }],
          },
        ]);
      });
      
      (configManager as any).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // 1回目：エラー
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await configManager.buildDynamicConfig();
      let config = configManager.getMergedConfig();
      expect(config?.characters).toEqual({});

      // 2回目：成功
      await configManager.buildDynamicConfig();
      config = configManager.getMergedConfig();
      expect(config?.characters['tsukuyomi']).toBeDefined();

      consoleSpy.mockRestore();
    });
  });
});