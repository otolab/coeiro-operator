/**
 * src/operator/character-info-service.ts: キャラクター情報管理サービス
 * キャラクター詳細情報、スタイル情報の取得を担当（読み込み専用）
 * 
 * 用語定義:
 * - Speaker: COEIROINKの声の単位（音声モデル）
 * - Style: Speakerの声のバリエーション（「れいせい」「おしとやか」など）
 * - Character: Speakerに性格や口調の情報を付与したもの（defaultStyleなども持つ）
 * - Operator: sessionId毎に割り当てられたCharacter
 */

import ConfigManager, { CharacterConfig, CharacterStyle } from './config-manager.js';

/**
 * Style: Speakerの声のバリエーション
 * COEIROINKでは一つのSpeakerが複数のStyleを持つことができる
 * 例: つくよみちゃんの「れいせい」「おしとやか」「げんき」
 */
export interface Style {
    styleId: number;        // COEIROINK APIのスタイルID（数値）
    styleName: string;      // スタイル名（「れいせい」「おしとやか」など）
}

/**
 * StyleWithMetadata: Styleにメタデータを付与したもの
 * Character設定で定義されるスタイルごとの情報
 */
export interface StyleWithMetadata extends Style {
    personality: string;    // このスタイルでの性格
    speaking_style: string; // このスタイルでの話し方
    enabled: boolean;       // 有効/無効フラグ
    disabled?: boolean;     // 無効フラグ（後方互換性）
}

/**
 * Speaker: COEIROINKの声の単位（純粋な音声モデル）
 * COEIROINK APIから取得される情報を含む
 * 音声合成時に必要な最小限の情報
 */
export interface Speaker {
    speakerId: string;      // COEIROINK APIのspeakerUuid（UUID形式）
    speakerName: string;    // COEIROINK APIのspeakerName（表示名）
    styles: Style[];        // 利用可能なスタイル一覧（COEIROINK APIから）
}

/**
 * Character: Speakerに性格や口調の情報を付与したもの
 * 本システムで管理するキャラクター情報
 * Speaker + 性格設定 + 挨拶 + スタイルメタデータ = Character
 * オペレータ割り当て時に使用
 */
export interface Character {
    characterId: string;                          // キャラクターID（'tsukuyomi' など）
    speaker: Speaker;                             // COEIROINKのSpeaker情報（音声合成用）
    availableStyles: Record<string, StyleWithMetadata>;  // 利用可能なスタイル（メタデータ付き）
    styleSelection: 'default' | 'random';        // スタイル選択方法
    defaultStyle: string;                        // デフォルトスタイル名
    greeting?: string;                           // アサイン時の挨拶
    farewell?: string;                           // 解放時の挨拶
    personality: string;                         // キャラクターの基本性格
    speakingStyle: string;                       // キャラクターの基本的な話し方
}


// CharacterConfigからCharacterに変換するヘルパー関数
function convertCharacterConfigToCharacter(characterId: string, config: CharacterConfig): Character {
    // COEIROINK APIから取得されるSpeaker情報
    const speaker: Speaker = {
        speakerId: config.speaker_id || '',
        speakerName: config.name,
        styles: Object.values(config.available_styles).map(style => ({
            styleId: style.styleId,
            styleName: style.styleName
        }))
    };
    
    // スタイルにメタデータを付与
    const availableStyles: Record<string, StyleWithMetadata> = {};
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
        characterId,
        speaker,
        availableStyles,
        styleSelection: config.style_selection as 'default' | 'random',
        defaultStyle: config.default_style,
        greeting: config.greeting,
        farewell: config.farewell,
        personality: config.personality,
        speakingStyle: config.speaking_style
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
    async getCharacterInfo(characterId: string): Promise<Character> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }
        const config = await this.configManager.getCharacterConfig(characterId);
        return convertCharacterConfigToCharacter(characterId, config);
    }

    /**
     * スタイルを選択
     * @param character キャラクター情報
     * @param specifiedStyle 指定されたスタイル名
     */
    selectStyle(character: Character, specifiedStyle: string | null = null): StyleWithMetadata {
        const availableStyleEntries = Object.entries(character.availableStyles || {})
            .filter(([_, style]) => !style.disabled); // disabledフラグをチェック
        
        if (availableStyleEntries.length === 0) {
            throw new Error(`キャラクター '${character.speaker.speakerName}' に利用可能なスタイルがありません`);
        }
        
        // 明示的にスタイルが指定された場合はそれを優先（空文字はデフォルトを意味する）
        if (specifiedStyle && specifiedStyle !== '') {
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
        
        switch (character.styleSelection) {
            case 'default':
                // デフォルトスタイルを使用（キーで検索）
                const defaultEntry = availableStyleEntries.find(([key, _]) => key === character.defaultStyle);
                return defaultEntry ? defaultEntry[1] : availableStyleEntries[0][1];
                
            case 'random':
                // ランダム選択
                const randomIndex = Math.floor(Math.random() * availableStyleEntries.length);
                return availableStyleEntries[randomIndex][1];
                
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

    // 削除: updateVoiceSettingメソッド
    // CharacterInfoServiceは読み込み専用サービスとして設計されているため、
    // 設定ファイルの更新機能は削除しました。
    // 設定の更新が必要な場合は、ConfigManagerを通じて行ってください。

    /**
     * 指定されたキャラクターIDからCharacter情報を取得
     * オペレータ割り当て時に使用
     */
    async getOperatorCharacterInfo(characterId: string): Promise<Character> {
        if (!this.configManager) {
            throw new Error('CharacterInfoService is not initialized');
        }

        try {
            const config = await this.configManager.getCharacterConfig(characterId);
            return convertCharacterConfigToCharacter(characterId, config);
        } catch (error) {
            throw new Error(`オペレータ '${characterId}' は存在しないか無効です`);
        }
    }

    /**
     * キャラクターとスタイル情報から音声設定データを生成
     * COEIROINK API向けの設定データを作成
     */
    generateVoiceConfigData(character: Character, selectedStyle: StyleWithMetadata): {
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
            speakerId: character.speaker.speakerId,
            styleId: selectedStyle.styleId,
            speakerInfo: {
                speakerName: character.speaker.speakerName,
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