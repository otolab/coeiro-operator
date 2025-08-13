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
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
    });

    test('短命プロセスIDで予約された場合のcleanup動作', async () => {
        await fileManager.initUnifiedOperatorState();

        // 存在しないプロセスIDで予約をシミュレート
        const nonExistentPid = 99999;
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // 統一ファイルを直接編集して存在しないプロセスIDに変更
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state = await fileManager.readJsonFile(filePath, {});
        state.operators.tsukuyomi.process_id = nonExistentPid.toString();
        await fileManager.writeJsonFile(filePath, state);

        // 異なるセッションからcleanupを実行
        await fileManager.cleanupStaleOperators('different_session');

        // 予約が削除されているかチェック
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('Cleanup後の状態:', stateAfterCleanup);
        
        // プロセスが存在しないので削除されてしまう
        expect(stateAfterCleanup.operators.tsukuyomi).toBeUndefined();
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

    test('CLI使用パターンでの問題実証', async () => {
        await fileManager.initUnifiedOperatorState();

        // session_1でtsukuyomiを予約（CLIプロセスと同じような短命プロセスをシミュレート）
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // 初期状態確認
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const initialState = await fileManager.readJsonFile(filePath, {});
        expect(initialState.operators.tsukuyomi).toBeDefined();

        // 異なるセッションが初期化時にcleanupを実行（これが問題）
        await fileManager.cleanupStaleOperators('session_2');

        // 予約が誤って削除される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('Session_2のcleanup後:', stateAfterCleanup);
        
        // CLIプロセスは短命なので、誤って削除される
        expect(Object.keys(stateAfterCleanup.operators)).toHaveLength(0);
    });
});