/**
 * src/operator/file-operation-manager.ts: ファイル操作管理クラス
 * JSONファイルの読み書き、アトミック操作を担当
 * 
 * Issue #43 対応: 統一ファイル管理システム
 * 
 * 【実装方針】
 * 1. 統一ファイル管理
 *    - /tmp/coeiroink-operators-{hostname}.json に一元化
 *    - セッションIDベースの予約管理
 * 
 * 2. 複数プロセス間の排他制御
 *    - ファイルロック機構でread-modify-write操作の競合を防止
 *    - リトライ機構でデッドロック回避
 *    - アトミック操作で一貫性保証
 * 
 * 3. プロセス管理
 *    - プロセス起動時の無効セッション自動クリーンアップ
 *    - session_id + process_id による二重チェック
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
    private readonly maxLockRetries = 50;
    private readonly lockRetryDelay = 20; // ms
    private readonly lockTimeout = 2000; // ms
    
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
    // ファイルロック機構
    // =============================================================================

    /**
     * ファイルロックを取得してコールバック実行
     */
    async withFileLock<T>(filePath: string, callback: () => Promise<T>): Promise<T> {
        const lockFile = `${filePath}.lock`;
        
        for (let i = 0; i < this.maxLockRetries; i++) {
            try {
                // 古いロックファイルのクリーンアップ（タイムアウト処理）
                try {
                    const stats = await stat(lockFile);
                    const lockAge = Date.now() - stats.mtime.getTime();
                    if (lockAge > this.lockTimeout) {
                        console.warn(`Removing stale lock file: ${lockFile} (age: ${lockAge}ms)`);
                        await this.deleteFile(lockFile);
                    }
                } catch {
                    // ロックファイルが存在しない場合は正常
                }
                
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
                    // ロック競合 - 指数バックオフでリトライ
                    const backoffDelay = this.lockRetryDelay * Math.min(Math.pow(1.5, i), 10);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay + Math.random() * 10));
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
    // 統一ファイル管理機能
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
        
        // ファイルロック付きで二重初期化を防止
        await this.withFileLock(filePath, async () => {
            // ロック取得後に再度存在確認（競合状態での二重作成防止）
            if (!await this.fileExists(filePath)) {
                const initialData: UnifiedOperatorState = {
                    operators: {},
                    last_updated: new Date().toISOString()
                };
                try {
                    await this.writeJsonFile(filePath, initialData);
                } catch (error) {
                    console.warn(`Failed to initialize unified operator state: ${(error as Error).message}`);
                }
            }
        });
    }

    /**
     * 古い予約のクリーンアップ（時間ベース）
     * マルチプロセス環境（CLI、MCP）に対応した設計
     */
    async cleanupStaleOperators(currentSessionId: string): Promise<void> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        // ファイルが存在しない場合はスキップ
        if (!await this.fileExists(filePath)) {
            return;
        }
        
        await this.withFileLock(filePath, async () => {
            const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });

            // オペレータが存在しない場合はスキップ
            if (Object.keys(state.operators).length === 0) {
                return;
            }

            let hasChanges = false;
            const now = Date.now();
            // 2時間以上前の予約のみクリーンアップ（CLIやMCPの通常使用には十分）
            const staleThreshold = 2 * 60 * 60 * 1000; // 2時間
            
            // 古い予約を削除（プロセス存在チェックは行わない）
            for (const [operatorId, info] of Object.entries(state.operators)) {
                // 同じセッションIDの場合はスキップ（自分の予約は保持）
                if (info.session_id === currentSessionId) {
                    continue;
                }
                
                // 予約時刻チェック
                try {
                    const reservedAt = new Date(info.reserved_at).getTime();
                    const age = now - reservedAt;
                    
                    if (age > staleThreshold) {
                        console.log(`古い予約を削除: ${operatorId} (${Math.round(age / 1000 / 60 / 60)}時間前)`);
                        delete state.operators[operatorId];
                        hasChanges = true;
                    }
                } catch {
                    // 無効な日付の場合は削除
                    console.log(`無効な予約時刻のため削除: ${operatorId}`);
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
     * オペレータの予約
     * Issue #56: 二重予約チェック強化
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
                const existingReservation = state.operators[operatorId];
                
                // 完全に同じセッション（session_id + process_id）の場合は成功
                if (existingReservation.session_id === sessionId && 
                    existingReservation.process_id === process.pid.toString()) {
                    return true;
                }
                
                // session_idが同じでもprocess_idが異なる場合は、古いプロセスが生きているかチェック
                if (existingReservation.session_id === sessionId) {
                    try {
                        const existingPid = parseInt(existingReservation.process_id);
                        process.kill(existingPid, 0); // プロセス存在チェック
                        
                        // 既存プロセスが生きている場合は拒否
                        console.warn(`オペレータ ${operatorId} は同一セッションの別プロセス (PID: ${existingPid}) で使用中です`);
                        return false;
                    } catch {
                        // 既存プロセスが死んでいる場合は上書き
                        console.log(`オペレータ ${operatorId} の古いプロセス (PID: ${existingReservation.process_id}) が終了したため、新プロセスで予約します`);
                    }
                } else {
                    // 完全に異なるセッションの場合は拒否
                    return false;
                }
            }
            
            // オペレータを予約（新規または上書き）
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
     * オペレータの解放
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
     * 利用可能なオペレータを取得
     * Issue #56: セッションID考慮の修正 - 同じセッションの予約は利用可能として扱う
     */
    async getAvailableOperatorsUnified(allOperators: string[], currentSessionId?: string): Promise<string[]> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
            operators: {},
            last_updated: new Date().toISOString()
        });
        
        // セッションIDが指定されている場合は、そのセッション以外の予約のみを除外
        if (currentSessionId) {
            const reservedByOtherSessions = Object.keys(state.operators).filter(operatorId => {
                const reservation = state.operators[operatorId];
                return reservation.session_id !== currentSessionId;
            });
            return allOperators.filter(op => !reservedByOtherSessions.includes(op));
        } else {
            // セッションIDが指定されていない場合は従来の動作（全予約を除外）
            const reservedOperators = Object.keys(state.operators);
            return allOperators.filter(op => !reservedOperators.includes(op));
        }
    }

    /**
     * 現在のセッションのオペレータを取得
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

    /**
     * オペレータ予約のタイムアウトを延長（reserved_atを現在時刻に更新）
     * Issue #58: sayコマンド実行時の動的タイムアウト延長
     */
    async refreshOperatorReservation(operatorId: string, sessionId: string): Promise<boolean> {
        const filePath = this.getUnifiedOperatorFilePath();
        
        return await this.withFileLock(filePath, async () => {
            const state = await this.readJsonFile<UnifiedOperatorState>(filePath, {
                operators: {},
                last_updated: new Date().toISOString()
            });
            
            // オペレータが予約されているかチェック
            if (!state.operators[operatorId]) {
                return false; // 予約されていない
            }
            
            // セッションIDが一致するかチェック
            const reservation = state.operators[operatorId];
            if (reservation.session_id !== sessionId) {
                return false; // 他のセッションが使用中
            }
            
            // reserved_atを現在時刻に更新
            state.operators[operatorId].reserved_at = new Date().toISOString();
            state.last_updated = new Date().toISOString();
            
            await this.writeJsonFile(filePath, state);
            return true;
        });
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