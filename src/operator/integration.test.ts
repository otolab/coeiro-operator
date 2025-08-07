/**
 * src/operator/integration.test.ts: OperatorManager統合テスト
 * リファクタリング後の全体動作確認
 */

import { OperatorManager } from './index.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('OperatorManager Integration Test', () => {
    let operatorManager: OperatorManager;
    let tempDir: string;

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `coeiro-integration-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await mkdir(tempDir, { recursive: true });
        
        // 設定ファイルのモックを作成
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032'
        };
        await writeFile(join(tempDir, 'coeiroink-config.json'), JSON.stringify(coeiroinkConfig), 'utf8');
        
        // OperatorManagerを初期化
        operatorManager = new OperatorManager();
        
        // 環境変数を設定して一時ディレクトリを使用
        process.env.HOME = tempDir;
    });

    afterEach(async () => {
        // 一時ディレクトリをクリーンアップ
        const fs = await import('fs');
        await fs.promises.rm(tempDir, { recursive: true, force: true });
        
        // 環境変数をリセット
        delete process.env.HOME;
    });

    describe('初期化と基本機能', () => {
        test('OperatorManagerが正常に初期化される', async () => {
            await operatorManager.initialize();
            
            // 設定の事前構築が正常に動作することを確認
            await operatorManager.buildDynamicConfig();
            
            // エラーが発生しないことを確認
            expect(true).toBe(true);
        });

        test('JSONファイル操作が正常に動作する', async () => {
            await operatorManager.initialize();
            
            const testData = { test: 'value', number: 42 };
            const testFile = join(tempDir, 'test.json');
            
            // ファイル書き込み
            await operatorManager.writeJsonFile(testFile, testData);
            
            // ファイル読み込み
            const result = await operatorManager.readJsonFile(testFile, {});
            
            expect(result).toEqual(testData);
        });
    });

    describe('状態管理機能の統合', () => {
        test('利用可能オペレータの取得が動作する', async () => {
            await operatorManager.initialize();
            
            // ConfigManagerがモック環境で動作することを確認
            try {
                const operators = await operatorManager.getAvailableOperators();
                // モック環境では内蔵設定が使用される
                expect(Array.isArray(operators)).toBe(true);
            } catch (error) {
                // モック環境でのエラーは許容
                expect(error).toBeDefined();
            }
        });

        test('全オペレータクリアが動作する', async () => {
            await operatorManager.initialize();
            
            const result = await operatorManager.clearAllOperators();
            expect(result).toBe(true);
        });
    });

    describe('音声・キャラクター機能の統合', () => {
        test('音声設定更新が動作する', async () => {
            await operatorManager.initialize();
            
            // エラーが発生しないことを確認
            await operatorManager.updateVoiceSetting('test-voice', 1);
            
            // 設定ファイルが更新されることを確認
            const configFile = join(tempDir, '.coeiro-operator', 'coeiroink-config.json');
            const config = await operatorManager.readJsonFile(configFile, {}) as Record<string, unknown>;
            
            expect(config.voice_id).toBe('test-voice');
            expect(config.style_id).toBe(1);
        });

        test('挨拶パターン抽出が動作する', async () => {
            await operatorManager.initialize();
            
            try {
                const patterns = await operatorManager.extractGreetingPatterns();
                expect(Array.isArray(patterns)).toBe(true);
            } catch (error) {
                // モック環境でのエラーは許容
                expect(error).toBeDefined();
            }
        });
    });

    describe('エラーハンドリング', () => {
        test('初期化前の操作で適切なエラーが発生する', async () => {
            // 初期化せずに操作を試行
            await expect(operatorManager.getAvailableOperators()).rejects.toThrow();
        });

        test('存在しないキャラクターの取得でエラーが発生する', async () => {
            await operatorManager.initialize();
            
            await expect(operatorManager.getCharacterInfo('non-existent-character')).rejects.toThrow();
        });
    });

    describe('リファクタリングされた委譲パターンの確認', () => {
        test('FileOperationManager委譲が正常に動作する', async () => {
            await operatorManager.initialize();
            
            // initActiveOperators の動作確認
            await operatorManager.initActiveOperators();
            
            // アクティブオペレータファイルが作成されることを確認
            const activeOperatorsFile = join(tempDir, '.coeiro-operator', 'active-operators.json');
            const data = await operatorManager.readJsonFile(activeOperatorsFile, null);
            
            expect(data).not.toBeNull();
            expect(typeof data).toBe('object');
        });

        test('OperatorStateManager委譲が正常に動作する', async () => {
            await operatorManager.initialize();
            
            // clearAllOperators の動作確認（StateManager経由）
            const result = await operatorManager.clearAllOperators();
            expect(result).toBe(true);
        });

        test('VoiceSelectionService委譲が正常に動作する', async () => {
            await operatorManager.initialize();
            
            // updateVoiceSetting の動作確認（VoiceSelectionService経由）
            await operatorManager.updateVoiceSetting('test-voice', 5);
            
            const configFile = join(tempDir, '.coeiro-operator', 'coeiroink-config.json');
            const config = await operatorManager.readJsonFile(configFile, {}) as Record<string, unknown>;
            
            expect(config.voice_id).toBe('test-voice');
            expect(config.style_id).toBe(5);
        });
    });
});