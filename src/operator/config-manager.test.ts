/**
 * src/operator/config-manager.test.ts: ConfigManager テスト
 */

import { ConfigManager } from './config-manager.js';
import { readFile, writeFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// fetchのモック
global.fetch = jest.fn();

describe('ConfigManager', () => {
    let configManager: ConfigManager;
    let tempDir: string;

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `coeiro-test-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        configManager = new ConfigManager(tempDir);
        
        // fetchのモックをリセット
        jest.clearAllMocks();
    });

    afterEach(async () => {
        // 一時ディレクトリをクリーンアップ
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe('readJsonFile', () => {
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
    });

    describe('writeJsonFile', () => {
        test('JSONファイルを正しく書き込む', async () => {
            const testData = { test: 'value', number: 42 };
            const testFile = join(tempDir, 'output.json');

            await configManager.writeJsonFile(testFile, testData);

            const content = await readFile(testFile, 'utf8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(testData);
        });
    });

    describe('speakerNameToId', () => {
        test('既知のスピーカー名を正しくIDに変換', () => {
            // SPEAKER_NAME_TO_ID_MAPに定義されているマッピングをテスト
            const result = configManager.speakerNameToId('つくよみちゃん');
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
        });

        test('未知のスピーカー名を小文字英数字に変換', () => {
            const result = configManager.speakerNameToId('テスト キャラクター！');
            expect(result).toBe('');
        });

        test('英数字のスピーカー名はそのまま小文字に変換', () => {
            const result = configManager.speakerNameToId('TestCharacter123');
            expect(result).toBe('testcharacter123');
        });
    });

    describe('deepMerge', () => {
        test('ネストしたオブジェクトを正しくマージ', () => {
            const target = {
                a: 1,
                b: { c: 2, d: 3 },
                e: [1, 2]
            };
            const source = {
                b: { c: 20, f: 4 },
                g: 5
            };

            const result = configManager.deepMerge(target, source);

            expect(result).toEqual({
                a: 1,
                b: { c: 20, d: 3, f: 4 },
                e: [1, 2],
                g: 5
            });
        });

        test('配列は上書きされる', () => {
            const target = { arr: [1, 2, 3] };
            const source = { arr: [4, 5] };

            const result = configManager.deepMerge(target, source);

            expect(result.arr).toEqual([4, 5]);
        });
    });

    describe('fetchAvailableVoices', () => {
        test('COEIROINKサーバーからの正常なレスポンスを処理', async () => {
            const mockResponse = [
                {
                    speakerName: 'つくよみちゃん',
                    speakerUuid: 'test-uuid-1',
                    styles: [
                        { styleId: 0, styleName: 'れいせい' },
                        { styleId: 1, styleName: 'ねむねむ' }
                    ]
                }
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse
            });

            await configManager.fetchAvailableVoices();

            expect(global.fetch).toHaveBeenCalledWith('http://localhost:50032/v1/speakers');
        });

        test('COEIROINKサーバーエラー時は空配列を設定', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

            // エラーが投げられないことを確認
            await expect(configManager.fetchAvailableVoices()).resolves.not.toThrow();
        });

        test('カスタムホスト・ポートを使用', async () => {
            // カスタム設定ファイルを作成
            const customConfig = { host: 'custom-host', port: '9999' };
            const configFile = join(tempDir, 'coeiroink-config.json');
            await writeFile(configFile, JSON.stringify(customConfig), 'utf8');

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => []
            });

            await configManager.fetchAvailableVoices();

            expect(global.fetch).toHaveBeenCalledWith('http://custom-host:9999/v1/speakers');
        });
    });

    describe('buildDynamicConfig', () => {
        test('音声フォントが利用できない場合は内蔵設定を使用', async () => {
            // fetchAvailableVoicesが空配列を返すようにモック
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            const config = await configManager.buildDynamicConfig();

            expect(config.characters).toBeDefined();
            expect(Object.keys(config.characters).length).toBeGreaterThan(0);
        });

        test('ユーザー設定でキャラクターを無効化', async () => {
            // ユーザー設定ファイルを作成（angieを無効化）
            const userConfig = {
                characters: {
                    angie: { disabled: true }
                }
            };
            const configFile = join(tempDir, 'operator-config.json');
            await writeFile(configFile, JSON.stringify(userConfig), 'utf8');

            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            const config = await configManager.buildDynamicConfig();

            // angieが設定に含まれていないことを確認
            expect(config.characters.angie).toBeUndefined();
        });

        test('キャッシュが正しく動作', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            // 初回呼び出し
            const config1 = await configManager.buildDynamicConfig();
            
            // 2回目呼び出し（キャッシュから取得）
            const config2 = await configManager.buildDynamicConfig();

            expect(config1).toBe(config2); // 同じオブジェクトインスタンスであることを確認
        });

        test('forceRefreshでキャッシュを無視', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            // 初回呼び出し
            await configManager.buildDynamicConfig();
            
            // forceRefreshで再呼び出し
            await configManager.buildDynamicConfig(true);

            // fetchが2回呼ばれることを確認
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('getCharacterConfig', () => {
        test('存在するキャラクターの設定を取得', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            const characterIds = await configManager.getAvailableCharacterIds();
            const firstCharacterId = characterIds[0];

            const characterConfig = await configManager.getCharacterConfig(firstCharacterId);

            expect(characterConfig).toBeDefined();
            expect(characterConfig.name).toBeDefined();
            expect(characterConfig.personality).toBeDefined();
        });

        test('存在しないキャラクターの場合エラーを投げる', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            await expect(
                configManager.getCharacterConfig('non-existent-character')
            ).rejects.toThrow('キャラクター \'non-existent-character\' が見つかりません');
        });
    });

    describe('refreshConfig', () => {
        test('キャッシュが正しくクリアされる', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));

            // 初回呼び出してキャッシュを作成
            await configManager.buildDynamicConfig();

            // キャッシュをクリア
            configManager.refreshConfig();

            // 再度呼び出し（新しいインスタンスが作られるはず）
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('No server'));
            await configManager.buildDynamicConfig();

            // fetchが2回呼ばれることを確認
            expect(global.fetch).toHaveBeenCalledTimes(2);
        });
    });
});