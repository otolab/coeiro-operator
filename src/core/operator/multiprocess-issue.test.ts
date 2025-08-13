/**
 * マルチプロセス環境でのcleanup問題検証
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('マルチプロセス環境でのcleanup問題', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `multiprocess-${Date.now()}`);
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

    test('時間ベースcleanup：新しい予約は保持される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // === プロセス1（CLI assign）のシミュレーション ===
        const process1SessionId = 'session_1';
        const process1Pid = 12345; // 短命プロセス
        
        // 手動で最近の予約を作成
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const initialState = await fileManager.readJsonFile(filePath, {});
        initialState.operators = {
            tsukuyomi: {
                session_id: process1SessionId,
                process_id: process1Pid.toString(),
                reserved_at: new Date().toISOString() // 最近の予約
            }
        };
        initialState.last_updated = new Date().toISOString();
        await fileManager.writeJsonFile(filePath, initialState);
        
        console.log('プロセス1（CLI assign）後の状態:', initialState);
        
        // === プロセス2（CLI available）のシミュレーション ===
        const process2SessionId = 'session_2';
        
        // プロセス2が初期化時にcleanupを実行（時間ベース）
        await fileManager.cleanupStaleOperators(process2SessionId);
        
        // 時間ベースなので最近の予約は保持される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('プロセス2（cleanup後）の状態:', stateAfterCleanup);
        
        // 修正：時間ベースなので最近の予約は保持される
        expect(stateAfterCleanup.operators.tsukuyomi).toBeDefined();
        expect(stateAfterCleanup.operators.tsukuyomi.session_id).toBe(process1SessionId);
    });

    test('時間ベースcleanup：最近の予約は異なるセッションからも保持', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // === Claude Code セッション1 ===
        const session1Id = 'claude_session_1';
        
        const success1 = await fileManager.reserveOperatorUnified('tsukuyomi', session1Id);
        expect(success1).toBe(true);
        
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state1 = await fileManager.readJsonFile(filePath, {});
        console.log('Claude Session 1でtsukuyomi予約:', state1);
        
        // === Claude Code セッション2（新しいMCPサーバープロセス） ===
        const session2Id = 'claude_session_2';
        
        // セッション2のMCPサーバーが起動時にcleanupを実行（時間ベース）
        await fileManager.cleanupStaleOperators(session2Id);
        
        const state2 = await fileManager.readJsonFile(filePath, {});
        console.log('Claude Session 2のcleanup後:', state2);
        
        // 時間ベースcleanupなので最近の予約は保持される
        expect(state2.operators.tsukuyomi).toBeDefined();
        expect(state2.operators.tsukuyomi.session_id).toBe(session1Id);
    });

    test('時間ベースcleanup：最近の予約は他セッションのcleanupで保持される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 現在のテストプロセスで予約
        const currentSessionId = 'test_session';
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', currentSessionId);
        expect(success).toBe(true);
        
        // 異なるセッションからcleanupを実行（時間ベース）
        await fileManager.cleanupStaleOperators('different_session');
        
        // 時間ベースなので最近の予約は保持される
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state = await fileManager.readJsonFile(filePath, {});
        console.log('時間ベースcleanup後の予約状態:', state);
        
        // 正常：最近の予約は時間ベースで保持される
        expect(state.operators.tsukuyomi).toBeDefined();
        expect(state.operators.tsukuyomi.session_id).toBe(currentSessionId);
    });
});