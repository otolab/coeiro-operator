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

import ConfigManager from './config-manager.js';
import { CharacterConfig, StyleConfig } from './character-defaults.js';
import { getSpeakerProvider } from '../environment/speaker-provider.js';

/**
 * Style: Speakerの声のバリエーション（API形式）
 * COEIROINKでは一つのSpeakerが複数のStyleを持つことができる
 * 例: つくよみちゃんの「れいせい」「おしとやか」「げんき」
 *
 * COEIROINK APIから取得される形式（配列要素として使用）
 */
export interface Style {
  styleId: number; // COEIROINK APIのスタイルID（数値）
  styleName: string; // スタイル名（「れいせい」「おしとやか」など）
  morasPerSecond?: number; // 基準話速（モーラ/秒）- オプショナル
  personality?: string; // スタイル固有の性格
  speakingStyle?: string; // スタイル固有の話し方
}

/**
 * Speaker: COEIROINKの声の単位（純粋な音声モデル）
 * COEIROINK APIから取得される情報を含む
 * 音声合成時に必要な最小限の情報
 */
export interface Speaker {
  speakerId: string; // COEIROINK APIのspeakerUuid（UUID形式）
  speakerName: string; // COEIROINK APIのspeakerName（表示名）
  styles: Style[]; // 利用可能なスタイル一覧（COEIROINK APIから）
}

/**
 * Character: Speakerに性格や口調の情報を付与したもの（実行時型）
 * Speaker（APIから） + Character設定（ファイルから） = Character
 */
export interface Character {
  characterId: string; // キャラクターID（'tsukuyomi' など）
  speakerId: string; // COEIROINK speakerUuid
  speakerName: string; // COEIROINK speakerName（表示名）
  defaultStyleId: number; // デフォルトスタイルID（数値）
  greeting: string; // アサイン時の挨拶
  farewell: string; // 解放時の挨拶
  personality: string; // キャラクターの性格
  speakingStyle: string; // キャラクターの話し方
  styles: Record<number, StyleConfig>; // スタイル設定（キー: styleId）
}

/**
 * SpeakerInfo: SpeakerとCharacterの対応関係情報
 * listSpeakers()の戻り値型
 */
export interface SpeakerInfo {
  speakerId: string; // COEIROINKのspeakerUuid
  speakerName: string; // Speaker名
  isRegistered: boolean; // どれかのCharacterで使用されているか
  usedByCharacters: string[]; // 使用しているcharacterIdのリスト
  styles: Array<{
    styleId: number;
    styleName: string;
  }>;
}

// CharacterConfigからCharacterに変換するヘルパー関数
async function convertCharacterConfigToCharacter(
  characterId: string,
  config: CharacterConfig
): Promise<Character> {
  return {
    characterId,
    speakerId: config.speakerId,
    speakerName: config.name,
    defaultStyleId: config.defaultStyleId,
    greeting: config.greeting || '',
    farewell: config.farewell || '',
    personality: config.personality,
    speakingStyle: config.speakingStyle,
    styles: config.styles,
  };
}

export class CharacterInfoService {
  private configManager: ConfigManager | null = null;

  constructor() {
    // キャラクター情報の読み込み専用サービス
  }

  /**
   * 初期化：ConfigManagerを設定
   */
  initialize(configManager: ConfigManager): void {
    this.configManager = configManager;
  }

  /**
   * キャラクター情報を取得
   */
  async getCharacterInfo(characterId: string): Promise<Character | null> {
    if (!this.configManager) {
      throw new Error('CharacterInfoService is not initialized');
    }
    const config = await this.configManager.getCharacterConfig(characterId);
    if (!config) {
      return null;
    }
    return await convertCharacterConfigToCharacter(characterId, config);
  }

