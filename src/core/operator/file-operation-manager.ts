/**
 * src/operator/file-operation-manager.ts: ファイル操作管理クラス
 * JSONファイルの読み書き、アトミック操作を担当
 * 
 * Issue #43 対応: 統一ファイル管理システム
 * 
 * 【実装方針】
 * 1. 分離ファイル問題の解決
 *    - active-operators.json (永続) と session-*.json (一時) の重複管理を統一
 *    - システム再起動でセッションIDリセット → 永続性の意味がない問題を解決
 * 
 * 2. 複数プロセス間の排他制御
 *    - ファイルロック機構でread-modify-write操作の競合を防止
 *    - リトライ機構でデッドロック回避
 *    - アトミック操作で一貫性保証
 * 
 * 3. 統一ファイル構造
 *    - /tmp/coeiroink-operators-{hostname}.json に一元化
 *    - プロセス起動時の無効セッション自動クリーンアップ
 *    - session_id + process_id による二重チェック
 * 
 * 4. 移行戦略
 *    - 既存ファイルからの自動移行
 *    - 下位互換性の一時的保持
 *    - 段階的な旧ファイル削除
 */

import { readFile, writeFile, stat, unlink, rename, access } from 'fs/promises';
import { constants } from 'fs';
import { hostname } from 'os';
import { DEFAULT_VOICE, CONNECTION_SETTINGS } from '../say/constants.js';

// 統一ファイル構造
export interface UnifiedOperatorState {
    operators: Record<string, {
        session_id: string;
        process_id: string;
        reserved_at: string;
    }>;
    last_updated: string;
}

export class FileOperationManager {
    // ファイルロック設定
    private readonly maxLockRetries = 10;
    private readonly lockRetryDelay = 50; // ms
    private readonly lockTimeout = 1000; // ms
    
