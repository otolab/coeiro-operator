/**
 * src/operator/dynamic-config.test.ts: 動的設定管理の包括的テスト
 * 音声プロバイダとの整合性、エラーハンドリング、フォールバック機能のテスト
 */

import { ConfigManager } from './config-manager.js';
import { VoiceProvider } from '../environment/voice-provider.js';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// fetchのモック
global.fetch = vi.fn();

describe('DynamicConfigManagement', () => {
  let configManager: ConfigManager;
  let tempDir: string;
  let mockFetch: anyedFunction<typeof fetch>;

  beforeEach(async () => {
    // 一時ディレクトリを作成
    tempDir = join(tmpdir(), `coeiro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });

    configManager = new ConfigManager(tempDir);
    mockFetch = global.fetch as anyedFunction<typeof fetch>;

    // fetchのモックをリセット
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // 一時ディレクトリをクリーンアップ
    const fs = await import('fs');
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('音声プロバイダとの整合性テスト', () => {
    test('音声プロバイダから正常にキャラクター設定を構築する', async () => {
      // COEIROINKサーバーのレスポンスをモック
      const mockSpeakers = [
        {
          speakerName: 'つくよみちゃん',
          speakerUuid: 'uuid-tsukuyomi',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'ハッピー' },
          ],
        },
        {
          speakerName: 'AI声優-金苗',
          speakerUuid: 'uuid-kanae',
          styles: [{ styleId: 100, styleName: 'のーまる' }],
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpeakers,
      } as Response);

      const config = await configManager.buildDynamicConfig();

      // デバッグ情報を出力
      console.log('Generated config:', JSON.stringify(config, null, 2));
      console.log('Characters keys:', Object.keys(config.characters || {}));

      // つくよみちゃんの設定確認
      expect(config.characters?.tsukuyomi).toBeDefined();
      expect(config.characters.tsukuyomi.voice_id).toBe('uuid-tsukuyomi');
      expect(config.characters.tsukuyomi.available_styles.normal).toBeDefined();
      expect(config.characters.tsukuyomi.available_styles.normal.style_id).toBe(0);

      // 金苗の設定確認（正しいキーマッピング）
      expect(config.characters.kanae).toBeDefined();
      expect(config.characters.kanae.voice_id).toBe('uuid-kanae');
      expect(config.characters.kanae.name).toBe('AI声優-金苗');
    });

    test('音声プロバイダエラー時に内蔵設定にフォールバックする', async () => {
      // 音声プロバイダのエラーをシミュレート
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const config = await configManager.buildDynamicConfig();

      // 内蔵設定にフォールバックしていることを確認
      expect(config.characters.tsukuyomi).toBeDefined();
      expect(config.characters.kanae).toBeDefined();

      // voice_idがnullになっていることを確認
      expect(config.characters.tsukuyomi.voice_id).toBeNull();
      expect(config.characters.kanae.voice_id).toBeNull();

      // 基本的なスタイル設定が存在することを確認
      expect(config.characters.tsukuyomi.available_styles.normal).toBeDefined();
      expect(config.characters.kanae.available_styles.normal).toBeDefined();
    });

    test('音声プロバイダから空配列が返された場合の処理', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      const config = await configManager.buildDynamicConfig();

      // 内蔵設定が使用されていることを確認
      expect(config.characters.tsukuyomi).toBeDefined();
      expect(config.characters.kanae).toBeDefined();
      expect(config.characters.tsukuyomi.voice_id).toBeNull();
    });
  });

  describe('キャラクター設定マージテスト', () => {
    test('ユーザー設定で一部を上書きできる', async () => {
      // ユーザー設定ファイルを作成
      const userConfig = {
        characters: {
          tsukuyomi: {
            greeting: 'カスタマイズされた挨拶',
            personality: 'カスタマイズされた性格',
          },
        },
      };

      const userConfigFile = join(tempDir, 'operator-config.json');
      await writeFile(userConfigFile, JSON.stringify(userConfig), 'utf8');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            speakerName: 'つくよみちゃん',
            speakerUuid: 'uuid-tsukuyomi',
            styles: [{ styleId: 0, styleName: 'れいせい' }],
          },
        ],
      } as Response);

      const config = await configManager.buildDynamicConfig();

      expect(config.characters.tsukuyomi.greeting).toBe('カスタマイズされた挨拶');
      expect(config.characters.tsukuyomi.personality).toBe('カスタマイズされた性格');
      expect(config.characters.tsukuyomi.voice_id).toBe('uuid-tsukuyomi'); // 動的設定は保持
    });

    test('disabledフラグでキャラクターを無効化できる', async () => {
      const userConfig = {
        characters: {
          tsukuyomi: {
            disabled: true,
          },
          kanae: {
            disabled: false,
          },
        },
      };

      const userConfigFile = join(tempDir, 'operator-config.json');
      await writeFile(userConfigFile, JSON.stringify(userConfig), 'utf8');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            speakerName: 'つくよみちゃん',
            speakerUuid: 'uuid-tsukuyomi',
            styles: [{ styleId: 0, styleName: 'れいせい' }],
          },
          {
            speakerName: 'AI声優-金苗',
            speakerUuid: 'uuid-kanae',
            styles: [{ styleId: 100, styleName: 'のーまる' }],
          },
        ],
      } as Response);

      const config = await configManager.buildDynamicConfig();

      expect(config.characters.tsukuyomi).toBeUndefined(); // 無効化されている
      expect(config.characters.kanae).toBeDefined(); // 有効
    });
  });

  describe('エラーハンドリングテスト', () => {
    test('存在しないキャラクターIDでエラーが発生する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      } as Response);

      await expect(configManager.getCharacterConfig('non-existent-character')).rejects.toThrow(
        "キャラクター 'non-existent-character' が見つかりません"
      );
    });

    test('古いキャラクターIDでも適切にエラーが発生する', async () => {
      // 動的設定では 'kanae' キーを使用
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            speakerName: 'AI声優-金苗',
            speakerUuid: 'uuid-kanae',
            styles: [{ styleId: 100, styleName: 'のーまる' }],
          },
        ],
      } as Response);

      // 正しいキーでは取得できる
      const config = await configManager.buildDynamicConfig();
      expect(config.characters.kanae).toBeDefined();

      // 存在しない古いキー形式ではエラー
      await expect(configManager.getCharacterConfig('ai_kanae')).rejects.toThrow(
        "キャラクター 'ai_kanae' が見つかりません"
      );
    });
  });

  describe('キャッシュとリフレッシュテスト', () => {
    test('キャッシュが正しく動作する', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [
          {
            speakerName: 'つくよみちゃん',
            speakerUuid: 'uuid-tsukuyomi',
            styles: [{ styleId: 0, styleName: 'れいせい' }],
          },
        ],
      } as Response);

      // 最初の呼び出し
      const config1 = await configManager.buildDynamicConfig();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 2回目の呼び出し（キャッシュされている）
      const config2 = await configManager.buildDynamicConfig();
      expect(mockFetch).toHaveBeenCalledTimes(1); // 追加でfetchされていない

      expect(config1).toBe(config2); // 同じオブジェクト参照
    });

    test('強制リフレッシュでキャッシュをクリアできる', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      // 最初の呼び出し
      await configManager.buildDynamicConfig();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // 強制リフレッシュ
      await configManager.buildDynamicConfig(true);
      expect(mockFetch).toHaveBeenCalledTimes(2); // 再度fetchされた
    });
  });

  describe('スピーカー名マッピングテスト', () => {
    test('標準的なスピーカー名が正しくマッピングされる', async () => {
      const testCases = [
        { speakerName: 'つくよみちゃん', expectedId: 'tsukuyomi' },
        { speakerName: 'アンジーさん', expectedId: 'angie' },
        { speakerName: 'AI声優-金苗', expectedId: 'kanae' },
        { speakerName: 'AI声優-朱花', expectedId: 'akane' },
        { speakerName: 'KANA', expectedId: 'kana' },
        { speakerName: 'MANA', expectedId: 'mana' },
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => [
            {
              speakerName: testCase.speakerName,
              speakerUuid: `uuid-${testCase.expectedId}`,
              styles: [{ styleId: 0, styleName: 'のーまる' }],
            },
          ],
        } as Response);

        const config = await configManager.buildDynamicConfig(true);
        expect(config.characters[testCase.expectedId]).toBeDefined();
        expect(config.characters[testCase.expectedId].name).toBe(testCase.speakerName);
      }
    });

    test('不明なスピーカー名でもフォールバック処理される', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            speakerName: 'Unknown Speaker',
            speakerUuid: 'uuid-unknown',
            styles: [{ styleId: 0, styleName: 'normal' }],
          },
        ],
      } as Response);

      const config = await configManager.buildDynamicConfig();
      expect(config.characters.unknownspeaker).toBeDefined(); // 正規化されたID
      expect(config.characters.unknownspeaker.name).toBe('Unknown Speaker');
    });
  });
});
