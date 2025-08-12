/**
 * src/operator/operator-state-manager.test.ts: OperatorStateManagerテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperatorStateManager } from './operator-state-manager.js';
import FileOperationManager from './file-operation-manager.js';
import ConfigManager from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OperatorStateManager', () => {
    let stateManager: OperatorStateManager;
    let fileManager: FileOperationManager;
    let configManager: ConfigManager;
    let tempDir: string;
    const sessionId = 'test-session-123';
    
    // Issue #35: テストID生成安定化 - 一意で衝突しないID生成
    let testIdCounter = 0;
    const generateTestOperatorId = () => `test-operator-${Date.now()}-${++testIdCounter}`;

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `coeiro-state-test-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        fileManager = new FileOperationManager();
        configManager = new ConfigManager(tempDir);
        
        // モックの設定ファイルを作成（ConfigManagerのテスト用）
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032'
        };
        await writeFile(join(tempDir, 'coeiroink-config.json'), JSON.stringify(coeiroinkConfig), 'utf8');
        
        stateManager = new OperatorStateManager(sessionId, fileManager);
        await stateManager.initialize(configManager);
    });

    afterEach(async () => {
        // 現在のセッションのオペレータを解放
        try {
            await stateManager.silentReleaseCurrentOperator();
        } catch (e) {
            // エラーは無視（既に解放済みの場合）
        }
        
        // 全オペレータを強制的にクリア
        try {
            await stateManager.clearAllOperators();
        } catch (e) {
            // エラーは無視
        }
        
        // 一時ディレクトリをクリーンアップ
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe('getAvailableOperators', () => {
        test('利用可能なオペレータリストを取得する', async () => {
            // ConfigManagerの動的設定を構築（モック）
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(['operator1', 'operator2', 'operator3']);
            
            const availableOperators = await stateManager.getAvailableOperators();
            expect(availableOperators).toEqual(['operator1', 'operator2', 'operator3']);
        });

        test('利用中のオペレータを除外して返す', async () => {
            // ConfigManagerの動的設定を構築（モック）
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(['operator1', 'operator2', 'operator3']);
            
            // operator1を別のセッションで予約
            const otherStateManager = new OperatorStateManager('other-session', fileManager);
            await otherStateManager.initialize(configManager);
            await otherStateManager.reserveOperator('operator1');
            
            const availableOperators = await stateManager.getAvailableOperators();
            expect(availableOperators).toEqual(['operator2', 'operator3']);
        });
    });

    describe('reserveOperator', () => {
        test('利用可能なオペレータを正常に予約する', async () => {
            const testOperatorId = generateTestOperatorId();
            const result = await stateManager.reserveOperator(testOperatorId);
            expect(result).toBe(true);
            
            // 現在のオペレータIDを確認
            const currentOperatorId = await stateManager.getCurrentOperatorId();
            expect(currentOperatorId).toBe(testOperatorId);
        });

        test('既に利用中のオペレータの予約を拒否する', async () => {
            const testOperatorId = generateTestOperatorId();
            
            // まず別のStateManagerで同じオペレータを予約
            const otherStateManager = new OperatorStateManager('other-session', fileManager);
            await otherStateManager.initialize(configManager);
            await otherStateManager.reserveOperator(testOperatorId);
            
            // 今のセッションで同じオペレータを予約しようとすると失敗
            await expect(stateManager.reserveOperator(testOperatorId)).rejects.toThrow(`オペレータ ${testOperatorId} は既に利用中です`);
        });
    });

    describe('releaseOperator', () => {
        test('予約されたオペレータを正常に返却する', async () => {
            const testOperatorId = generateTestOperatorId();
            
            // 事前にオペレータを予約
            await stateManager.reserveOperator(testOperatorId);
            
            const result = await stateManager.releaseOperator();
            expect(result.operatorId).toBe(testOperatorId);
            expect(result.success).toBe(true);
            
            // 現在のオペレータが解放されていることを確認
            const currentOperatorId = await stateManager.getCurrentOperatorId();
            expect(currentOperatorId).toBeNull();
        });

        test('オペレータが割り当てられていない場合はエラー', async () => {
            await expect(stateManager.releaseOperator()).rejects.toThrow('このセッションにはオペレータが割り当てられていません');
        });
    });

    describe('getCurrentOperatorId', () => {
        test('現在のオペレータIDを取得する', async () => {
            const testOperatorId = generateTestOperatorId();
            await stateManager.reserveOperator(testOperatorId);
            
            const currentId = await stateManager.getCurrentOperatorId();
            expect(currentId).toBe(testOperatorId);
        });

        test('オペレータが割り当てられていない場合はnullを返す', async () => {
            const currentId = await stateManager.getCurrentOperatorId();
            expect(currentId).toBeNull();
        });
    });

    describe('isOperatorBusy', () => {
        test('利用中のオペレータに対してtrueを返す', async () => {
            // 前のテストの状態をクリア
            await stateManager.clearAllOperators();
            
            const testOperatorId = generateTestOperatorId();
            
            // ConfigManagerのモックを設定
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue([testOperatorId, 'other-operator']);
            
            await stateManager.reserveOperator(testOperatorId);
            
            const isBusy = await stateManager.isOperatorBusy(testOperatorId);
            expect(isBusy).toBe(true);
            
            // テスト後にクリーンアップ
            await stateManager.silentReleaseCurrentOperator();
        });

        test('利用可能なオペレータに対してfalseを返す', async () => {
            // 確実にユニークなIDを生成し、事前にクリアを実行
            await stateManager.clearAllOperators();
            const testOperatorId = generateTestOperatorId();
            
            // ConfigManagerのモックを設定して利用可能オペレータリストに含める
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue([testOperatorId, 'other-operator']);
            
            const isBusy = await stateManager.isOperatorBusy(testOperatorId);
            expect(isBusy).toBe(false);
        });
    });

    describe('silentReleaseCurrentOperator', () => {
        test('現在のオペレータをサイレントで解放する', async () => {
            const testOperatorId = generateTestOperatorId();
            await stateManager.reserveOperator(testOperatorId);
            
            const releasedId = await stateManager.silentReleaseCurrentOperator();
            expect(releasedId).toBe(testOperatorId);
            
            // オペレータが解放されていることを確認
            const currentOperatorId = await stateManager.getCurrentOperatorId();
            expect(currentOperatorId).toBeNull();
        });

        test('オペレータが割り当てられていない場合はnullを返す', async () => {
            const releasedId = await stateManager.silentReleaseCurrentOperator();
            expect(releasedId).toBeNull();
        });
    });

    describe('clearAllOperators', () => {
        test('全てのオペレータの利用状況をクリアする', async () => {
            const testOperatorId = generateTestOperatorId();
            
            // 事前にオペレータを予約
            await stateManager.reserveOperator(testOperatorId);
            
            const result = await stateManager.clearAllOperators();
            expect(result).toBe(true);
            
            // クリア後は現在のオペレータがnullになっていることを確認
            const currentOperatorId = await stateManager.getCurrentOperatorId();
            expect(currentOperatorId).toBeNull();
        });
    });
});