    /**
     * 実装段階
     * Phase 1: ファイルロック機構の追加 (withFileLock, writeJsonFileWithLock)
     * Phase 2: 統一ファイル管理機能 (UnifiedOperatorState 操作)
     * Phase 3: 既存システムのリファクタリング (OperatorStateManager更新)
     * Phase 4: 移行処理とクリーンアップ機能
     */
    /**
     * JSONファイルを安全に読み込み
     */
    async readJsonFile<T>(filePath: string, defaultValue: T = {} as T): Promise<T> {
        try {
            await access(filePath, constants.F_OK);
            const content = await readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (error) {
            console.error(`ファイル読み込みエラー: ${filePath}, ${(error as Error).message}`);
            return defaultValue;
        }
    }

    /**
     * JSONファイルを安全に書き込み（アトミック操作）
     */
    async writeJsonFile(filePath: string, data: unknown): Promise<void> {
        const tempFile = `${filePath}.tmp`;
        await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
        
        // ファイルが存在する場合のみ削除を試行
        try {
            await access(filePath, constants.F_OK);
            await unlink(filePath);
        } catch {
            // ファイルが存在しない場合は何もしない
        }
        
        await rename(tempFile, filePath);
    }


    /**
     * 音声設定を更新（新しい構造に対応）
     */
    async updateVoiceSetting(
        coeiroinkConfigFile: string, 
        voiceId: string | null, 
        styleId: number = 0
    ): Promise<void> {
        try {
            // デフォルト設定を生成
            const defaultConfig = {
                connection: {
                    host: CONNECTION_SETTINGS.DEFAULT_HOST,
                    port: CONNECTION_SETTINGS.DEFAULT_PORT
                },
                voice: {
                    rate: 200,
                    default_voice_id: DEFAULT_VOICE.ID  // つくよみちゃん「れいせい」（COEIROINKデフォルト）
                },
                audio: {
                    latencyMode: 'balanced',
                    splitMode: 'punctuation',
                    bufferSize: 1024
                }
            };
            
            const config = await this.readJsonFile(coeiroinkConfigFile, defaultConfig) as Record<string, unknown>;
            
            // 新しい構造で設定を更新
            if (!config.voice) {
                config.voice = {};
            }
            const voiceConfig = config.voice as Record<string, unknown>;
            
            if (voiceId) {
                voiceConfig.default_voice_id = voiceId;
            }
            if (styleId !== undefined) {
                voiceConfig.default_style_id = styleId;
            }
            
            // 古い設定値が残っている場合は削除
            delete config.voice_id;
            delete config.style_id;
            
            await this.writeJsonFile(coeiroinkConfigFile, config);
        } catch (error) {
            console.error(`音声設定更新エラー: ${(error as Error).message}`);
        }
    }

    /**
     * ファイルの存在確認
     */
    async fileExists(filePath: string): Promise<boolean> {
        try {
            await access(filePath, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * ファイルを削除（存在しない場合はエラーを無視）
     */
    async deleteFile(filePath: string): Promise<void> {
        try {
            await unlink(filePath);
        } catch {
            // ファイルが存在しない場合は無視
        }
    }

    // =============================================================================
    // Phase 1: ファイルロック機構
    // =============================================================================

    /**
     * ファイルロックを取得してコールバック実行
     */
    async withFileLock<T>(filePath: string, callback: () => Promise<T>): Promise<T> {
        const lockFile = `${filePath}.lock`;
        
        for (let i = 0; i < this.maxLockRetries; i++) {
            try {
                // ロックファイル作成（排他的）
                await writeFile(lockFile, process.pid.toString(), { flag: 'wx' });
                
                try {
                    // コールバック実行
                    const result = await callback();
                    return result;
                } finally {
                    // ロック解除
                    await this.deleteFile(lockFile);
                }
            } catch (error: any) {
                if (error.code === 'EEXIST') {
                    // ロック競合 - リトライ
                    await new Promise(resolve => setTimeout(resolve, this.lockRetryDelay));
                    continue;
                }
                throw error;
            }
        }
        throw new Error(`Failed to acquire file lock after ${this.maxLockRetries} retries: ${filePath}`);
    }

    /**
     * ファイルロック付きJSONファイル書き込み
     */
    async writeJsonFileWithLock(filePath: string, data: unknown): Promise<void> {
        await this.withFileLock(filePath, async () => {
            await this.writeJsonFile(filePath, data);
        });
    }

    // =============================================================================
    // Phase 2: 統一ファイル管理機能
    // =============================================================================

    /**
     * 統一オペレータ状態ファイルのパスを生成
     */
    getUnifiedOperatorFilePath(): string {
        const hostnameClean = hostname().replace(/[^a-zA-Z0-9]/g, '_');
        return `/tmp/coeiroink-operators-${hostnameClean}.json`;
    }

    /**
     * 統一オペレータ状態ファイルの初期化
     */
    async initUnifiedOperatorState(): Promise<void> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        try {
            await stat(filePath);
        } catch {
            const initialData: UnifiedOperatorState = {
                operators: {},
                last_updated: new Date().toISOString()
            };
            await this.writeJsonFileWithLock(filePath, initialData);
        }
    }

    /**
     * 無効セッションのクリーンアップ
     */
    async cleanupStaleOperators(currentSessionId: string): Promise<void> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        await this.withFileLock(filePath, async () => {
            const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });

            let hasChanges = false;
            
            // 無効なセッションを削除
            for (const [operatorId, info] of Object.entries(state.operators)) {
                // 同じセッションIDの場合はスキップ
                if (info.session_id === currentSessionId) {
                    continue;
                }
                
                // プロセスが存在するかチェック
                try {
                    process.kill(parseInt(info.process_id), 0);
                    // プロセスが存在する場合は保持
                } catch {
                    // プロセスが存在しない場合は削除
                    delete state.operators[operatorId];
                    hasChanges = true;
                }
            }
            
            if (hasChanges) {
                state.last_updated = new Date().toISOString();
                await this.writeJsonFile(filePath, state);
            }
        });
    }

    /**
     * オペレータの予約（統一ファイル版）
     */
    async reserveOperatorUnified(operatorId: string, sessionId: string): Promise<boolean> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        return await this.withFileLock(filePath, async () => {
            const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });
            
            // オペレータが既に予約されているかチェック
            if (state.operators[operatorId]) {
                // 同じセッションの場合は成功
                if (state.operators[operatorId].session_id === sessionId) {
                    return true;
                }
                // 異なるセッションの場合は失敗
                return false;
            }
            
            // オペレータを予約
            state.operators[operatorId] = {
                session_id: sessionId,
                process_id: process.pid.toString(),
                reserved_at: new Date().toISOString()
            };
            state.last_updated = new Date().toISOString();
            
