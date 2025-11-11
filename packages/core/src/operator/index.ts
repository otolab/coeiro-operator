#!/usr/bin/env node

/**
 * src/operator/index.ts: オペレータ管理システム（TypeScript実装）
 * キャラクター:スタイル単位での管理とMCP情報提供に対応
 */

import { join } from 'path';
import ConfigManager from './config-manager.js';
import FileOperationManager from './file-operation-manager.js';
import { hostname } from 'os';
import CharacterInfoService, { Character, Style } from './character-info-service.js';
import { getConfigDir } from '../common/config-paths.js';
import { mkdir } from 'fs/promises';
import { logger } from '@coeiro-operator/common';
import { getSpeakerProvider } from '../environment/speaker-provider.js';

// セッション情報（キャラクターとスタイルの組み合わせ）
interface CharacterSession {
  characterId: string; // キャラクターID（例: 'tsukuyomi'）
  styleId?: number; // スタイルID（例: 0, 1, 2）
  styleName?: string; // スタイル名（例: 'れいせい'）
}

// CharacterInfoServiceからインポートされた型を使用

interface AssignResult {
  characterId: string; // キャラクターID（例: 'tsukuyomi'）
  characterName: string; // キャラクター表示名（例: 'つくよみちゃん'）
  currentStyle: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  speakerConfig: {
    // COEIROINK API用の設定
    speakerId: string; // COEIROINKのスピーカーUUID
    styleId: number; // COEIROINKのスタイルID
  };
  greeting?: string;
  message?: string;
}

interface ReleaseResult {
  characterId?: string; // キャラクターID（未割り当ての場合はundefined）
  characterName?: string; // キャラクター表示名（未割り当ての場合はundefined）
  farewell?: string; // お別れメッセージ（未割り当ての場合はundefined）
  wasAssigned: boolean; // オペレータが割り当てられていたかどうか
}

interface StatusResult {
  characterId?: string; // キャラクターID
  characterName?: string; // キャラクター表示名
  currentStyle?: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  message: string;
}

// Speaker情報（listSpeakers用）
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

/**
 * セッションIDを取得
 */
function getSessionId(): string {
  if (process.env.ITERM_SESSION_ID) {
    return process.env.ITERM_SESSION_ID.replace(/[:-]/g, '_');
  } else if (process.env.TERM_SESSION_ID) {
    return process.env.TERM_SESSION_ID.replace(/[:-]/g, '_');
  } else {
    return process.ppid.toString();
  }
}

export class OperatorManager {
  private sessionId: string;
  private configDir: string | null = null;
  private coeiroinkConfigFile: string | null = null;
  private configManager: ConfigManager | null = null;
  private dataStore: FileOperationManager<CharacterSession> | null = null;
  private characterInfoService: CharacterInfoService;

  constructor() {
    this.sessionId = getSessionId();

    // 初期化時はnullを設定（initializeで正式に設定）
    this.dataStore = null;
    this.characterInfoService = new CharacterInfoService();
  }

  async initialize(): Promise<void> {
    this.configDir = await getConfigDir();
    this.coeiroinkConfigFile = join(this.configDir, 'coeiroink-config.json');

    // 設定管理システムを初期化
    this.configManager = new ConfigManager(this.configDir);

    // ConfigManagerの動的設定を事前にビルドして初期化を完了
    try {
      await this.configManager.buildDynamicConfig();
    } catch (error) {
      console.warn(`OperatorManager dynamic config build failed:`, (error as Error).message);
    }

    // dataStoreを初期化（設定ディレクトリ内に保存）
    const operatorConfig = await this.configManager.getOperatorConfig();
    const timeoutMs = operatorConfig.timeout;
    const hostnameClean = hostname().replace(/[^a-zA-Z0-9]/g, '_');

    // オペレータ状態を永続的に保存するディレクトリを作成
    const operatorStateDir = join(this.configDir, 'state');
    await mkdir(operatorStateDir, { recursive: true });

    // ファイルパスを設定ディレクトリ内に変更
    const filePath = join(operatorStateDir, `operators-${hostnameClean}.json`);

    this.dataStore = new FileOperationManager<CharacterSession>(
      filePath,
      this.sessionId,
      timeoutMs
    );

    console.log(`[OperatorManager] State file path: ${filePath}`);

    // CharacterInfoServiceを初期化
    this.characterInfoService.initialize(this.configManager, this.coeiroinkConfigFile);
  }

