/**
 * Issue #58: sayコマンドの改善機能テスト
 * - 動的タイムアウト延長
 * - アサインなし時の再アサイン促進メッセージ
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import OperatorManager from './index.js';
import ConfigManager from './config-manager.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, rm, writeFile } from 'fs/promises';

describe('Issue #58: sayコマンド改善機能', () => {
    let operatorManager: OperatorManager;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `issue58-${Date.now()}`);
        await mkdir(tempDir, { recursive: true });
        
        // .coeiro-operatorサブディレクトリを作成
        const configSubDir = join(tempDir, '.coeiro-operator');
        await mkdir(configSubDir, { recursive: true });
        
        // 設定ファイルのモックを作成
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032',
            voice: {
                default_voice_id: 'test-voice-123',
                rate: 200
            }
        };
        await writeFile(join(configSubDir, 'coeiroink-config.json'), JSON.stringify(coeiroinkConfig), 'utf8');
        
        const operatorConfig = {
            characters: {
                'test-operator-1': {
                    name: 'テストキャラ1',
                    personality: 'テスト用',
                    speaking_style: 'フレンドリー',
                    voice_id: 'test-voice-1',
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

    describe('動的タイムアウト延長機能', () => {
        test('refreshOperatorReservationメソッドが正常に動作すること', async () => {
            // オペレータを予約
            await operatorManager.reserveOperator('test-operator-1');
            
            // タイムアウト延長を実行
            const success = await operatorManager.refreshOperatorReservation();
            expect(success).toBe(true);
        });

        test('オペレータが割り当てられていない場合は延長が失敗すること', async () => {
            // オペレータを予約せずに延長を試行
            const success = await operatorManager.refreshOperatorReservation();
            expect(success).toBe(false);
        });

        test('予約されていないオペレータの延長は失敗すること', async () => {
            // オペレータを予約せずに延長を試行
            const success = await operatorManager.refreshOperatorReservation();
            expect(success).toBe(false);
        });
    });

    describe('予約状態の一貫性確認', () => {
        test('refreshOperatorReservation後もオペレータ状態が維持されること', async () => {
            // オペレータを予約
            await operatorManager.reserveOperator('test-operator-1');
            
            // 予約延長前の状態確認
            const operatorBeforeRefresh = await operatorManager.getCurrentOperatorId();
            expect(operatorBeforeRefresh).toBe('test-operator-1');
            
            // 予約延長実行
            const refreshSuccess = await operatorManager.refreshOperatorReservation();
            expect(refreshSuccess).toBe(true);
            
            // 予約延長後の状態確認
            const operatorAfterRefresh = await operatorManager.getCurrentOperatorId();
            expect(operatorAfterRefresh).toBe('test-operator-1');
            
            // 利用可能オペレータからは除外されていることを確認
            const availableOperators = await operatorManager.getAvailableOperators();
            expect(availableOperators).not.toContain('test-operator-1');
        });

        test('refreshOperatorReservation後のセッション管理が正しく動作すること', async () => {
            // オペレータを予約
            await operatorManager.reserveOperator('test-operator-1');
            
            // 予約延長実行
            const success = await operatorManager.refreshOperatorReservation();
            expect(success).toBe(true);
            
            // セッション状態が正しく維持されることを確認
            const isValid = await operatorManager.validateCurrentOperatorSession();
            expect(isValid).toBe(true);
        });
    });
});