            await this.writeJsonFile(filePath, state);
            return true;
        });
    }

    /**
     * オペレータの解放（統一ファイル版）
     */
    async releaseOperatorUnified(operatorId: string, sessionId: string): Promise<boolean> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        return await this.withFileLock(filePath, async () => {
            const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });
            
            // オペレータが予約されているかチェック
            if (!state.operators[operatorId]) {
                return true; // 既に解放済み
            }
            
            // セッションIDが一致するかチェック
            if (state.operators[operatorId].session_id !== sessionId) {
                return false; // 他のセッションが使用中
            }
            
            // オペレータを解放
            delete state.operators[operatorId];
            state.last_updated = new Date().toISOString();
            
            await this.writeJsonFile(filePath, state);
            return true;
        });
    }

    /**
     * 利用可能なオペレータを取得（統一ファイル版）
     */
    async getAvailableOperatorsUnified(allOperators: string[]): Promise<string[]> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
            operators: {},
            last_updated: new Date().toISOString()
        });
        
        const reservedOperators = Object.keys(state.operators);
        return allOperators.filter(op => !reservedOperators.includes(op));
    }

    /**
     * 現在のセッションのオペレータを取得（統一ファイル版）
     */
    async getCurrentOperatorUnified(sessionId: string): Promise<string | null> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
            operators: {},
            last_updated: new Date().toISOString()
        });
        
        for (const [operatorId, info] of Object.entries(state.operators)) {
            if (info.session_id === sessionId) {
                return operatorId;
            }
        }
        
        return null;
    }

    // =============================================================================
    // Phase 4: 移行処理とクリーンアップ
    // =============================================================================

    /**
     * 既存ファイルから統一ファイルへの移行
     */
    async migrateFromLegacyFiles(activeOperatorsFile: string, sessionId: string): Promise<void> {
        try {
            // 既存のactive-operators.jsonを読み込み
            const legacyData = await this.readJsonFile<{
                active: Record<string, string>;
                last_updated: string;
            }>(activeOperatorsFile, {
                active: {},
                last_updated: new Date().toISOString()
            });

            if (Object.keys(legacyData.active).length === 0) {
                return; // 移行データなし
            }

            const unifiedFilePath = this.getUnifiedOperatorFilePath();
            
            await this.withFileLock(unifiedFilePath, async () => {
                const unifiedState = await this.readJsonFile<UnifiedOperatorState>(unifiedFilePath, {
                    operators: {},
                    last_updated: new Date().toISOString()
                });

                // レガシーデータを統一形式に変換
                for (const [operatorId, legacySessionId] of Object.entries(legacyData.active)) {
                    // 現在のセッションのもののみ移行
                    if (legacySessionId === sessionId) {
                        unifiedState.operators[operatorId] = {
                            session_id: sessionId,
                            process_id: process.pid.toString(),
                            reserved_at: legacyData.last_updated || new Date().toISOString()
                        };
                    }
                }

                unifiedState.last_updated = new Date().toISOString();
                await this.writeJsonFile(unifiedFilePath, unifiedState);
            });

            console.log(`Migrated ${Object.keys(legacyData.active).length} operators from legacy files`);
        } catch (error) {
            console.warn('Migration from legacy files failed:', (error as Error).message);
        }
    }

    /**
     * レガシーファイルのクリーンアップ（安全な削除）
     */
    async cleanupLegacyFiles(activeOperatorsFile: string, sessionOperatorFile: string): Promise<void> {
        try {
            // セッションファイルの削除（安全）
            await this.deleteFile(sessionOperatorFile);

            // active-operators.jsonの処理（慎重に）
            const legacyData = await this.readJsonFile<{
                active: Record<string, string>;
                last_updated: string;
            }>(activeOperatorsFile, {
                active: {},
                last_updated: new Date().toISOString()
            });

            // 他のセッションが使用中でなければ削除
            if (Object.keys(legacyData.active).length === 0) {
                await this.deleteFile(activeOperatorsFile);
                console.log('Cleaned up legacy active-operators.json (was empty)');
            } else {
                console.log('Legacy active-operators.json retained (contains other sessions)');
            }
        } catch (error) {
            console.warn('Legacy file cleanup failed:', (error as Error).message);
        }
    }

    /**
     * システム全体のヘルスチェック
     */
    async performSystemHealthCheck(): Promise<{
        unifiedFileExists: boolean;
        unifiedFileSize: number;
        operatorCount: number;
        lastUpdated: string;
    }> {
        const unifiedFilePath = this.getUnifiedOperatorFilePath();
        
        try {
            const stats = await stat(unifiedFilePath);
            const state = await this.readJsonFile<UnifiedOperatorState>(unifiedFilePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });

            return {
                unifiedFileExists: true,
                unifiedFileSize: stats.size,
                operatorCount: Object.keys(state.operators).length,
                lastUpdated: state.last_updated
            };
        } catch {
            return {
                unifiedFileExists: false,
                unifiedFileSize: 0,
                operatorCount: 0,
                lastUpdated: 'never'
            };
        }
    }
}

export default FileOperationManager;