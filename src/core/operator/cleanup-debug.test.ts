/**
 * cleanupStaleOperators問題のデバッグテスト
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('cleanupStaleOperators問題調査', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `cleanup-debug-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        fileManager = new FileOperationManager();
        
        // テスト用に統一ファイルパスを上書き
        const testFilePath = join(tempDir, 'test-operators.json');
        fileManager.getUnifiedOperatorFilePath = () => testFilePath;
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
    });

    test('時間ベースcleanup：最近の予約は保持される', async () => {
        await fileManager.initUnifiedOperatorState();

        // 最近の予約を作成
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // 異なるセッションからcleanupを実行（時間ベース）
        await fileManager.cleanupStaleOperators('different_session');

        // 予約が保持されているかチェック
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('Cleanup後の状態:', stateAfterCleanup);
        
        // 時間ベースなので最近の予約は保持される
        expect(stateAfterCleanup.operators.tsukuyomi).toBeDefined();
        expect(stateAfterCleanup.operators.tsukuyomi.session_id).toBe('session_1');
    });

    test('現在のプロセスIDでのプロセス存在チェック', async () => {
        const currentPid = process.pid;
        
        try {
            // 自分自身のプロセスIDをチェック（これは成功するはず）
            process.kill(currentPid, 0);
            console.log(`プロセス ${currentPid} は存在します`);
        } catch (error) {
            console.log(`プロセス ${currentPid} チェックエラー:`, error.message);
        }

        try {
            // 存在しないプロセスIDをチェック
            process.kill(99999, 0);
            console.log('存在しないプロセスがあると判定された（これは問題）');
        } catch (error) {
            console.log('存在しないプロセスは正しく検出された:', error.message);
        }
    });

    test('時間ベースcleanup：CLI使用パターンでの予約保持', async () => {
        await fileManager.initUnifiedOperatorState();

        // session_1でtsukuyomiを予約（CLIプロセスをシミュレート）
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // 初期状態確認
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const initialState = await fileManager.readJsonFile(filePath, {});
        expect(initialState.operators.tsukuyomi).toBeDefined();

        // 異なるセッションが初期化時にcleanupを実行（時間ベース）
        await fileManager.cleanupStaleOperators('session_2');

        // 時間ベースなので予約は保持される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('Session_2のcleanup後:', stateAfterCleanup);
        
        // 最近の予約は時間ベースで保持される
        expect(stateAfterCleanup.operators.tsukuyomi).toBeDefined();
        expect(Object.keys(stateAfterCleanup.operators)).toHaveLength(1);
    });
});