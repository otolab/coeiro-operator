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
        
        // テスト用に統一ファイルパスを上書き
        const testFilePath = join(tempDir, 'test-operators.json');
        fileManager.getUnifiedOperatorFilePath = () => testFilePath;
        
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

    // Issue #56: operator重複アサイン問題のテスト
    describe('Issue #56: operator重複アサイン問題', () => {
        test('アサインされたオペレータが利用可能リストから除外されること', async () => {
            // ConfigManagerのモックを設定
            const mockOperators = ['tsukuyomi', 'metan', 'zundamon'];
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(mockOperators);

            // 初期状態：全オペレータが利用可能
            const initialAvailable = await stateManager.getAvailableOperators();
            expect(initialAvailable).toEqual(mockOperators);

            // tsukuyomiを予約
            await stateManager.reserveOperator('tsukuyomi');

            // 予約後：tsukuyomiが利用可能リストから除外されること
            const availableAfterReserve = await stateManager.getAvailableOperators();
            expect(availableAfterReserve).not.toContain('tsukuyomi');
            expect(availableAfterReserve).toContain('metan');
            expect(availableAfterReserve).toContain('zundamon');

            // isOperatorBusyも正しく動作すること
            const busyResult = await stateManager.isOperatorBusy('tsukuyomi');
            expect(busyResult).toBe(true);

            // 他のオペレータは引き続き利用可能
            const metanBusy = await stateManager.isOperatorBusy('metan');
            expect(metanBusy).toBe(false);
        });

        test('オペレータ解放後に利用可能リストに戻ること', async () => {
            // ConfigManagerのモックを設定
            const mockOperators = ['tsukuyomi', 'metan', 'zundamon'];
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(mockOperators);

            // tsukuyomiを予約
            await stateManager.reserveOperator('tsukuyomi');

            // 予約後は利用不可
            const availableAfterReserve = await stateManager.getAvailableOperators();
            expect(availableAfterReserve).not.toContain('tsukuyomi');

            // 解放
            const releaseResult = await stateManager.releaseOperator();
            expect(releaseResult.operatorId).toBe('tsukuyomi');
            expect(releaseResult.success).toBe(true);

            // 解放後は利用可能に戻る
            const availableAfterRelease = await stateManager.getAvailableOperators();
            expect(availableAfterRelease).toContain('tsukuyomi');

            // isOperatorBusyも正しく動作すること
            const busyAfterRelease = await stateManager.isOperatorBusy('tsukuyomi');
            expect(busyAfterRelease).toBe(false);
        });

        test('異なるセッションからの同じオペレータ予約を拒否すること', async () => {
            // セッション1でtsukuyomiを予約
            await stateManager.reserveOperator('tsukuyomi');

            // セッション2から同じオペレータを予約しようとする
            const session2Id = 'test-session-2-' + Date.now();
            const fileManager2 = new FileOperationManager();
            // 同じ統一ファイルパスを使用
            const testFilePath = join(tempDir, 'test-operators.json');
            fileManager2.getUnifiedOperatorFilePath = () => testFilePath;
            
            const stateManager2 = new OperatorStateManager(session2Id, fileManager2);
            await stateManager2.initialize(configManager);

            // 予約に失敗することを確認
            await expect(stateManager2.reserveOperator('tsukuyomi'))
                .rejects.toThrow('オペレータ tsukuyomi は既に利用中です');
        });

        test('同じセッションからの重複予約は成功すること', async () => {
            // 最初の予約
            const firstReserve = await stateManager.reserveOperator('tsukuyomi');
            expect(firstReserve).toBe(true);

            // 同じセッションからの重複予約は成功
            const secondReserve = await stateManager.reserveOperator('tsukuyomi');
            expect(secondReserve).toBe(true);

            // 現在のオペレータIDも正しく設定されていること
            const currentOperatorId = await stateManager.getCurrentOperatorId();
            expect(currentOperatorId).toBe('tsukuyomi');
        });
    });
});