  /**
   * 設定の事前構築（外部からの呼び出し用）
   */
  async buildDynamicConfig(): Promise<void> {
    if (!this.configManager) {
      throw new Error('ConfigManager is not initialized');
    }

    try {
      await this.configManager.buildDynamicConfig();
    } catch (error) {
      console.error(`OperatorManager buildDynamicConfig failed:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * キャラクター情報を取得
   */
  async getCharacterInfo(characterId: string): Promise<Character | null> {
    return await this.characterInfoService.getCharacterInfo(characterId);
  }

  /**
   * スタイルを選択
   * @param character キャラクター情報
   * @param specifiedStyle 指定されたスタイル名
   */
  selectStyle(character: Character, specifiedStyle: string | null = null): Style {
    return this.characterInfoService.selectStyle(character, specifiedStyle);
  }


  /**
   * 利用可能なオペレータを取得（仕事中のオペレータ情報も含む）
   */
  async getAvailableOperators(): Promise<{ available: string[]; busy: string[] }> {
    if (!this.configManager || !this.dataStore) {
      throw new Error('State manager is not initialized');
    }

    const allOperators = await this.configManager.getAvailableCharacterIds();
    const otherAssignments = await this.dataStore.getOtherEntries();
    const busyCharacters = otherAssignments
      ? Object.values(otherAssignments).map(session => session.characterId)
      : [];

    const availableCharacters = allOperators.filter(op => !busyCharacters.includes(op));

    return {
      available: availableCharacters,
      busy: busyCharacters,
    };
  }

  /**
   * オペレータを予約
   */
  async reserveOperator(
    characterId: string,
    styleId?: number,
    styleName?: string
  ): Promise<boolean> {
    if (!this.dataStore) {
      throw new Error('State manager is not initialized');
    }
    try {
      await this.dataStore.store({ characterId, styleId, styleName });
      return true;
    } catch (error) {
      throw new Error(
        `オペレータ ${characterId} の予約に失敗しました: ${(error as Error).message}`
      );
    }
  }

  /**
   * オペレータを返却
   * オペレータが割り当てられていない場合も正常として扱う（時間切れ自動解放のケースがあるため）
   */
  async releaseOperator(): Promise<ReleaseResult> {
    const operatorSession = await this.getCurrentOperatorSession();

    if (!operatorSession) {
      // オペレータが割り当てられていない場合も正常として扱う
      return {
        wasAssigned: false,
      };
    }

    const characterId = operatorSession.characterId;

    if (!this.dataStore) {
      throw new Error('State manager is not initialized');
    }
    await this.dataStore.remove();

    // お別れの挨拶情報を取得
    let character: Character | null = null;
    try {
      character = await this.characterInfoService.getCharacterInfo(characterId);
      if (!character) {
        character = null;
      }
    } catch {
      character = null;
    }

    return {
      characterId,
      characterName: character?.speakerName || characterId,
      farewell: character?.farewell || '',
      wasAssigned: true,
    };
  }

  /**
   * 全ての利用状況をクリア
   */
  async clearAllOperators(): Promise<boolean> {
    if (!this.dataStore) {
      throw new Error('State manager is not initialized');
    }
    await this.dataStore.clear();
    return true;
  }

  /**
   * 現在のセッションに割り当てられたオペレータIDを取得
   */
  async getCurrentOperatorId(): Promise<string | null> {
    if (!this.dataStore) {
      return null;
    }
    const session = await this.dataStore.restore();
    return session ? session.characterId : null;
  }

  /**
   * 現在のセッション情報を取得
   */
  async getCurrentOperatorSession(): Promise<CharacterSession | null> {
    if (!this.dataStore) {
      return null;
    }
    return this.dataStore.restore();
  }

  /**
   * 現在のセッションのオペレータが有効かチェック
   */
  async validateCurrentOperatorSession(): Promise<boolean> {
    const currentOperatorId = await this.getCurrentOperatorId();
    return currentOperatorId !== null;
  }

  /**
   * 指定されたキャラクターが利用中かチェック（全セッション対象）
   */
  async isOperatorBusy(characterId: string): Promise<boolean> {
    const result = await this.getAvailableOperators();
    return !result.available.includes(characterId);
  }

  /**
   * 現在のオペレータをサイレントで解放
   */
  async silentReleaseCurrentOperator(): Promise<string | null> {
    try {
      const currentSession = await this.getCurrentOperatorSession();
      if (!currentSession) {
        return null;
      }

      if (!this.dataStore) {
        return null;
      }
      await this.dataStore.remove();
      return currentSession.characterId;
    } catch {
      return null;
    }
  }

  /**
   * ランダムオペレータ選択と詳細情報付きアサイン
   */
  async assignRandomOperator(style: string | null = null): Promise<AssignResult> {
    const result = await this.getAvailableOperators();

    if (result.available.length === 0) {
      throw new Error('利用可能なオペレータがありません');
    }

    // ランダム選択
    const selectedCharacter = result.available[Math.floor(Math.random() * result.available.length)];

    return await this.assignSpecificOperator(selectedCharacter, style);
  }

  /**
   * 指定されたオペレータを詳細情報付きでアサイン
   */
  async assignSpecificOperator(
    specifiedCharacter: string,
    style: string | null = null
  ): Promise<AssignResult> {
    if (!specifiedCharacter) {
      throw new Error('キャラクターIDを指定してください');
    }

    if (!this.configManager) {
      throw new Error('Manager is not initialized');
    }

    // キャラクター情報を取得
    const character = await this.characterInfoService.getOperatorCharacterInfo(specifiedCharacter);
    if (!character) {
      throw new Error(`オペレータ '${specifiedCharacter}' は存在しないか無効です`);
    }

    // 既存のオペレータがいる場合は自動的にリリース（交代処理）
    const currentCharacterId = await this.getCurrentOperatorId();
    if (currentCharacterId) {
      // 同じキャラクターが指定された場合
      if (currentCharacterId === specifiedCharacter) {
        const selectedStyle = this.characterInfoService.selectStyle(character, style);

        // 現在のセッション情報を取得
        const currentSession = await this.getCurrentOperatorSession();

        // スタイルが変更されている場合はセッションを更新
        if (currentSession && currentSession.styleId !== selectedStyle.styleId) {
          await this.reserveOperator(specifiedCharacter, selectedStyle.styleId, selectedStyle.styleName);
          logger.info(`🔄 [ASSIGN] スタイル変更: ${currentSession.styleName} → ${selectedStyle.styleName} (ID:${selectedStyle.styleId})`);
        }

        // スタイル毎の設定を取得
        const styleConfig = character.styles?.[selectedStyle.styleId];

        return {
          characterId: specifiedCharacter,
          characterName: character.speakerName || character.characterId,
          currentStyle: {
            styleId: selectedStyle.styleId.toString(),
            styleName: selectedStyle.styleName,
            personality: styleConfig?.personality || character.personality,
            speakingStyle: styleConfig?.speakingStyle || character.speakingStyle,
          },
          speakerConfig: {
            speakerId: character.speakerId || '',
            styleId: selectedStyle.styleId,
          },
          message: `現在のオペレータ: ${character.speakerName || character.characterId} (${specifiedCharacter})`,
        };
      }

      // 現在のオペレータをサイレントリリース
      await this.silentReleaseCurrentOperator();
    }

    // 仕様書準拠: 統一された時間切れクリーンアップ付きで他セッション利用状況をチェック
    if (await this.isOperatorBusy(specifiedCharacter)) {
      throw new Error(`オペレータ '${specifiedCharacter}' は既に他のセッションで利用中です`);
    }

    // スタイルを選択
    const selectedStyle = this.characterInfoService.selectStyle(character, style);

    logger.info(`🔍 [ASSIGN] スタイル選択 - input: "${style}", selected: ${selectedStyle.styleName} (ID:${selectedStyle.styleId})`);

    // キャラクターを予約（スタイル情報も含めて）
    await this.reserveOperator(specifiedCharacter, selectedStyle.styleId, selectedStyle.styleName);

    logger.info('🔍 [ASSIGN] reserveOperator完了');

    // スタイル毎の設定を取得
    const styleConfig = character.styles?.[selectedStyle.styleId];

    return {
      characterId: specifiedCharacter,
      characterName: character.speakerName || character.characterId,
      currentStyle: {
        styleId: selectedStyle.styleId.toString(),
        styleName: selectedStyle.styleName,
        personality: styleConfig?.personality || character.personality,
        speakingStyle: styleConfig?.speakingStyle || character.speakingStyle,
      },
      speakerConfig: {
        speakerId: character.speakerId || '',
        styleId: selectedStyle.styleId,
      },
      greeting: character.greeting || '',
    };
  }

  /**
   * 現在のオペレータ情報表示
   * 仕様書準拠: getCurrentOperatorId()の自動時間切れ処理に依存し、統一された検証ロジックを実装
   */
  async showCurrentOperator(): Promise<StatusResult> {
    if (!this.configManager) {
      throw new Error('Manager is not initialized');
    }

    // 仕様書準拠: getCurrentOperatorSession()が時間切れチェックと自動解放を実行
    const operatorSession = await this.getCurrentOperatorSession();
    if (!operatorSession) {
      return {
        message: 'オペレータは割り当てられていません',
      };
    }

    const { characterId, styleId, styleName } = operatorSession;

    let character: Character | null;
    try {
      character = await this.characterInfoService.getCharacterInfo(characterId);
      if (!character) {
        return {
          characterId,
          message: `現在のオペレータ: ${characterId} (キャラクター情報なし)`,
        };
      }
    } catch {
      return {
        characterId,
        message: `現在のオペレータ: ${characterId} (キャラクター情報なし)`,
      };
    }

    // 保存されたスタイル情報を使用するか、デフォルトを選択
    let selectedStyle: Style;
    if (styleId !== undefined && styleName) {
      // 保存されたスタイルを検索
      const styleConfig = character.styles?.[styleId];
      if (styleConfig && !styleConfig.disabled) {
        selectedStyle = {
          styleId: styleId,
          styleName: styleConfig.styleName,
          morasPerSecond: styleConfig.morasPerSecond,
          personality: styleConfig.personality,
          speakingStyle: styleConfig.speakingStyle,
        };
      } else {
        selectedStyle = this.characterInfoService.selectStyle(character);
      }
    } else {
      selectedStyle = this.characterInfoService.selectStyle(character);
    }

    // スタイル毎の設定を取得
    const styleConfig = character.styles?.[selectedStyle.styleId];

    return {
      characterId,
      characterName: character.speakerName || character.characterId,
      currentStyle: {
        styleId: selectedStyle.styleId.toString(),
        styleName: selectedStyle.styleName,
        personality: styleConfig?.personality || character.personality,
        speakingStyle: styleConfig?.speakingStyle || character.speakingStyle,
      },
      message: `現在のオペレータ: ${character.speakerName || character.characterId} (${characterId}) - ${selectedStyle.styleName}`,
    };
  }

  /**
   * オペレータ予約のタイムアウトを延長
   * Issue #58: sayコマンド実行時の動的タイムアウト延長
   */
  async refreshOperatorReservation(): Promise<boolean> {
    const operatorSession = await this.getCurrentOperatorSession();
    if (!operatorSession) {
      console.log('[OperatorManager] Cannot refresh - no operator assigned');
      return false; // オペレータが割り当てられていない
    }

    if (!this.dataStore) {
      console.log('[OperatorManager] Cannot refresh - dataStore not initialized');
      return false;
    }

    console.log(`[OperatorManager] Refreshing reservation for: ${operatorSession.characterId}`);
    const result = await this.dataStore.refresh();
    console.log(`[OperatorManager] Refresh result: ${result ? 'success' : 'failed'}`);
    return result;
  }

  /**
   * COEIROINKで利用可能なSpeaker一覧を取得
   * @param options.unregisteredOnly - trueの場合、キャラクター登録されていないSpeakerのみ返す
   */
  async listSpeakers(options?: { unregisteredOnly?: boolean }): Promise<SpeakerInfo[]> {
    if (!this.configManager) {
      throw new Error('OperatorManager is not initialized');
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

export default OperatorManager;
