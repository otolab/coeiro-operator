/**
 * available機能修正後のテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import OperatorManager from './index.js';
import ConfigManager from './config-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm, writeFile } from 'fs/promises';

describe('Available機能修正後テスト', () => {
    let operatorManager: OperatorManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `available-fix-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        // .coeiro-operatorサブディレクトリを作成
        const configSubDir = join(tempDir, '.coeiro-operator');
        await mkdir(configSubDir, { recursive: true });
        
        // 設定ファイルのモックを作成
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032'
        };
        await writeFile(join(configSubDir, 'coeiroink-config.json'), JSON.stringify(coeiroinkConfig), 'utf8');
        
        const operatorConfig = {
            characters: {
                'operator1': {
                    name: 'オペレータ1',
                    personality: 'テスト用',
                    speaking_style: 'フレンドリー',
                    voice_id: 'voice-1',
                    default_style: 'normal',
                    style_selection: 'default',
                    available_styles: {
                        normal: {
                            name: 'ノーマル',
                            personality: '普通',
                            speaking_style: '標準',
                            style_id: 0,
                            disabled: false
                        }
                    }
                },
                'operator2': {
                    name: 'オペレータ2',
                    personality: 'テスト用2',
                    speaking_style: 'クール',
                    voice_id: 'voice-2',
                    default_style: 'cool',
                    style_selection: 'default',
                    available_styles: {
                        cool: {
                            name: 'クール',
                            personality: 'クール',
                            speaking_style: '冷静',
                            style_id: 1,
                            disabled: false
                        }
                    }
                },
                'operator3': {
                    name: 'オペレータ3',
                    personality: 'テスト用3',
                    speaking_style: 'エネルギッシュ',
                    voice_id: 'voice-3',
                    default_style: 'energetic',
                    style_selection: 'default',
                    available_styles: {
                        energetic: {
                            name: 'エネルギッシュ',
                            personality: 'エネルギッシュ',
                            speaking_style: '元気',
                            style_id: 2,
                            disabled: false
                        }
                    }
                }
            }
        };
        await writeFile(join(configSubDir, 'operator-config.json'), JSON.stringify(operatorConfig), 'utf8');
        
        operatorManager = new OperatorManager();
        
        // HOMEディレクトリを一時ディレクトリに設定
        const originalHome = process.env.HOME;
        process.env.HOME = tempDir;
        
        await operatorManager.initialize();
        
        // 環境変数を復元
        if (originalHome) {
            process.env.HOME = originalHome;
        } else {
            delete process.env.HOME;
        }
    });

    afterEach(async () => {
        try {
            await operatorManager.silentReleaseCurrentOperator();
            await operatorManager.clearAllOperators();
        } catch {
            // エラーは無視
        }
        
        try {
            await rm(tempDir, { recursive: true, force: true });
        } catch {
            // エラーは無視
        }
        
        vi.restoreAllMocks();
    });

    test('修正後：予約したオペレータがavailableから除外されること', async () => {
        // 初期状態：全オペレータが利用可能
        const initialAvailable = await operatorManager.getAvailableOperators();
        expect(initialAvailable).toContain('operator1');
        expect(initialAvailable).toContain('operator2');
        expect(initialAvailable).toContain('operator3');

        // operator1を予約
        await operatorManager.reserveOperator('operator1');

        // 予約後：operator1が利用可能リストから除外されること
        // Issue #56修正: 同じセッションでも予約されたオペレータは除外される
        const availableAfterReserve = await operatorManager.getAvailableOperators();
        expect(availableAfterReserve).not.toContain('operator1');
        expect(availableAfterReserve).toContain('operator2');
        expect(availableAfterReserve).toContain('operator3');
    });

    test('複数オペレータ予約時の動作確認', async () => {
        // operator1を予約
        await operatorManager.reserveOperator('operator1');
        
        // operator1予約後はoperator1以外が利用可能
        const availableAfterOperator1 = await operatorManager.getAvailableOperators();
        expect(availableAfterOperator1).not.toContain('operator1');
        expect(availableAfterOperator1).toContain('operator2');
        expect(availableAfterOperator1).toContain('operator3');

        // 同じセッションで別のオペレータを予約するには、前のオペレータを解放する必要がある
        await operatorManager.releaseOperator();
        
        // operator2を予約
        await operatorManager.reserveOperator('operator2');

        // operator2予約後はoperator2以外が利用可能
        const availableAfterOperator2 = await operatorManager.getAvailableOperators();
        expect(availableAfterOperator2).toContain('operator1');
        expect(availableAfterOperator2).not.toContain('operator2');
        expect(availableAfterOperator2).toContain('operator3');
    });
});