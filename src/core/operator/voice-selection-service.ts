/**
 * src/operator/voice-selection-service.ts: 音声選択・スタイル管理サービス
 * キャラクター情報取得、スタイル選択、音声設定更新を担当
 */

import ConfigManager, { CharacterConfig, CharacterStyle } from './config-manager.js';
import FileOperationManager from './file-operation-manager.js';

// インターフェース定義
export interface Style {
    styleId: string;
    name: string;
    personality: string;
    speaking_style: string;
    style_id: number;
    enabled: boolean;
    disabled?: boolean;
}

export interface Character {
    name: string;
    voice_id: string | null;
    available_styles: Record<string, Style>;
    style_selection: string;
    default_style: string;
    greeting?: string;
    farewell?: string;
    personality: string;
    speaking_style: string;
}

// CharacterConfigからCharacterに変換するヘルパー関数
function convertCharacterConfigToCharacter(config: CharacterConfig): Character {
    const availableStyles: Record<string, Style> = {};
    
    for (const [styleId, style] of Object.entries(config.available_styles)) {
        availableStyles[styleId] = {
            styleId: styleId,
            name: style.name,
            personality: style.personality,
            speaking_style: style.speaking_style,
            style_id: style.style_id,
            enabled: !style.disabled,
            disabled: style.disabled
        };
    }
    
    return {
        name: config.name,
        voice_id: config.voice_id,
        available_styles: availableStyles,
        style_selection: config.style_selection,
        default_style: config.default_style,
        greeting: config.greeting,
        farewell: config.farewell,
        personality: config.personality,
        speaking_style: config.speaking_style
    };
}

export class VoiceSelectionService {
    private configManager: ConfigManager | null = null;
    private fileOperationManager: FileOperationManager;
    private coeiroinkConfigFile: string | null = null;

    constructor(fileOperationManager: FileOperationManager) {
        this.fileOperationManager = fileOperationManager;
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
    async getCharacterInfo(characterId: string): Promise<Character> {
        if (!this.configManager) {
            throw new Error('VoiceSelectionService is not initialized');
        }
        const config = await this.configManager.getCharacterConfig(characterId);
        return convertCharacterConfigToCharacter(config);
    }

    /**
     * スタイルを選択
     */
    selectStyle(character: Character, specifiedStyle: string | null = null): Style {
        const availableStyles = Object.entries(character.available_styles || {})
            .filter(([_, style]) => !style.disabled) // disabledフラグをチェック
            .map(([styleId, style]) => ({ ...style, styleId }));
        
        if (availableStyles.length === 0) {
            throw new Error(`キャラクター '${character.name}' に利用可能なスタイルがありません`);
        }
        
        // 明示的にスタイルが指定された場合はそれを優先
        if (specifiedStyle) {
            const requestedStyle = availableStyles.find(s => 
                s.styleId === specifiedStyle || 
                s.name === specifiedStyle ||
                s.styleId.toString() === specifiedStyle
            );
            if (requestedStyle) {
                return requestedStyle;
            }
            // 指定されたスタイルが見つからない場合は警告ログを出力してデフォルト処理に続行
            console.warn(`指定されたスタイル '${specifiedStyle}' が見つかりません。デフォルト選択を使用します。`);
        }
        
        switch (character.style_selection) {
            case 'default':
                // デフォルトスタイルを使用
                const defaultStyle = availableStyles.find(s => s.styleId === character.default_style);
                return defaultStyle || availableStyles[0];
                
            case 'random':
                // ランダム選択
                return availableStyles[Math.floor(Math.random() * availableStyles.length)];
                
            case 'specified':
                // 指定されたスタイル（今回は default と同じ扱い）
                const specifiedStyleFromConfig = availableStyles.find(s => s.styleId === character.default_style);
                return specifiedStyleFromConfig || availableStyles[0];
                
            default:
                return availableStyles[0];
        }
    }

    /**
     * 挨拶パターンを自動抽出
     */
    async extractGreetingPatterns(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('VoiceSelectionService is not initialized');
        }
        return await this.configManager.getGreetingPatterns();
    }

    /**
     * 音声設定を更新
     */
    async updateVoiceSetting(voiceId: string | null, styleId: number = 0): Promise<void> {
        if (!this.coeiroinkConfigFile) {
            throw new Error('coeiroinkConfigFile is not initialized');
        }

        return await this.fileOperationManager.updateVoiceSetting(
            this.coeiroinkConfigFile, 
            voiceId, 
            styleId
        );
    }

    /**
     * 指定されたオペレータの詳細情報を取得してキャラクター変換
     */
    async getOperatorCharacterInfo(operatorId: string): Promise<Character> {
        if (!this.configManager) {
            throw new Error('VoiceSelectionService is not initialized');
        }

        try {
            const config = await this.configManager.getCharacterConfig(operatorId);
            return convertCharacterConfigToCharacter(config);
        } catch (error) {
            throw new Error(`オペレータ '${operatorId}' は存在しないか無効です`);
        }
    }

    /**
     * キャラクターとスタイル情報を含む音声設定データを生成
     */
    generateVoiceConfigData(character: Character, selectedStyle: Style): {
        voiceConfig: {
            voiceId: string;
            styleId: number;
        };
        styleInfo: {
            styleId: string;
            styleName: string;
            personality: string;
            speakingStyle: string;
        };
    } {
        return {
            voiceConfig: {
                voiceId: character.voice_id || '',
                styleId: selectedStyle.style_id
            },
            styleInfo: {
                styleId: selectedStyle.styleId,
                styleName: selectedStyle.name,
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
            throw new Error('VoiceSelectionService is not initialized');
        }
        return await this.configManager.getAvailableCharacterIds();
    }
}

export default VoiceSelectionService;