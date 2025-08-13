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
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
    });

    test('CLI環境シミュレーション：短命プロセスの予約が次回実行で削除される', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // === プロセス1（CLI assign）のシミュレーション ===
        const process1SessionId = 'session_1';
        const process1Pid = 12345; // 短命プロセス
        
        // 手動で予約を作成（短命プロセスをシミュレート）
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const initialState = await fileManager.readJsonFile(filePath, {});
        initialState.operators = {
            tsukuyomi: {
                session_id: process1SessionId,
                process_id: process1Pid.toString(),
                reserved_at: new Date().toISOString()
            }
        };
        initialState.last_updated = new Date().toISOString();
        await fileManager.writeJsonFile(filePath, initialState);
        
        console.log('プロセス1（CLI assign）後の状態:', initialState);
        
        // === プロセス2（CLI available）のシミュレーション ===
        const process2SessionId = 'session_2';
        
        // プロセス2が初期化時にcleanupを実行（現在の実装）
        await fileManager.cleanupStaleOperators(process2SessionId);
        
        // プロセス1は既に終了しているので、予約が削除される
        const stateAfterCleanup = await fileManager.readJsonFile(filePath, {});
        console.log('プロセス2（cleanup後）の状態:', stateAfterCleanup);
        
        // 問題：短命プロセスの予約が削除される
        expect(stateAfterCleanup.operators.tsukuyomi).toBeUndefined();
        expect(Object.keys(stateAfterCleanup.operators)).toHaveLength(0);
    });

    test('MCP環境シミュレーション：Claude Codeセッション毎の新プロセス', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // === Claude Code セッション1 ===
        const session1Id = 'claude_session_1';
        const session1Pid = 11111;
        
        const success1 = await fileManager.reserveOperatorUnified('tsukuyomi', session1Id);
        expect(success1).toBe(true);
        
        // 手動でプロセスIDを設定（実際のMCP環境をシミュレート）
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state1 = await fileManager.readJsonFile(filePath, {});
        state1.operators.tsukuyomi.process_id = session1Pid.toString();
        await fileManager.writeJsonFile(filePath, state1);
        
        console.log('Claude Session 1でtsukuyomi予約:', state1);
        
        // === Claude Code セッション2（新しいMCPサーバープロセス） ===
        const session2Id = 'claude_session_2';
        
        // セッション2のMCPサーバーが起動時にcleanupを実行
        await fileManager.cleanupStaleOperators(session2Id);
        
        const state2 = await fileManager.readJsonFile(filePath, {});
        console.log('Claude Session 2のcleanup後:', state2);
        
        // 問題：セッション1のMCPプロセスが終了していれば削除される
        // （実際はClaude Codeを閉じるまで動作し続けるが、別セッションから見ると削除される場合がある）
    });

    test('正しい動作：長時間プロセスでの予約管理', async () => {
        await fileManager.initUnifiedOperatorState();
        
        // 現在のテストプロセス（長時間動作）で予約
        const currentSessionId = 'test_session';
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', currentSessionId);
        expect(success).toBe(true);
        
        // 異なるセッションからcleanupを実行
        await fileManager.cleanupStaleOperators('different_session');
        
        // 現在のプロセスは生きているので予約は保持される
        const filePath = fileManager.getUnifiedOperatorFilePath();
        const state = await fileManager.readJsonFile(filePath, {});
        console.log('長時間プロセスでの予約状態:', state);
        
        // 正常：生きているプロセスの予約は保持される
        expect(state.operators.tsukuyomi).toBeDefined();
        expect(state.operators.tsukuyomi.session_id).toBe(currentSessionId);
    });
});