  /**
   * スタイルを選択
   * @param character キャラクター情報
   * @param specifiedStyle 指定されたスタイル名
   */
  selectStyle(character: Character, specifiedStyle: string | null = null): Style {
    if (!character.styles || Object.keys(character.styles).length === 0) {
      throw new Error(`キャラクター '${character.characterId}' に利用可能なスタイルがありません`);
    }

    // disabledでないスタイルのみを抽出してStyle型に変換
    const enabledStyles: Style[] = Object.entries(character.styles)
      .filter(([_, styleConfig]) => !styleConfig.disabled)
      .map(([styleId, styleConfig]) => ({
        styleId: Number(styleId),
        styleName: styleConfig.styleName,
        morasPerSecond: styleConfig.morasPerSecond,
        personality: styleConfig.personality,
        speakingStyle: styleConfig.speakingStyle,
      }));

    if (enabledStyles.length === 0) {
      throw new Error(`キャラクター '${character.characterId}' に利用可能なスタイルがありません`);
    }

    // 明示的にスタイルが指定された場合
    if (specifiedStyle && specifiedStyle !== '') {
      const requestedStyle = enabledStyles.find(style => style.styleName === specifiedStyle);

      if (requestedStyle) {
        return requestedStyle;
      }

      // 指定されたスタイルが見つからない場合はエラー
      const availableStyleNames = enabledStyles.map(style => style.styleName);
      const errorMessage = `指定されたスタイル '${specifiedStyle}' が見つかりません。利用可能なスタイル: ${availableStyleNames.join(', ')}`;
      throw new Error(errorMessage);
    }

    // デフォルトスタイルを検索（disabledでない場合のみ）
    const defaultStyleConfig = character.styles[character.defaultStyleId];
    if (defaultStyleConfig && !defaultStyleConfig.disabled) {
      return {
        styleId: character.defaultStyleId,
        styleName: defaultStyleConfig.styleName,
        morasPerSecond: defaultStyleConfig.morasPerSecond,
        personality: defaultStyleConfig.personality,
        speakingStyle: defaultStyleConfig.speakingStyle,
      };
    }

    // デフォルトが見つからないか無効な場合は最初の有効なスタイルを使用
    return enabledStyles[0];
  }

  // 削除: extractGreetingPatternsメソッド
  // greetingフィールドは各キャラクターに1つずつ定義されており、
  // assignOperator時に自動的に返されるため、別途抽出機能は不要

  // 削除: updateVoiceSettingメソッド
  // CharacterInfoServiceは読み込み専用サービスとして設計されているため、
  // 設定ファイルの更新機能は削除しました。
  // 設定の更新が必要な場合は、ConfigManagerを通じて行ってください。

  /**
   * 指定されたキャラクターIDからCharacter情報を取得
   * オペレータ割り当て時に使用
   */
  async getOperatorCharacterInfo(characterId: string): Promise<Character | null> {
    if (!this.configManager) {
      throw new Error('CharacterInfoService is not initialized');
    }

    try {
      const config = await this.configManager.getCharacterConfig(characterId);
      if (!config) {
        return null;
      }
      return await convertCharacterConfigToCharacter(characterId, config);
    } catch {
      throw new Error(`オペレータ '${characterId}' は存在しないか無効です`);
    }
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

  /**
   * COEIROINKで利用可能なSpeaker一覧を取得
   * @param options.unregisteredOnly - trueの場合、キャラクター登録されていないSpeakerのみ返す
   */
  async listSpeakers(options?: { unregisteredOnly?: boolean }): Promise<SpeakerInfo[]> {
    if (!this.configManager) {
      throw new Error('CharacterInfoService is not initialized');
    }

    // 1. COEIROINK APIから全Speaker取得
    const speakerProvider = getSpeakerProvider();
    const apiSpeakers = await speakerProvider.getSpeakers();

    // 2. 登録済みキャラクター一覧を取得
    const characterIds = await this.configManager.getAvailableCharacterIds();
    const characters: Record<string, { speakerId: string; characterId: string }> = {};

    for (const characterId of characterIds) {
      const character = await this.configManager.getCharacterConfig(characterId);
      if (character) {
        characters[character.speakerId] = characters[character.speakerId] || {
          speakerId: character.speakerId,
          characterId
        };
      }
    }

    // 3. Speaker情報を構築
    const speakerInfos: SpeakerInfo[] = [];

    for (const speaker of apiSpeakers) {
      const usedByCharacters: string[] = [];

      // このspeakerIdを使用しているキャラクターを検索
      for (const characterId of characterIds) {
        const character = await this.configManager.getCharacterConfig(characterId);
        if (character?.speakerId === speaker.speakerUuid) {
          usedByCharacters.push(characterId);
        }
      }

      const isRegistered = usedByCharacters.length > 0;

      // unregisteredOnlyオプションが有効な場合、登録済みはスキップ
      if (options?.unregisteredOnly && isRegistered) {
        continue;
      }

      speakerInfos.push({
        speakerId: speaker.speakerUuid,
        speakerName: speaker.speakerName,
        isRegistered,
        usedByCharacters,
        styles: speaker.styles.map(s => ({
          styleId: s.styleId,
          styleName: s.styleName,
        })),
      });
    }

    return speakerInfos;
  }
}

export default CharacterInfoService;
