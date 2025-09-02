/**
 * src/operator/config-manager.ts: 設定管理システム
 * 動的音声フォント取得、設定マージ、キャッシュ管理を担当
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { BUILTIN_CHARACTER_CONFIGS, SPEAKER_NAME_TO_ID_MAP } from './character-defaults.js';
import { DEFAULT_VOICE, CONNECTION_SETTINGS } from '../say/constants.js';
import { getSpeakerProvider, type SpeakerData } from '../environment/speaker-provider.js';

export interface CharacterConfig {
    name: string;
    personality: string;
    speakingStyle: string;
    greeting: string;
    farewell: string;
    defaultStyle: string;
    speakerId: string | null;  // COEIROINKのspeakerUuid
    disabled?: boolean;
}

interface CharacterSettings {
    assignmentStrategy?: 'random';  // オペレータ割り当て戦略（現在はrandomのみ実装）
}

interface UserConfig {
    characters?: Record<string, Partial<CharacterConfig>>;
    operatorTimeout?: number; // ミリ秒単位のタイムアウト期間
    characterSettings?: CharacterSettings;  // グローバルなキャラクター動作設定
}

interface MergedConfig {
    characters: Record<string, CharacterConfig>;
    operatorTimeout: number; // ミリ秒単位のタイムアウト期間
    characterSettings: CharacterSettings;  // グローバルなキャラクター動作設定
}

export class ConfigManager {
    private configDir: string;
    private operatorConfigFile: string;
    private coeiroinkConfigFile: string;
    private mergedConfig: MergedConfig | null = null; // マージ済み設定キャッシュ
    private speakerProvider = getSpeakerProvider(); // Speakerプロバイダ

    constructor(configDir: string) {
        this.configDir = configDir;
        this.operatorConfigFile = join(configDir, 'operator-config.json');
        this.coeiroinkConfigFile = join(configDir, 'coeiroink-config.json');
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
     * 接続設定を更新して音声プロバイダを再設定
     */
    private async updateVoiceProviderConnection(): Promise<void> {
        try {
            // デフォルト接続設定を生成
            const defaultCoeiroinkConfig = {
                connection: {
                    host: CONNECTION_SETTINGS.DEFAULT_HOST,
                    port: CONNECTION_SETTINGS.DEFAULT_PORT
                }
            };
            
            const coeiroinkConfig = await this.readJsonFile(this.coeiroinkConfigFile, defaultCoeiroinkConfig) as Record<string, unknown>;
            
            // 接続設定の取得（階層構造に対応）
            const connectionConfig = coeiroinkConfig.connection as Record<string, unknown> || {};
            const host = (connectionConfig.host as string) || (coeiroinkConfig.host as string) || CONNECTION_SETTINGS.DEFAULT_HOST;
            const port = (connectionConfig.port as string) || (coeiroinkConfig.port as string) || CONNECTION_SETTINGS.DEFAULT_PORT;
            
            // Speakerプロバイダの接続設定を更新
            this.speakerProvider.updateConnection({ host, port });
        } catch (error) {
            console.warn(`接続設定更新エラー: ${(error as Error).message}`);
        }
    }

    /**
     * 音声名からIDを生成（英語名への変換）
     */
    speakerNameToId(speakerName: string): string {
        return SPEAKER_NAME_TO_ID_MAP[speakerName as keyof typeof SPEAKER_NAME_TO_ID_MAP] || 
               speakerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    /**
     * 再帰的なオブジェクトマージ（プロトタイプ汚染対策済み）
     */
    deepMerge(target: any, source: any): any {
        const result = { ...target };
        
        // プロトタイプ汚染防止のための危険なキーリスト
        const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
        
        for (const key in source) {
            // 危険なキーをスキップ
            if (dangerousKeys.includes(key)) {
                continue;
            }
            
            // hasOwnPropertyチェックで継承されたプロパティを除外
            if (!Object.prototype.hasOwnProperty.call(source, key)) {
                continue;
            }
            
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    /**
     * 動的設定の構築（内蔵設定 + 動的音声情報 + ユーザー設定）
     */
    async buildDynamicConfig(forceRefresh: boolean = false): Promise<MergedConfig> {
        // キャッシュがあり、強制リフレッシュでない場合はキャッシュを返す
        if (this.mergedConfig && !forceRefresh) {
            return this.mergedConfig;
        }

        // 接続設定を更新
        await this.updateVoiceProviderConnection();

        // 強制リフレッシュの場合（現在はキャッシュなしで常に最新データ）

        const userConfig = await this.readJsonFile<UserConfig>(this.operatorConfigFile, { characters: {}, characterSettings: {} });
        const dynamicCharacters: Record<string, CharacterConfig> = {};
        
        // 利用可能なSpeakerから動的設定を生成
        const availableSpeakers = await this.speakerProvider.getVoicesForConfig();
        
        if (availableSpeakers.length > 0) {
            for (const speaker of availableSpeakers) {
                const builtinConfig = BUILTIN_CHARACTER_CONFIGS[speaker.id as keyof typeof BUILTIN_CHARACTER_CONFIGS] || {
                    name: speaker.name,
                    personality: "丁寧で親しみやすい",
                    speakingStyle: "標準的な口調",
                    greeting: `こんにちは。${speaker.name}です。`,
                    farewell: "お疲れさまでした。",
                    defaultStyle: "normal"
                };
                
                // 基本設定にSpeaker情報を追加
                const characterConfig: CharacterConfig = {
                    ...builtinConfig,
                    name: speaker.name, // Speakerプロバイダからの正確な名前を使用
                    speakerId: speaker.speakerId
                };
                
                // デフォルトスタイルがスタイル一覧に存在するか確認
                // 存在しない場合は最初のスタイルをデフォルトに
                if (speaker.styles.length > 0 && 
                    !speaker.styles.find(s => s.name === builtinConfig.defaultStyle)) {
                    characterConfig.defaultStyle = speaker.styles[0].name;
                }
                
                dynamicCharacters[speaker.id] = characterConfig;
            }
        } else {
            // Speakerが取得できない場合、内蔵設定を使用
            for (const [charId, builtinConfig] of Object.entries(BUILTIN_CHARACTER_CONFIGS)) {
                dynamicCharacters[charId] = {
                    ...builtinConfig,
                    speakerId: null // Speaker情報がない
                };
            }
        }
        
        // ユーザー設定でオーバーライド（disabledフラグ対応）
        const mergedCharacters: Record<string, CharacterConfig> = {};
        for (const [charId, charConfig] of Object.entries(dynamicCharacters)) {
            const userCharConfig = userConfig.characters?.[charId] || {};
            
            // disabledフラグがtrueの場合はスキップ
            if (userCharConfig.disabled === true) {
                continue;
            }
            
            mergedCharacters[charId] = this.deepMerge(charConfig, userCharConfig);
        }
        
        // ユーザー設定に存在するが動的設定にないキャラクターもチェック（手動追加対応）
        if (userConfig.characters) {
            for (const [charId, userCharConfig] of Object.entries(userConfig.characters)) {
                if (!dynamicCharacters[charId] && !userCharConfig.disabled) {
                    // 内蔵設定があるか確認
                    const builtinConfig = BUILTIN_CHARACTER_CONFIGS[charId as keyof typeof BUILTIN_CHARACTER_CONFIGS];
                    
                    if (builtinConfig) {
                        // 内蔵設定がある場合はそれをベースに使用
                        mergedCharacters[charId] = this.deepMerge({
                            ...builtinConfig,
                            speakerId: null
                        }, userCharConfig);
                    } else if (userCharConfig.speakerId) {
                        // 新規カスタムキャラクター（speakerIdが必須）
                        const defaultConfig: CharacterConfig = {
                            name: userCharConfig.name || charId,
                            personality: userCharConfig.personality || "カスタムキャラクター",
                            speakingStyle: userCharConfig.speakingStyle || "標準的な口調",
                            greeting: userCharConfig.greeting || `こんにちは。${userCharConfig.name || charId}です。`,
                            farewell: userCharConfig.farewell || "お疲れさまでした。",
                            defaultStyle: userCharConfig.defaultStyle || "normal",
                            speakerId: userCharConfig.speakerId,
                            disabled: false
                        };
                        mergedCharacters[charId] = this.deepMerge(defaultConfig, userCharConfig);
                    } else {
                        // speakerIdがない新規キャラクターはエラーログを出して無視
                        console.error(`[ConfigManager] キャラクター '${charId}' の作成に失敗: speakerIdが必須です`);
                    }
                }
            }
        }
        
        this.mergedConfig = {
            characters: mergedCharacters,
            operatorTimeout: userConfig.operatorTimeout || 4 * 60 * 60 * 1000, // デフォルト4時間
            characterSettings: {
                assignmentStrategy: userConfig.characterSettings?.assignmentStrategy || 'random',
            }
        };
        
        return this.mergedConfig;
    }

    /**
     * 設定をリフレッシュ（キャッシュクリア）
     */
    refreshConfig(): void {
        // キャッシュ削除後は不要
        this.mergedConfig = null;
    }

    /**
     * 特定キャラクターの設定を取得
     */
    async getCharacterConfig(characterId: string): Promise<CharacterConfig> {
        const config = await this.buildDynamicConfig();
        const character = config.characters?.[characterId];
        
        if (!character) {
            throw new Error(`キャラクター '${characterId}' が見つかりません`);
        }
        
        return character;
    }

    /**
     * 利用可能なキャラクターIDリストを取得
     */
    async getAvailableCharacterIds(): Promise<string[]> {
        const config = await this.buildDynamicConfig();
        return Object.keys(config.characters || {});
    }

    /**
     * 挨拶パターンリストを取得
     */
    async getGreetingPatterns(): Promise<string[]> {
        const config = await this.buildDynamicConfig();
        return Object.values(config.characters || {})
            .map(char => char.greeting)
            .filter(greeting => greeting && greeting.trim());
    }

    /**
     * オペレータタイムアウト期間を取得（ミリ秒）
     */
    async getOperatorTimeout(): Promise<number> {
        const config = await this.buildDynamicConfig();
        return config.operatorTimeout;
    }

}

export default ConfigManager;