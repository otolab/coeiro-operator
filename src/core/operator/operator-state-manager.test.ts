/**
 * src/operator/operator-state-manager.test.ts: OperatorStateManagerテスト
 */

import { OperatorStateManager } from './operator-state-manager.js';
import FileOperationManager, { ActiveOperators, SessionData } from './file-operation-manager.js';
import ConfigManager from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OperatorStateManager', () => {
    let stateManager: OperatorStateManager;
    let fileManager: FileOperationManager;
    let configManager: ConfigManager;
    let tempDir: string;
    let activeOperatorsFile: string;
    let sessionOperatorFile: string;
    const sessionId = 'test-session-123';

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `coeiro-state-test-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        activeOperatorsFile = join(tempDir, 'active-operators.json');
        sessionOperatorFile = join(tempDir, `session-operator-${sessionId}.json`);
        
        fileManager = new FileOperationManager();
        configManager = new ConfigManager(tempDir);
        
        // モックの設定ファイルを作成（ConfigManagerのテスト用）
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032'
        };
        await writeFile(join(tempDir, 'coeiroink-config.json'), JSON.stringify(coeiroinkConfig), 'utf8');
        
        stateManager = new OperatorStateManager(sessionId, fileManager);
        stateManager.initialize(activeOperatorsFile, sessionOperatorFile, configManager);
    });

    afterEach(async () => {
        // 一時ディレクトリをクリーンアップ
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
    });

    describe('getAvailableOperators', () => {
        test('利用可能なオペレータリストを取得する', async () => {
            // ConfigManagerの動的設定を構築（モック）
            jest.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(['operator1', 'operator2', 'operator3']);
            
            const availableOperators = await stateManager.getAvailableOperators();
            expect(availableOperators).toEqual(['operator1', 'operator2', 'operator3']);
        });

        test('利用中のオペレータを除外して返す', async () => {
            // ConfigManagerの動的設定を構築（モック）
            jest.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(['operator1', 'operator2', 'operator3']);
            
            // operator1を利用中にセット
            const activeData = {
                active: { 'operator1': 'other-session' },
                last_updated: new Date().toISOString()
            };
            await fileManager.writeJsonFile(activeOperatorsFile, activeData);
            
            const availableOperators = await stateManager.getAvailableOperators();
            expect(availableOperators).toEqual(['operator2', 'operator3']);
        });
    });

    describe('reserveOperator', () => {
        test('利用可能なオペレータを正常に予約する', async () => {
            const result = await stateManager.reserveOperator('operator1');
            expect(result).toBe(true);
            
            // アクティブオペレータファイルを確認
            const activeData = await fileManager.readJsonFile<ActiveOperators>(activeOperatorsFile, { active: {}, last_updated: '' });
            expect(activeData.active['operator1']).toBe(sessionId);
            
            // セッションファイルを確認
            const sessionData = await fileManager.readJsonFile<SessionData>(sessionOperatorFile, {} as SessionData);
            expect(sessionData.operator_id).toBe('operator1');
            expect(sessionData.session_id).toBe(sessionId);
        });

        test('既に利用中のオペレータの予約を拒否する', async () => {
            // operator1を他のセッションで利用中にセット
            const activeData = {
                active: { 'operator1': 'other-session' },
                last_updated: new Date().toISOString()
            };
            await fileManager.writeJsonFile(activeOperatorsFile, activeData);
            
            await expect(stateManager.reserveOperator('operator1')).rejects.toThrow('オペレータ operator1 は既に利用中です');
        });
    });

    describe('releaseOperator', () => {
        test('予約されたオペレータを正常に返却する', async () => {
            // 事前にオペレータを予約
            await stateManager.reserveOperator('operator1');
            
            const result = await stateManager.releaseOperator();
            expect(result.operatorId).toBe('operator1');
            expect(result.success).toBe(true);
            
            // アクティブオペレータファイルからoperator1が削除されていることを確認
            const activeData = await fileManager.readJsonFile<ActiveOperators>(activeOperatorsFile, { active: {}, last_updated: '' });
            expect(activeData.active['operator1']).toBeUndefined();
            
            // セッションファイルが削除されていることを確認
            const sessionExists = await fileManager.fileExists(sessionOperatorFile);
            expect(sessionExists).toBe(false);
        });

        test('オペレータが割り当てられていない場合はエラー', async () => {
            await expect(stateManager.releaseOperator()).rejects.toThrow('このセッションにはオペレータが割り当てられていません');
        });
    });

    describe('getCurrentOperatorId', () => {
        test('現在のオペレータIDを取得する', async () => {
            await stateManager.reserveOperator('operator1');
            
            const currentId = await stateManager.getCurrentOperatorId();
            expect(currentId).toBe('operator1');
        });

        test('オペレータが割り当てられていない場合はnullを返す', async () => {
            const currentId = await stateManager.getCurrentOperatorId();
            expect(currentId).toBeNull();
        });
    });

    describe('isOperatorBusy', () => {
        test('利用中のオペレータに対してtrueを返す', async () => {
            await stateManager.reserveOperator('operator1');
            
            const isBusy = await stateManager.isOperatorBusy('operator1');
            expect(isBusy).toBe(true);
        });

        test('利用可能なオペレータに対してfalseを返す', async () => {
            const isBusy = await stateManager.isOperatorBusy('operator1');
            expect(isBusy).toBe(false);
        });
    });

    describe('silentReleaseCurrentOperator', () => {
        test('現在のオペレータをサイレントで解放する', async () => {
            await stateManager.reserveOperator('operator1');
            
            const releasedId = await stateManager.silentReleaseCurrentOperator();
            expect(releasedId).toBe('operator1');
            
            // オペレータが解放されていることを確認
            const activeData = await fileManager.readJsonFile<ActiveOperators>(activeOperatorsFile, { active: {}, last_updated: '' });
            expect(activeData.active['operator1']).toBeUndefined();
        });

        test('オペレータが割り当てられていない場合はnullを返す', async () => {
            const releasedId = await stateManager.silentReleaseCurrentOperator();
            expect(releasedId).toBeNull();
        });
    });

    describe('clearAllOperators', () => {
        test('全てのオペレータの利用状況をクリアする', async () => {
            // 複数のオペレータを利用中にセット
            const activeData = {
                active: { 
                    'operator1': 'session1', 
                    'operator2': 'session2' 
                },
                last_updated: new Date().toISOString()
            };
            await fileManager.writeJsonFile(activeOperatorsFile, activeData);
            
            const result = await stateManager.clearAllOperators();
            expect(result).toBe(true);
            
            // アクティブオペレータファイルが削除されていることを確認
            const fileExists = await fileManager.fileExists(activeOperatorsFile);
            expect(fileExists).toBe(false);
        });
    });
});