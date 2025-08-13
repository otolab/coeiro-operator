/**
 * 時間ベースcleanup機能のテスト
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('時間ベースcleanup機能', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `time-cleanup-${Date.now()}`);
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

    test('30分未満の予約は保持される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 最近の予約を作成
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);
        
        // 異なるセッションからcleanupを実行
        await fileManager.cleanupStaleOperators('session_2');
        
        // 最近の予約は保持される
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state = await fileManager.readJsonFile(filePath, {});
        
        expect(state.operators.tsukuyomi).toBeDefined();
        expect(state.operators.tsukuyomi.session_id).toBe('session_1');
    });

    test('30分以上前の予約は削除される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 古い予約を手動で作成（31分前）
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const oldTimestamp = new Date(Date.now() - 31 * 60 * 1000); // 31分前
        
        const state = await fileManager.readJsonFile(filePath, {});
        state.operators = {
            tsukuyomi: {
                session_id: 'old_session',
                process_id: '99999',
                reserved_at: oldTimestamp.toISOString()
            }
        };
        state.last_updated = new Date().toISOString();
        await fileManager.writeJsonFile(filePath, state);
        
        // cleanupを実行
        await fileManager.cleanupStaleOperators('current_session');
        
        // 古い予約は削除される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        expect(stateAfterCleanup.operators.tsukuyomi).toBeUndefined();
        expect(Object.keys(stateAfterCleanup.operators)).toHaveLength(0);
    });

    test('同じセッションの予約は時間に関係なく保持される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 古い予約を同じセッションIDで作成
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000); // 1時間前
        const sessionId = 'my_session';
        
        const state = await fileManager.readJsonFile(filePath, {});
        state.operators = {
            tsukuyomi: {
                session_id: sessionId,
                process_id: process.pid.toString(),
                reserved_at: oldTimestamp.toISOString()
            }
        };
        state.last_updated = new Date().toISOString();
        await fileManager.writeJsonFile(filePath, state);
        
        // 同じセッションからcleanupを実行
        await fileManager.cleanupStaleOperators(sessionId);
        
        // 同じセッションの予約は古くても保持される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        expect(stateAfterCleanup.operators.tsukuyomi).toBeDefined();
        expect(stateAfterCleanup.operators.tsukuyomi.session_id).toBe(sessionId);
    });

    test('CLI環境での正常動作確認', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 統一ファイルの状態確認
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const initialState = await fileManager.readJsonFile(filePath, {});
        console.log('初期状態:', initialState);
        
        // CLI session 1でtsukuyomiを予約
        const session1Success = await fileManager.reserveOperatorUnified('tsukuyomi', 'cli_session_1');
        console.log('tsukuyomi予約結果:', session1Success);
        
        if (!session1Success) {
            const stateAfterFail = await fileManager.readJsonFile(filePath, {});
            console.log('予約失敗後の状態:', stateAfterFail);
        }
        
        expect(session1Success).toBe(true);
        
        // CLI session 2でalmaを予約
        const session2Success = await fileManager.reserveOperatorUnified('alma', 'cli_session_2');
        expect(session2Success).toBe(true);
        
        // CLI session 3からavailableをチェック（cleanupが実行される）
        await fileManager.cleanupStaleOperators('cli_session_3');
        
        // 最近の予約は両方とも保持される
        const state = await fileManager.readJsonFile(filePath, {});
        
        expect(state.operators.tsukuyomi).toBeDefined();
        expect(state.operators.alma).toBeDefined();
        expect(Object.keys(state.operators)).toHaveLength(2);
    });
});