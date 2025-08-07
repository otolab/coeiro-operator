/**
 * src/operator/config-manager.ts: 設定管理システム
 * 動的音声フォント取得、設定マージ、キャッシュ管理を担当
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { BUILTIN_CHARACTER_CONFIGS, SPEAKER_NAME_TO_ID_MAP } from './character-defaults.js';

interface VoiceStyle {
    id: number;
    name: string;
    style_id: number;
}

interface Voice {
    id: string;
    name: string;
    voice_id: string;
    styles: VoiceStyle[];
}

export interface CharacterStyle {
    name: string;
    style_id: number;
    personality: string;
    speaking_style: string;
    disabled?: boolean;
}

export interface CharacterConfig {
    name: string;
    personality: string;
    speaking_style: string;
    greeting: string;
    farewell: string;
    default_style: string;
    style_selection: string;
    voice_id: string | null;
    available_styles: Record<string, CharacterStyle>;
    disabled?: boolean;
}

interface UserConfig {
    characters: Record<string, Partial<CharacterConfig>>;
}

interface MergedConfig {
    characters: Record<string, CharacterConfig>;
}

export class ConfigManager {
    private configDir: string;
    private operatorConfigFile: string;
    private coeiroinkConfigFile: string;
    private availableVoices: Voice[] | null = null; // キャッシュ
    private mergedConfig: MergedConfig | null = null; // マージ済み設定キャッシュ

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
    async writeJsonFile(filePath: string, data: any): Promise<void> {
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
     * COEIROINKサーバーから利用可能な音声フォントを取得
     */
    async fetchAvailableVoices(): Promise<void> {
        try {
            const coeiroinkConfig = await this.readJsonFile(this.coeiroinkConfigFile, {});
            const host = (coeiroinkConfig as any).host || 'localhost';
            const port = (coeiroinkConfig as any).port || '50032';
            
            // fetchを使用してHTTPリクエストを実行
            const response = await fetch(`http://${host}:${port}/v1/speakers`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const speakers = await response.json() as any[];
            
            this.availableVoices = speakers.map(speaker => ({
                id: this.speakerNameToId(speaker.speakerName),
                name: speaker.speakerName,
                voice_id: speaker.speakerUuid,
                styles: speaker.styles.map((style: any) => ({
                    id: style.styleId,
                    name: style.styleName,
                    style_id: style.styleId
                }))
            }));
            
        } catch (error) {
            console.warn(`音声フォント取得エラー: ${(error as Error).message}。内蔵設定のみを使用します。`);
            this.availableVoices = [];
        }
    }

    /**
     * 音声名からIDを生成（英語名への変換）
     */
    speakerNameToId(speakerName: string): string {
        return SPEAKER_NAME_TO_ID_MAP[speakerName] || 
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

        // 音声フォントを取得（キャッシュがない場合のみ）
        if (!this.availableVoices || forceRefresh) {
            await this.fetchAvailableVoices();
        }

        const userConfig = await this.readJsonFile<UserConfig>(this.operatorConfigFile, { characters: {} });
        const dynamicCharacters: Record<string, CharacterConfig> = {};
        
        // 利用可能な音声フォントから動的設定を生成
        if (this.availableVoices && this.availableVoices.length > 0) {
            for (const voice of this.availableVoices) {
                const builtinConfig = BUILTIN_CHARACTER_CONFIGS[voice.id] || {
                    name: voice.name,
                    personality: "丁寧で親しみやすい",
                    speaking_style: "標準的な口調",
                    greeting: `こんにちは。${voice.name}です。`,
                    farewell: "お疲れさまでした。",
                    default_style: "normal",
                    style_selection: "default"
                };
                
                // 基本設定に音声情報を追加
                const characterConfig: CharacterConfig = {
                    ...builtinConfig,
                    voice_id: voice.voice_id,
                    available_styles: {}
                };
                
                // スタイル情報を追加
                for (const style of voice.styles) {
                    const styleKey = style.name === 'れいせい' ? 'normal' : 
                                   style.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    
                    characterConfig.available_styles[styleKey] = {
                        name: style.name,
                        style_id: style.style_id,
                        personality: builtinConfig.personality,
                        speaking_style: builtinConfig.speaking_style
                    };
                }
                
                dynamicCharacters[voice.id] = characterConfig;
            }
        } else {
            // 音声フォントが取得できない場合、内蔵設定を使用
            for (const [charId, builtinConfig] of Object.entries(BUILTIN_CHARACTER_CONFIGS)) {
                dynamicCharacters[charId] = {
                    ...builtinConfig,
                    voice_id: null, // 音声情報がない
                    available_styles: {
                        normal: {
                            name: 'れいせい',
                            style_id: 0,
                            personality: builtinConfig.personality,
                            speaking_style: builtinConfig.speaking_style
                        }
                    }
                };
            }
        }
        
        // ユーザー設定でオーバーライド（disabledフラグ対応）
        const mergedCharacters: Record<string, CharacterConfig> = {};
        for (const [charId, charConfig] of Object.entries(dynamicCharacters)) {
            const userCharConfig = userConfig.characters[charId] || {};
            
            // disabledフラグがtrueの場合はスキップ
            if (userCharConfig.disabled) {
                continue;
            }
            
            mergedCharacters[charId] = this.deepMerge(charConfig, userCharConfig);
        }
        
        this.mergedConfig = {
            characters: mergedCharacters
        };
        
        return this.mergedConfig;
    }

    /**
     * 設定をリフレッシュ（キャッシュクリア）
     */
    refreshConfig(): void {
        this.availableVoices = null;
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
     * デバッグ用：現在の設定状況を出力
     */
    async debugConfig(): Promise<void> {
        console.log('=== ConfigManager Debug Info ===');
        console.log('Available Voices:', this.availableVoices?.length || 0);
        console.log('Merged Config Cache:', this.mergedConfig ? 'Cached' : 'Not Cached');
        
        const config = await this.buildDynamicConfig();
        console.log('Characters:', Object.keys(config.characters || {}));
        
        // ユーザー設定の内容
        const userConfig = await this.readJsonFile<UserConfig>(this.operatorConfigFile, { characters: {} });
        console.log('User Config:', JSON.stringify(userConfig, null, 2));
    }
}

export default ConfigManager;