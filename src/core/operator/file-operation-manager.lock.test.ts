/**
 * src/operator/file-operation-manager.lock.test.ts: ファイルロック機構のテスト
 * Issue #56対応後のMCPサーバーハング問題調査用
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('FileOperationManager - ロック機構テスト', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;
    let testFilePath: string;

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `lock-test-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        testFilePath = join(tempDir, 'test-lock.json');
        fileManager = new FileOperationManager();
    });

    afterEach(async () => {
        // 一時ディレクトリをクリーンアップ
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
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

    describe('統一ファイル操作テスト', () => {
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