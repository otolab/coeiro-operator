/**
 * src/operator/file-operation-manager.test.ts: FileOperationManagerテスト
 */

import { FileOperationManager } from './file-operation-manager.js';
import { readFile, writeFile, access, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('FileOperationManager', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;

    beforeEach(async () => {
        // 一時ディレクトリを作成（ランダムな要素を追加してユニーク性を保証）
        tempDir = join(tmpdir(), `coeiro-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await mkdir(tempDir, { recursive: true });
        
        fileManager = new FileOperationManager();
    });

    afterEach(async () => {
        // 一時ディレクトリをクリーンアップ
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe('readJsonFile', () => {
        test('存在するJSONファイルを正しく読み込む', async () => {
            const testData = { test: 'value', number: 42 };
            const testFile = join(tempDir, 'test.json');
            await writeFile(testFile, JSON.stringify(testData), 'utf8');

            const result = await fileManager.readJsonFile(testFile, {});
            expect(result).toEqual(testData);
        });

        test('存在しないファイルの場合デフォルト値を返す', async () => {
            const defaultValue = { default: true };
            const nonExistentFile = join(tempDir, 'non-existent.json');

            const result = await fileManager.readJsonFile(nonExistentFile, defaultValue);
            expect(result).toEqual(defaultValue);
        });

        test('無効なJSONファイルの場合デフォルト値を返す', async () => {
            const defaultValue = { default: true };
            const invalidJsonFile = join(tempDir, 'invalid.json');
            await writeFile(invalidJsonFile, 'invalid json content', 'utf8');

            const result = await fileManager.readJsonFile(invalidJsonFile, defaultValue);
            expect(result).toEqual(defaultValue);
        });
    });

    describe('writeJsonFile', () => {
        test('JSONファイルを正しく書き込む', async () => {
            const testData = { test: 'value', number: 42 };
            const testFile = join(tempDir, 'output.json');

            await fileManager.writeJsonFile(testFile, testData);

            const content = await readFile(testFile, 'utf8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(testData);
        });

        test('アトミック操作でファイルを更新', async () => {
            const testFile = join(tempDir, 'atomic.json');
            const initialData = { version: 1 };
            const updatedData = { version: 2 };

            // 初期ファイル作成
            await fileManager.writeJsonFile(testFile, initialData);
            
            // 更新操作
            await fileManager.writeJsonFile(testFile, updatedData);

            const content = await readFile(testFile, 'utf8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(updatedData);
        });
    });

    describe('initActiveOperators', () => {
        test('ファイルが存在しない場合は初期化する', async () => {
            const activeOperatorsFile = join(tempDir, 'active-operators.json');

            await fileManager.initActiveOperators(activeOperatorsFile);

            const content = await readFile(activeOperatorsFile, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed).toHaveProperty('active');
            expect(parsed).toHaveProperty('last_updated');
            expect(parsed.active).toEqual({});
            expect(typeof parsed.last_updated).toBe('string');
        });

        test('ファイルが既に存在する場合は何もしない', async () => {
            const activeOperatorsFile = join(tempDir, 'existing-active-operators.json');
            const existingData = {
                active: { 'operator1': 'session1' },
                last_updated: '2023-01-01T00:00:00.000Z'
            };

            // 既存ファイルを作成
            await writeFile(activeOperatorsFile, JSON.stringify(existingData), 'utf8');

            await fileManager.initActiveOperators(activeOperatorsFile);

            const content = await readFile(activeOperatorsFile, 'utf8');
            const parsed = JSON.parse(content);
            expect(parsed).toEqual(existingData);
        });
    });

    describe('updateVoiceSetting', () => {
        test('音声設定を正しく更新する', async () => {
            const configFile = join(tempDir, 'voice-config.json');
            const initialConfig = { other_setting: 'value' };
            await writeFile(configFile, JSON.stringify(initialConfig), 'utf8');

            await fileManager.updateVoiceSetting(configFile, 'voice123', 42);

            const content = await readFile(configFile, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.voice_id).toBe('voice123');
            expect(parsed.style_id).toBe(42);
            expect(parsed.other_setting).toBe('value');
        });

        test('設定ファイルが存在しない場合は新規作成', async () => {
            const configFile = join(tempDir, 'new-voice-config.json');

            await fileManager.updateVoiceSetting(configFile, 'voice456', 7);

            const content = await readFile(configFile, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.voice_id).toBe('voice456');
            expect(parsed.style_id).toBe(7);
        });
    });

    describe('fileExists', () => {
        test('存在するファイルに対してtrueを返す', async () => {
            const testFile = join(tempDir, 'exists.txt');
            await writeFile(testFile, 'content', 'utf8');

            const result = await fileManager.fileExists(testFile);
            expect(result).toBe(true);
        });

        test('存在しないファイルに対してfalseを返す', async () => {
            const nonExistentFile = join(tempDir, 'does-not-exist.txt');

            const result = await fileManager.fileExists(nonExistentFile);
            expect(result).toBe(false);
        });
    });

    describe('deleteFile', () => {
        test('存在するファイルを削除する', async () => {
            const testFile = join(tempDir, 'to-delete.txt');
            await writeFile(testFile, 'content', 'utf8');

            await fileManager.deleteFile(testFile);

            const exists = await fileManager.fileExists(testFile);
            expect(exists).toBe(false);
        });

        test('存在しないファイルの削除でエラーを出さない', async () => {
            const nonExistentFile = join(tempDir, 'does-not-exist.txt');

            // エラーが発生しないことを確認
            await expect(fileManager.deleteFile(nonExistentFile)).resolves.not.toThrow();
        });
    });
});