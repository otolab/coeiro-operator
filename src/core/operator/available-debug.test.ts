/**
 * available機能のデバッグテスト
 * 根本原因を特定するための証明テスト
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('Available機能デバッグ', () => {
    let fileManager: FileOperationManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `available-debug-${Date.now()}`);
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

    test('セッションIDなしの場合は全予約を除外すること', async () => {
        const allOperators = ['angie', 'alma', 'tsukuyomi'];

        // 初期化
        await fileManager.initUnifiedOperatorState();

        // tsukuyomiを予約
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // セッションIDなしで利用可能オペレータを取得
        const available = await fileManager.getAvailableOperatorsUnified(allOperators);
        
        // tsukuyomiは除外されているべき
        expect(available).toEqual(['angie', 'alma']);
        expect(available).not.toContain('tsukuyomi');
    });

    test('セッションID指定の場合の問題を実証', async () => {
        const allOperators = ['angie', 'alma', 'tsukuyomi'];

        // 初期化
        await fileManager.initUnifiedOperatorState();

        // session_1でtsukuyomiを予約
        const success = await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');
        expect(success).toBe(true);

        // 同じセッション（session_1）から利用可能オペレータを取得
        const availableFromSameSession = await fileManager.getAvailableOperatorsUnified(allOperators, 'session_1');
        
        // 現在の実装では、同じセッションの予約は除外されない（これが問題）
        console.log('同じセッションから見た利用可能:', availableFromSameSession);
        expect(availableFromSameSession).toContain('tsukuyomi'); // ← これが問題の証明

        // 異なるセッション（session_2）から利用可能オペレータを取得
        const availableFromDifferentSession = await fileManager.getAvailableOperatorsUnified(allOperators, 'session_2');
        
        // 異なるセッションからは、tsukuyomiは除外される
        console.log('異なるセッションから見た利用可能:', availableFromDifferentSession);
        expect(availableFromDifferentSession).not.toContain('tsukuyomi');
    });

    test('正しい仕様：availableは全予約を除外すべき', async () => {
        const allOperators = ['angie', 'alma', 'tsukuyomi'];

        // 初期化
        await fileManager.initUnifiedOperatorState();

        // session_1でtsukuyomiを予約
        await fileManager.reserveOperatorUnified('tsukuyomi', 'session_1');

        // session_2でangieを予約
        await fileManager.reserveOperatorUnified('angie', 'session_2');

        // セッションIDなしで取得（これが正しい動作）
        const available = await fileManager.getAvailableOperatorsUnified(allOperators);
        
        // 予約済みのオペレータは全て除外される
        expect(available).toEqual(['alma']);
        expect(available).not.toContain('tsukuyomi');
        expect(available).not.toContain('angie');
    });
});