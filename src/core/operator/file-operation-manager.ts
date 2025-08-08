/**
 * src/operator/file-operation-manager.ts: ファイル操作管理クラス
 * JSONファイルの読み書き、アトミック操作を担当
 */

import { readFile, writeFile, stat, unlink, rename, access } from 'fs/promises';
import { constants } from 'fs';

export interface ActiveOperators {
    active: Record<string, string>;
    last_updated: string;
}

export interface SessionData {
    operator_id: string;
    session_id: string;
    reserved_at: string;
}

export class FileOperationManager {
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
     * 利用中オペレータファイルの初期化
     */
    async initActiveOperators(activeOperatorsFile: string): Promise<void> {
        try {
            await stat(activeOperatorsFile);
        } catch {
            const initialData: ActiveOperators = {
                active: {},
                last_updated: new Date().toISOString()
            };
            await this.writeJsonFile(activeOperatorsFile, initialData);
        }
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
            const config = await this.readJsonFile(coeiroinkConfigFile, {}) as Record<string, unknown>;
            
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
}

export default FileOperationManager;