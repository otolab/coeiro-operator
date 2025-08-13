/**
 * available機能修正後のテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperatorStateManager } from './operator-state-manager.js';
import { FileOperationManager } from './file-operation-manager.js';
import ConfigManager from './config-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm } from 'fs/promises';

describe('Available機能修正後テスト', () => {
    let stateManager: OperatorStateManager;
    let fileManager: FileOperationManager;
    let configManager: ConfigManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `available-fix-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        fileManager = new FileOperationManager();
        configManager = new ConfigManager(tempDir);
        stateManager = new OperatorStateManager('test-session', fileManager);

        // テスト用に統一ファイルパスを上書き
        const testFilePath = join(tempDir, 'test-operators.json');
        fileManager.getUnifiedOperatorFilePath = () => testFilePath;

        // ConfigManagerのモック設定
        const mockOperators = ['angie', 'alma', 'tsukuyomi'];
        vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(mockOperators);

        await stateManager.initialize(configManager);
    });

    afterEach(async () => {
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
    });

    test('修正後：予約したオペレータがavailableから除外されること', async () => {
        // 初期状態：全オペレータが利用可能
        const initialAvailable = await stateManager.getAvailableOperators();
        expect(initialAvailable).toEqual(['angie', 'alma', 'tsukuyomi']);

        // tsukuyomiを予約
        await stateManager.reserveOperator('tsukuyomi');

        // 予約後：tsukuyomiが利用可能リストから除外されること
        // Issue #56修正: 同じセッションでも予約されたオペレータは除外される
        const availableAfterReserve = await stateManager.getAvailableOperators();
        expect(availableAfterReserve).not.toContain('tsukuyomi');
        expect(availableAfterReserve).toEqual(['angie', 'alma']);
    });

    test('複数オペレータ予約時の動作確認', async () => {
        // angieを予約
        await stateManager.reserveOperator('angie');
        
        // angie予約後はangie以外が利用可能
        const availableAfterAngie = await stateManager.getAvailableOperators();
        expect(availableAfterAngie).toEqual(['alma', 'tsukuyomi']);

        // 同じセッションで別のオペレータを予約するには、前のオペレータを解放する必要がある
        await stateManager.releaseOperator();
        
        // tsukuyomiを予約
        await stateManager.reserveOperator('tsukuyomi');

        // tsukuyomi予約後はtsukuyomi以外が利用可能
        const availableAfterTsukuyomi = await stateManager.getAvailableOperators();
        expect(availableAfterTsukuyomi).toEqual(['angie', 'alma']);
    });
});