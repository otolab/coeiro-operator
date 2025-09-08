/**
 * src/operator/dynamic-config.test.ts: 動的設定管理の包括的テスト
 * 音声プロバイダとの整合性、エラーハンドリング、フォールバック機能のテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// fetchをモック
vi.stubGlobal('fetch', vi.fn());

describe('DynamicConfigManagement', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    tempDir = join(tmpdir(), `coeiro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    configManager = new ConfigManager(tempDir);

    // fetchモックを設定
    (global.fetch as unknown).mockRejectedValue(new Error('Network error'));

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

  describe('音声プロバイダとの整合性テスト', () => {
    test('音声プロバイダから正常にキャラクター設定を構築する', async () => {
      // COEIROINKサーバーのレスポンスをモック
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerName: 'つくよみちゃん',
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おしとやか' },
          ],
        },
        {
          speakerName: 'ディアちゃん',
          speakerUuid: 'b28bb401-bc43-c9c7-77e4-77a2bbb4b283',
          styles: [
            { styleId: 0, styleName: 'のーまる' },
          ],
        },
      ]);

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config).toBeDefined();
      expect(config?.characters).toBeDefined();
      expect(config?.characters['tsukuyomi']).toBeDefined();
      expect(config?.characters['tsukuyomi'].name).toBe('つくよみちゃん');
      expect(config?.characters['tsukuyomi'].availableStyles).toContain('れいせい');
      
      expect(config?.characters['dia']).toBeDefined();
      expect(config?.characters['dia'].name).toBe('ディアちゃん');
    });

    test('音声プロバイダエラー時に内蔵設定にフォールバックする', async () => {
      const mockGetSpeakers = vi.fn().mockRejectedValue(new Error('Connection failed'));
      
      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config).toBeDefined();
      expect(config?.characters).toEqual({}); // サーバーエラー時は空の設定
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('音声プロバイダから空配列が返された場合の処理', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const config = configManager.getMergedConfig();

      expect(config).toBeDefined();
      expect(config?.characters).toEqual({});
    });
  });

  describe('キャラクター設定マージテスト', () => {
    test('ユーザー設定で一部を上書きできる', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          characters: {
            tsukuyomi: {
              defaultStyle: 'おしとやか',
              greeting: 'カスタム挨拶',
            },
          },
        }),
        'utf8'
      );

      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerName: 'つくよみちゃん',
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おしとやか' },
          ],
        },
      ]);

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const character = await configManager.getCharacterConfig('tsukuyomi');

      expect(character).toBeDefined();
      expect(character?.defaultStyle).toBe('おしとやか');
      expect(character?.greeting).toBe('カスタム挨拶');
      expect(character?.name).toBe('つくよみちゃん'); // 内蔵設定は維持
    });

    test('disabledフラグでキャラクターを無効化できる', async () => {
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
          speakerName: 'つくよみちゃん',
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          styles: [{ styleId: 0, styleName: 'れいせい' }],
        },
      ]);

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();
      const character = await configManager.getCharacterConfig('tsukuyomi');

      expect(character).toBeNull();
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('存在しないキャラクターIDでnullを返す', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      const character = await configManager.getCharacterConfig('nonexistent');
      expect(character).toBeNull();
    });

    test('初期化前でも自動的に初期化される', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerName: 'つくよみちゃん',
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          styles: [{ styleId: 0, styleName: 'れいせい' }],
        },
      ]);

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // buildDynamicConfigを明示的に呼ばずにgetCharacterConfigを呼ぶ
      const character = await configManager.getCharacterConfig('tsukuyomi');
      
      expect(character).toBeDefined();
      expect(mockGetSpeakers).toHaveBeenCalled();
    });
  });

  describe('キャッシュとリフレッシュテスト', () => {
    test('設定が一度構築されたら再利用される', async () => {
      const mockGetSpeakers = vi.fn().mockResolvedValue([
        {
          speakerName: 'つくよみちゃん',
          speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
          styles: [{ styleId: 0, styleName: 'れいせい' }],
        },
      ]);

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // 1回目の呼び出し
      await configManager.buildDynamicConfig();
      const config1 = configManager.getMergedConfig();

      // 2回目の呼び出し（同じインスタンスが返される）
      const config2 = configManager.getMergedConfig();

      expect(config1).toBe(config2);
      // ただし、buildDynamicConfigを再度呼ぶと再構築される
      await configManager.buildDynamicConfig();
      expect(mockGetSpeakers).toHaveBeenCalledTimes(2);
    });

    test('強制リフレッシュで設定を再構築できる', async () => {
      let callCount = 0;
      const mockGetSpeakers = vi.fn().mockImplementation(() => {
        callCount++;
        const styles = callCount === 1 
          ? [{ styleId: 0, styleName: 'れいせい' }]
          : [{ styleId: 0, styleName: 'れいせい' }, { styleId: 1, styleName: '新スタイル' }];
        
        return Promise.resolve([
          {
            speakerName: 'つくよみちゃん',
            speakerUuid: '3c37646f-3881-5374-2a83-149267990abc',
            styles,
          },
        ]);
      });

      (configManager as unknown).speakerProvider = {
        updateConnection: vi.fn(),
        getSpeakers: mockGetSpeakers,
      };

      // 1回目
      await configManager.buildDynamicConfig();
      let character = await configManager.getCharacterConfig('tsukuyomi');
      expect(character?.availableStyles).toHaveLength(1);

      // 2回目（強制リフレッシュ）
      await configManager.buildDynamicConfig();
      character = await configManager.getCharacterConfig('tsukuyomi');
      expect(character?.availableStyles).toHaveLength(2);
      expect(character?.availableStyles).toContain('新スタイル');
    });
  });

  describe('接続設定の更新', () => {
    test('カスタム接続設定が音声プロバイダに反映される', async () => {
      const configFile = join(tempDir, 'config.json');
      await writeFile(
        configFile,
        JSON.stringify({
          connection: {
            host: 'custom.example.com',
            port: '12345',
          },
        }),
        'utf8'
      );

      const mockUpdateConnection = vi.fn();
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as unknown).speakerProvider = {
        updateConnection: mockUpdateConnection,
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();

      expect(mockUpdateConnection).toHaveBeenCalledWith({
        host: 'custom.example.com',
        port: '12345',
      });
    });

    test('デフォルト接続設定が使用される', async () => {
      const mockUpdateConnection = vi.fn();
      const mockGetSpeakers = vi.fn().mockResolvedValue([]);
      
      (configManager as unknown).speakerProvider = {
        updateConnection: mockUpdateConnection,
        getSpeakers: mockGetSpeakers,
      };

      await configManager.buildDynamicConfig();

      expect(mockUpdateConnection).toHaveBeenCalledWith({
        host: 'localhost',
        port: '50032',
      });
    });
  });
});