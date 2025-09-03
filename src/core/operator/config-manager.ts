/**
 * src/operator/config-manager.ts: 設定管理システム
 * 動的音声フォント取得、設定マージ、キャッシュ管理を担当
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { BUILTIN_CHARACTER_CONFIGS, BaseCharacterConfig, CharacterConfig } from './character-defaults.js';
import { CONNECTION_SETTINGS } from '../say/constants.js';
import { getSpeakerProvider } from '../environment/speaker-provider.js';


// 統一設定ファイルの型定義
interface UnifiedConfig {
    connection?: {
        host?: string;
        port?: string;
    };
    audio?: {
        latencyMode?: string;
        splitMode?: string;
        bufferSize?: number;
        parallelGeneration?: {
            maxConcurrency?: number;
            pauseUntilFirstComplete?: boolean;
        };
        [key: string]: any;
    };
    operator?: {
        rate?: number;              // 話速（WPM）
        timeout?: number;           // タイムアウト（ミリ秒）
        assignmentStrategy?: 'random';
    };
    characters?: Record<string, Partial<BaseCharacterConfig> & { speakerId?: string; disabled?: boolean; }>;
}

interface MergedConfig {
    characters: Record<string, CharacterConfig>;
    operatorTimeout: number;
    characterSettings: {
        assignmentStrategy: 'random';
    };
}

export class ConfigManager {
    private configDir: string;
    private configFile: string;
    private mergedConfig: MergedConfig | null = null;
    private speakerProvider = getSpeakerProvider();

    constructor(configDir: string) {
        this.configDir = configDir;
        this.configFile = join(configDir, 'config.json');
    }

    /**
     * JSONファイルを安全に読み込み
     */
    async readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
        try {
            await access(filePath, constants.F_OK);
            const content = await readFile(filePath, 'utf8');
            return JSON.parse(content) as T;
        } catch {
            return defaultValue;
        }
    }

    /**
     * JSONファイルを安全に書き込み
     */
    async writeJsonFile(filePath: string, data: unknown): Promise<void> {
        const tempFile = `${filePath}.tmp`;
        await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
        
        try {
            const fs = await import('fs');
            await fs.promises.rename(tempFile, filePath);
        } catch (error) {
            console.error(`設定ファイル書き込みエラー: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * 統一設定ファイルを読み込み
     */
    private async loadConfig(): Promise<UnifiedConfig> {
        return await this.readJsonFile<UnifiedConfig>(this.configFile, {});
    }

    /**
     * 接続設定を更新して音声プロバイダを再設定
     */
    private async updateVoiceProviderConnection(): Promise<void> {
        try {
            const config = await this.loadConfig();
            
            const host = config.connection?.host || CONNECTION_SETTINGS.DEFAULT_HOST;
            const port = config.connection?.port || CONNECTION_SETTINGS.DEFAULT_PORT;
            
            this.speakerProvider.updateConnection({ host, port });
        } catch (error) {
            console.error(`接続設定更新エラー: ${(error as Error).message}`);
        }
    }

    /**
     * 動的設定を構築してマージ
     */
    async buildDynamicConfig(): Promise<void> {
        await this.updateVoiceProviderConnection();
        
        const config = await this.loadConfig();
        
        try {
            const speakers = await this.speakerProvider.getSpeakers();
            const dynamicCharacters: Record<string, CharacterConfig> = {};
            
            for (const [characterId, builtinConfig] of Object.entries(BUILTIN_CHARACTER_CONFIGS)) {
                // speakerIdでCOEIROINKのSpeakerとマッチング
                const speaker = speakers.find(s => s.speakerUuid === builtinConfig.speakerId);
                if (!speaker) continue; // 利用可能なspeakerがない場合はスキップ
                
                // ユーザー設定はcharacterIdで管理
                const userCharacterConfig = config.characters?.[characterId] || {};
                
                if (userCharacterConfig.disabled) continue;
                
                // 利用可能なスタイル一覧を追加
                const availableStyles = speaker.styles?.map(s => s.styleName) || [];
                
                dynamicCharacters[characterId] = {
                    ...builtinConfig,
                    availableStyles,
                    ...userCharacterConfig
                };
            }
            
            this.mergedConfig = {
                characters: dynamicCharacters,
                operatorTimeout: config.operator?.timeout || 14400000,
                characterSettings: { 
                    assignmentStrategy: config.operator?.assignmentStrategy || 'random'
                }
            };
            
        } catch (error) {
            console.error(`動的設定構築エラー:`, error);
            
            // サーバーから取得できなかった場合は空の設定を使用
            const staticCharacters: Record<string, CharacterConfig> = {};
            
            this.mergedConfig = {
                characters: staticCharacters,
                operatorTimeout: config.operator?.timeout || 14400000,
                characterSettings: { 
                    assignmentStrategy: config.operator?.assignmentStrategy || 'random'
                }
            };
        }
    }

    /**
     * マージ済み設定を取得
     */
    getMergedConfig(): MergedConfig | null {
        return this.mergedConfig;
    }

    /**
     * キャラクター設定を取得
     */
    async getCharacterConfig(characterId: string): Promise<CharacterConfig | null> {
        if (!this.mergedConfig) {
            await this.buildDynamicConfig();
        }
        return this.mergedConfig?.characters[characterId] || null;
    }

    /**
     * 利用可能なキャラクターIDを取得
     */
    async getAvailableCharacterIds(): Promise<string[]> {
        if (!this.mergedConfig) {
            await this.buildDynamicConfig();
        }
        return Object.keys(this.mergedConfig?.characters || {});
    }

    /**
     * オペレータのタイムアウト時間を取得
     */
    async getOperatorTimeout(): Promise<number> {
        if (!this.mergedConfig) {
            await this.buildDynamicConfig();
        }
        return this.mergedConfig?.operatorTimeout || 14400000;
    }

    /**
     * 設定ディレクトリの存在確認と作成
     */
    async ensureConfigDir(): Promise<void> {
        try {
            await mkdir(this.configDir, { recursive: true });
        } catch (error) {
            console.error(`設定ディレクトリ作成エラー: ${(error as Error).message}`);
        }
    }

    /**
     * 話速（rate）を取得
     */
    async getRate(): Promise<number> {
        const config = await this.loadConfig();
        return config.operator?.rate || 200;
    }

    /**
     * 音声設定を取得
     */
    async getAudioConfig(): Promise<any> {
        const config = await this.loadConfig();
        return config.audio || {};
    }

    /**
     * 接続設定を取得
     */
    async getConnectionConfig(): Promise<{ host: string; port: string }> {
        const config = await this.loadConfig();
        return {
            host: config.connection?.host || CONNECTION_SETTINGS.DEFAULT_HOST,
            port: config.connection?.port || CONNECTION_SETTINGS.DEFAULT_PORT
        };
    }
}

export default ConfigManager;