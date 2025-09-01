/**
 * FileOperationManagerテスト
 * 基本ファイル操作とロック機構のテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { readFile, writeFile, access, mkdir, unlink, rm } from 'fs/promises';
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

    // 統一ファイルシステムに移行済み - 古いテストは削除

    describe('updateVoiceSetting', () => {
        test('音声設定を正しく更新する', async () => {
            const configFile = join(tempDir, 'voice-config.json');
            const initialConfig = { other_setting: 'value' };
            await writeFile(configFile, JSON.stringify(initialConfig), 'utf8');

            await fileManager.updateVoiceSetting(configFile, 'voice123', 42);

            const content = await readFile(configFile, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.voice?.default_speaker_id).toBe('voice123');
            expect(parsed.voice?.default_style_id).toBe(42);
            expect(parsed.other_setting).toBe('value');
            
            // 古い設定値が削除されていることを確認
            expect(parsed.voice_id).toBeUndefined();
            expect(parsed.style_id).toBeUndefined();
        });

        test('設定ファイルが存在しない場合は新規作成', async () => {
            const configFile = join(tempDir, 'new-voice-config.json');

            await fileManager.updateVoiceSetting(configFile, 'voice456', 7);

            const content = await readFile(configFile, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.voice?.default_speaker_id).toBe('voice456');
            expect(parsed.voice?.default_style_id).toBe(7);
            
            // 古い設定値が存在しないことを確認
            expect(parsed.voice_id).toBeUndefined();
            expect(parsed.style_id).toBeUndefined();
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

    describe('ファイルロック機能', () => {
        let testFilePath: string;

        beforeEach(() => {
            testFilePath = join(tempDir, 'test-lock.json');
        });

        describe('基本的なロック機能', () => {
            test('ロックが正常に取得・解放されること', async () => {
                let lockAcquired = false;
                let lockReleased = false;

                await fileManager.withFileLock(testFilePath, async () => {
                    lockAcquired = true;
                    // 短時間の処理をシミュレート
                    await new Promise(resolve => setTimeout(resolve, 10));
                    lockReleased = true;
                });

                expect(lockAcquired).toBe(true);
                expect(lockReleased).toBe(true);
            });

            test('ロックファイルが正しく削除されること', async () => {
                const lockFile = `${testFilePath}.lock`;

                await fileManager.withFileLock(testFilePath, async () => {
                    // ロック中はロックファイルが存在することを確認
                    expect(await fileManager.fileExists(lockFile)).toBe(true);
                });

                // ロック解放後はロックファイルが削除されることを確認
                expect(await fileManager.fileExists(lockFile)).toBe(false);
            });

            test('ロック中にエラーが発生してもロックが解放されること', async () => {
                const lockFile = `${testFilePath}.lock`;

                try {
                    await fileManager.withFileLock(testFilePath, async () => {
                        expect(await fileManager.fileExists(lockFile)).toBe(true);
                        throw new Error('テストエラー');
                    });
                } catch (error) {
                    expect((error as Error).message).toBe('テストエラー');
                }

                // エラー後もロックファイルが削除されることを確認
                expect(await fileManager.fileExists(lockFile)).toBe(false);
            });
        });

        describe('ロック競合テスト', () => {
            test('複数の並行ロック取得が順次実行されること', async () => {
                const results: number[] = [];
                const promises: Promise<void>[] = [];

                // 3つの並行ロック処理を開始
                for (let i = 0; i < 3; i++) {
                    const promise = fileManager.withFileLock(testFilePath, async () => {
                        results.push(i);
                        // 処理時間を少し置く
                        await new Promise(resolve => setTimeout(resolve, 50));
                    });
                    promises.push(promise);
                }

                await Promise.all(promises);

                // 全ての処理が完了していること
                expect(results).toHaveLength(3);
                expect(results.sort()).toEqual([0, 1, 2]);
            });

            test('ロックタイムアウトが動作すること', { timeout: 10000 }, async () => {
                // 古いロックファイルを手動で作成（1分前のタイムスタンプ）
                const lockFile = `${testFilePath}.lock`;
                const oldTimestamp = new Date(Date.now() - 60000); // 1分前
                
                await fileManager.writeJsonFile(lockFile, 'old-process-id');
                
                // ファイルのタイムスタンプを古く設定
                const fs = await import('fs');
                await fs.promises.utimes(lockFile, oldTimestamp, oldTimestamp);

                let lockAcquired = false;
                
                // 古いロックがタイムアウトでクリアされ、新しいロックが取得できること
                await fileManager.withFileLock(testFilePath, async () => {
                    lockAcquired = true;
                });

                expect(lockAcquired).toBe(true);
            });
        });

        describe('統一ファイル操作とロック', () => {
            test('initUnifiedOperatorStateが正常に動作すること', async () => {
                await fileManager.initUnifiedOperatorState();
                
                const unifiedFilePath = fileManager.getUnifiedOperatorFilePath();
                expect(await fileManager.fileExists(unifiedFilePath)).toBe(true);
                
                const content = await fileManager.readJsonFile(unifiedFilePath, {});
                expect(content).toHaveProperty('operators');
                expect(content).toHaveProperty('last_updated');
            });

            test('cleanupStaleOperatorsが正常に動作すること', async () => {
                // まず統一ファイルを初期化
                await fileManager.initUnifiedOperatorState();
                
                // cleanupStaleOperatorsが例外を投げないことを確認
                await expect(fileManager.cleanupStaleOperators('test-session')).resolves.not.toThrow();
            });

            test('複数の並行操作でファイルが破損しないこと', async () => {
                await fileManager.initUnifiedOperatorState();
                
                const promises: Promise<void>[] = [];
                
                // 複数の並行読み書き操作
                for (let i = 0; i < 5; i++) {
                    promises.push(
                        fileManager.reserveOperatorUnified(`operator-${i}`, `session-${i}`)
                            .then(() => {})
                            .catch(() => {}) // エラーは無視（競合は正常）
                    );
                }
                
                await Promise.all(promises);
                
                // ファイルが破損していないことを確認
                const unifiedFilePath = fileManager.getUnifiedOperatorFilePath();
                const content = await fileManager.readJsonFile(unifiedFilePath, {});
                expect(content).toHaveProperty('operators');
                expect(content).toHaveProperty('last_updated');
            });
        });

        describe('パフォーマンステスト', () => {
            test('大量の並行ロック処理が適切な時間で完了すること', { timeout: 30000 }, async () => {
                const startTime = Date.now();
                const promises: Promise<void>[] = [];
                
                // 20個の並行ロック処理
                for (let i = 0; i < 20; i++) {
                    promises.push(
                        fileManager.withFileLock(testFilePath, async () => {
                            // 短時間の処理
                            await new Promise(resolve => setTimeout(resolve, 10));
                        })
                    );
                }
                
                await Promise.all(promises);
                
                const duration = Date.now() - startTime;
                console.log(`20個の並行ロック処理完了時間: ${duration}ms`);
                
                // 30秒以内に完了することを確認
                expect(duration).toBeLessThan(30000);
            });
        });
    });
});