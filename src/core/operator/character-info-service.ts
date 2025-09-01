/**
 * src/operator/character-info-service.ts: キャラクター情報管理サービス
 * キャラクター詳細情報、スタイル情報の取得を担当（読み込み専用）
 */

import { readFile, writeFile, access } from 'fs/promises';
import { constants } from 'fs';
import ConfigManager, { CharacterConfig, CharacterStyle } from './config-manager.js';
import { DEFAULT_VOICE, CONNECTION_SETTINGS } from '../say/constants.js';

// インターフェース定義
export interface Style {
    styleId: number;        // COEIROINK APIのスタイルID
    styleName: string;      // COEIROINK APIのスタイル名（"のーまる", "裏"など）
    personality: string;
    speaking_style: string;
    enabled: boolean;
    disabled?: boolean;
}

export interface Speaker {
    speakerId: string;      // COEIROINK APIのspeakerUuidに対応
    speakerName: string;    // COEIROINK APIのspeakerNameに対応
    available_styles: Record<string, Style>;  // styleNameをキーとしたスタイル情報
    style_selection: string;
    default_style: string;  // デフォルトのstyleName
    greeting?: string;
    farewell?: string;
    personality: string;
    speaking_style: string;
}


// CharacterConfigからSpeakerに変換するヘルパー関数
function convertCharacterConfigToSpeaker(config: CharacterConfig): Speaker {
    const availableStyles: Record<string, Style> = {};
    
    for (const [styleKey, style] of Object.entries(config.available_styles)) {
        availableStyles[styleKey] = {
            styleId: style.styleId,
            styleName: style.styleName,
            personality: style.personality,
            speaking_style: style.speaking_style,
            enabled: !style.disabled,
            disabled: style.disabled
        };
    }
    
    return {
        speakerId: config.voice_id || '',
        speakerName: config.name,
        available_styles: availableStyles,
        style_selection: config.style_selection,
        default_style: config.default_style,
        greeting: config.greeting,
        farewell: config.farewell,
        personality: config.personality,
        speaking_style: config.speaking_style
    };
}

export class CharacterInfoService {
    private configManager: ConfigManager | null = null;
    private coeiroinkConfigFile: string | null = null;

    constructor() {
        // キャラクター情報の読み込み専用サービス
    }

    /**
     * 初期化：ConfigManagerと設定ファイルパスを設定
     */
    initialize(configManager: ConfigManager, coeiroinkConfigFile: string): void {
        this.configManager = configManager;
        this.coeiroinkConfigFile = coeiroinkConfigFile;
    }

    /**
     * キャラクター情報を取得
     */
    async getCharacterInfo(characterId: string): Promise<Speaker> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }
        const config = await this.configManager.getCharacterConfig(characterId);
        return convertCharacterConfigToSpeaker(config);
    }

    /**
     * スタイルを選択
     * @param character キャラクター情報
     * @param specifiedStyle 指定されたスタイル名
     */
    selectStyle(speaker: Speaker, specifiedStyle: string | null = null): Style {
        const availableStyleEntries = Object.entries(speaker.available_styles || {})
            .filter(([_, style]) => !style.disabled); // disabledフラグをチェック
        
        if (availableStyleEntries.length === 0) {
            throw new Error(`スピーカー '${speaker.speakerName}' に利用可能なスタイルがありません`);
        }
        
        // 明示的にスタイルが指定された場合はそれを優先
        if (specifiedStyle) {
            // styleNameで検索（日本語名）
            const requestedEntry = availableStyleEntries.find(([_, style]) => 
                style.styleName === specifiedStyle
            );
            
            if (requestedEntry) {
                return requestedEntry[1];
            }
            
            // 指定されたスタイルが見つからない場合はエラー
            const availableStyleNames = availableStyleEntries.map(([_, style]) => style.styleName);
            const errorMessage = `指定されたスタイル '${specifiedStyle}' が見つかりません。利用可能なスタイル: ${availableStyleNames.join(', ')}`;
            throw new Error(errorMessage);
        }
        
        switch (speaker.style_selection) {
            case 'default':
                // デフォルトスタイルを使用（キーで検索）
                const defaultEntry = availableStyleEntries.find(([key, _]) => key === speaker.default_style);
                return defaultEntry ? defaultEntry[1] : availableStyleEntries[0][1];
                
            case 'random':
                // ランダム選択
                const randomIndex = Math.floor(Math.random() * availableStyleEntries.length);
                return availableStyleEntries[randomIndex][1];
                
            case 'specified':
                // 指定されたスタイル（今回は default と同じ扱い）
                const specifiedEntry = availableStyleEntries.find(([key, _]) => key === speaker.default_style);
                return specifiedEntry ? specifiedEntry[1] : availableStyleEntries[0][1];
                
            default:
                return availableStyleEntries[0][1];
        }
    }

    /**
     * 挨拶パターンを自動抽出
     */
    async extractGreetingPatterns(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }
        return await this.configManager.getGreetingPatterns();
    }

    /**
     * 音声設定を更新
     */
    async updateVoiceSetting(voiceId: string | null, styleId: number = 0): Promise<void> {
        if (!this.coeiroinkConfigFile) {
            throw new Error('CharacterInfoService is not initialized');
        }
        
        try {
            // デフォルト設定を生成
            const defaultConfig = {
                connection: {
                    host: CONNECTION_SETTINGS.DEFAULT_HOST,
                    port: CONNECTION_SETTINGS.DEFAULT_PORT
                },
                voice: {
                    rate: 200,
                    default_voice_id: DEFAULT_VOICE.ID
                },
                audio: {
                    latencyMode: 'balanced',
                    splitMode: 'punctuation',
                    bufferSize: 1024
                }
            };
            
            const config = await this.readJsonFile(this.coeiroinkConfigFile, defaultConfig) as Record<string, unknown>;
            
            // 設定を更新
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
            
            await this.writeJsonFile(this.coeiroinkConfigFile, config);
        } catch (error) {
            console.error(`音声設定更新エラー: ${(error as Error).message}`);
        }
    }
    
    /**
     * JSONファイルを安全に読み込み
     */
    private async readJsonFile<T>(filePath: string, defaultValue: T = {} as T): Promise<T> {
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
     * JSONファイルを安全に書き込み
     */
    private async writeJsonFile(filePath: string, data: unknown): Promise<void> {
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }

    /**
     * 指定されたオペレータの詳細情報を取得してキャラクター変換
     */
    async getOperatorCharacterInfo(operatorId: string): Promise<Speaker> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }

        try {
            const config = await this.configManager.getCharacterConfig(operatorId);
            return convertCharacterConfigToSpeaker(config);
        } catch (error) {
            throw new Error(`オペレータ '${operatorId}' は存在しないか無効です`);
        }
    }

    /**
     * スピーカーとスタイル情報から音声設定データを生成
     */
    generateVoiceConfigData(speaker: Speaker, selectedStyle: Style): {
        speakerId: string;
        styleId: number;
        speakerInfo: {
            speakerName: string;
            styleName: string;
            personality: string;
            speakingStyle: string;
        };
    } {
        return {
            speakerId: speaker.speakerId,
            styleId: selectedStyle.styleId,
            speakerInfo: {
                speakerName: speaker.speakerName,
                styleName: selectedStyle.styleName,
                personality: selectedStyle.personality,
                speakingStyle: selectedStyle.speaking_style
            }
        };
    }

    /**
     * 利用可能なキャラクターIDリストを取得
     */
    async getAvailableCharacterIds(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }
        return await this.configManager.getAvailableCharacterIds();
    }
    
}

export default CharacterInfoService;