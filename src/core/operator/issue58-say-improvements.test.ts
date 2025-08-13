/**
 * Issue #58: sayコマンドの改善機能テスト
 * - 動的タイムアウト延長
 * - アサインなし時の再アサイン促進メッセージ
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { OperatorStateManager } from './operator-state-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('Issue #58: sayコマンド改善機能', () => {
    let fileManager: FileOperationManager;
    let stateManager: OperatorStateManager;
    let tempDir: string;
    let mockConfigManager: any;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `issue58-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        fileManager = new FileOperationManager();
        stateManager = new OperatorStateManager('test_session', fileManager);
        
        // テスト用に統一ファイルパスを上書き
        const testFilePath = join(tempDir, 'test-operators.json');
        fileManager.getUnifiedOperatorFilePath = () => testFilePath;
        
        // モックConfigManagerを作成
        mockConfigManager = {
            getAvailableCharacterIds: async () => ['tsukuyomi', 'metan', 'zundamon']
        };
        
        await stateManager.initialize(mockConfigManager);
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
    });

    describe('動的タイムアウト延長機能', () => {
        test('refreshOperatorReservationメソッドが正常に動作すること', async () => {
            // オペレータを予約
            await stateManager.reserveOperator('tsukuyomi');
            
            // 初期予約時刻を取得
            const filePath = fileManager.getUnifiedOperatorFilePath();
            const initialState = await fileManager.readJsonFile(filePath, {});
            const initialReservedAt = initialState.operators.tsukuyomi.reserved_at;
            
            // 少し待ってからrefresh実行
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // タイムアウト延長を実行
            const success = await fileManager.refreshOperatorReservation('tsukuyomi', 'test_session');
            expect(success).toBe(true);
            
            // 予約時刻が更新されていることを確認
            const updatedState = await fileManager.readJsonFile(filePath, {});
            const updatedReservedAt = updatedState.operators.tsukuyomi.reserved_at;
            
            expect(updatedReservedAt).not.toBe(initialReservedAt);
            expect(new Date(updatedReservedAt).getTime()).toBeGreaterThan(new Date(initialReservedAt).getTime());
        });

        test('他のセッションのオペレータは延長できないこと', async () => {
            // 別セッションでオペレータを予約
            await fileManager.reserveOperatorUnified('tsukuyomi', 'other_session');
            
            // 現在のセッションから延長を試行
            const success = await fileManager.refreshOperatorReservation('tsukuyomi', 'test_session');
            expect(success).toBe(false);
        });

        test('存在しないオペレータは延長できないこと', async () => {
            // 予約されていないオペレータの延長を試行
            const success = await fileManager.refreshOperatorReservation('nonexistent', 'test_session');
            expect(success).toBe(false);
        });

        test('OperatorStateManagerのrefreshOperatorReservationが正常動作すること', async () => {
            // オペレータを予約
            await stateManager.reserveOperator('metan');
            
            // StateManager経由で延長
            const success = await stateManager.refreshOperatorReservation('metan');
            expect(success).toBe(true);
            
            // 予約が維持されていることを確認
            const currentOperator = await stateManager.getCurrentOperatorId();
            expect(currentOperator).toBe('metan');
        });
    });

    describe('予約状態の一貫性確認', () => {
        test('refreshOperatorReservation後もオペレータ状態が維持されること', async () => {
            // オペレータを予約
            await stateManager.reserveOperator('zundamon');
            
            // 予約延長前の状態確認
            const operatorBeforeRefresh = await stateManager.getCurrentOperatorId();
            expect(operatorBeforeRefresh).toBe('zundamon');
            
            // 予約延長実行
            const refreshSuccess = await stateManager.refreshOperatorReservation('zundamon');
            expect(refreshSuccess).toBe(true);
            
            // 予約延長後の状態確認
            const operatorAfterRefresh = await stateManager.getCurrentOperatorId();
            expect(operatorAfterRefresh).toBe('zundamon');
            
            // 利用可能オペレータからは除外されていることを確認
            const availableOperators = await stateManager.getAvailableOperators();
            expect(availableOperators).not.toContain('zundamon');
        });

        test('refreshOperatorReservation後の統一ファイル構造が正しいこと', async () => {
            // オペレータを予約
            await stateManager.reserveOperator('tsukuyomi');
            
            // 予約延長実行
            await stateManager.refreshOperatorReservation('tsukuyomi');
            
            // ファイル構造確認
            const filePath = fileManager.getUnifiedOperatorFilePath();
            const state = await fileManager.readJsonFile(filePath, {});
            
            // 必須フィールドが存在することを確認
            expect(state.operators).toBeDefined();
            expect(state.operators.tsukuyomi).toBeDefined();
            expect(state.operators.tsukuyomi.session_id).toBe('test_session');
            expect(state.operators.tsukuyomi.process_id).toBeDefined();
            expect(state.operators.tsukuyomi.reserved_at).toBeDefined();
            expect(state.last_updated).toBeDefined();
            
            // 日付フォーマットが正しいことを確認
            expect(() => new Date(state.operators.tsukuyomi.reserved_at)).not.toThrow();
            expect(() => new Date(state.last_updated)).not.toThrow();
        });
    });

    describe('エラーハンドリング', () => {
        test('ファイルロック競合時も適切に処理されること', async () => {
            // オペレータを予約
            await stateManager.reserveOperator('tsukuyomi');
            
            // 複数の同時refresh要求をテスト
            const promises = Array.from({ length: 5 }, () => 
                stateManager.refreshOperatorReservation('tsukuyomi')
            );
            
            const results = await Promise.all(promises);
            
            // すべて成功すること
            results.forEach(result => {
                expect(result).toBe(true);
            });
            
            // 最終状態が一貫していること
            const finalOperator = await stateManager.getCurrentOperatorId();
            expect(finalOperator).toBe('tsukuyomi');
        });
    });
});