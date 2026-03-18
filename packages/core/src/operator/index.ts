#!/usr/bin/env node

/**
 * src/operator/index.ts: オペレータ管理システム（TypeScript実装）
 * キャラクター:スタイル単位での管理とMCP情報提供に対応
 */

import { join } from 'path';
import ConfigManager from './config/config-manager.js';
import FileOperationManager from './file-operation-manager.js';
import { hostname } from 'os';
import CharacterInfoService, { Character, Style } from './character/character-info-service.js';
import { mkdir } from 'fs/promises';
import { logger } from '@coeiro-operator/common';
import { SpeechRateMeasurer, generateCharacterId } from './speech-rate-measurer.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// セッション識別情報
export interface SessionInfo {
  /** サニタイズ済みプレフィックス付きID（FileOperationManagerのキーとして使用） */
  id: string;
  /** ITERM_SESSION_IDの生値（iTerm2 APIでのセッション特定用） */
  itermSessionId?: string;
  /** itmuxプロジェクト名の生値（iTerm2 APIでのウィンドウ特定用） */
  projectName?: string;
}

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

/**
 * セッションIDを取得
 *
 * 複数の環境（iTmux、tmux、iTerm2、その他）に対応し、
 * 名前空間の衝突を防ぐためプレフィックスを付与します。
 *
 * 優先順位:
 * 1. itmux current - iTmuxプロジェクト単位（tmux環境で優先的に試行）
 * 2. ITERM_SESSION_ID - iTerm2セッション単位
 * 3. TERM_SESSION_ID - その他のターミナル
 * 4. PID - フォールバック
 */
export async function getSessionId(): Promise<SessionInfo> {
  // 1. tmux使用時: iTmuxプロジェクト名を試行
  if (process.env.TMUX) {
    try {
      const { stdout } = await execAsync('itmux current');
      const projectName = stdout.trim();
      if (projectName) {
        const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '_');
        return {
          id: `ITMUX_PROJECT:${sanitizedName}`,
          projectName
        };
      }
    } catch (error) {
      // itmuxコマンドが存在しない、またはプロジェクト外の場合は次へ
      logger.debug('itmux currentコマンドが失敗しました。', error);
    }
  }

  // 2. iTerm2セッション単位
  if (process.env.ITERM_SESSION_ID) {
    const sessionId = process.env.ITERM_SESSION_ID.replace(/[:-]/g, '_');
    return {
      id: `ITERM_SESSION_ID:${sessionId}`,
      itermSessionId: process.env.ITERM_SESSION_ID
    };
  }

  // 3. その他のターミナル
  if (process.env.TERM_SESSION_ID) {
    const sessionId = process.env.TERM_SESSION_ID.replace(/[:-]/g, '_');
    return {
      id: `TERM_SESSION_ID:${sessionId}`
    };
  }

  // 4. フォールバック
  return {
    id: `PID:${process.ppid}`
  };
}

export class OperatorManager {
  private sessionId: string;
  private dataStore: FileOperationManager<CharacterSession> | null = null;
  private speechRateMeasurer: SpeechRateMeasurer;

  constructor(
    sessionId: string,
    private configManager: ConfigManager,
    private characterInfoService: CharacterInfoService
  ) {
    this.sessionId = sessionId;
    this.speechRateMeasurer = new SpeechRateMeasurer(configManager);
  }

  async initialize(): Promise<void> {
    // dataStoreを初期化（設定ディレクトリ内に保存）
    const operatorConfig = await this.configManager.getOperatorConfig();
    const timeoutMs = operatorConfig.timeout;
    const hostnameClean = hostname().replace(/[^a-zA-Z0-9]/g, '_');

    // オペレータ状態を永続的に保存するディレクトリを作成
    const operatorStateDir = this.configManager.getStateDir();
    await mkdir(operatorStateDir, { recursive: true });

    // ファイルパスを設定ディレクトリ内に変更
    const filePath = join(operatorStateDir, `operators-${hostnameClean}.json`);

    this.dataStore = new FileOperationManager<CharacterSession>(
      filePath,
      this.sessionId,
      timeoutMs
    );
  }

  /**
   * 設定の事前構築（外部からの呼び出し用）
   * @deprecated Phase 2以降でsetup関数に移行予定
   */
  async buildDynamicConfig(): Promise<void> {
    try {
      await this.configManager.buildDynamicConfig();
    } catch (error) {
      console.error(`OperatorManager buildDynamicConfig failed:`, (error as Error).message);
      throw error;
    }
  }

  /**
   * 利用可能なオペレータを取得（仕事中のオペレータ情報も含む）
   */
  async getAvailableOperators(): Promise<{ available: string[]; busy: string[] }> {
    if (!this.dataStore) {
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
      logger.debug('[OperatorManager] Cannot refresh - no operator assigned');
      return false; // オペレータが割り当てられていない
    }

    if (!this.dataStore) {
      logger.debug('[OperatorManager] Cannot refresh - dataStore not initialized');
      return false;
    }

    logger.debug(`[OperatorManager] Refreshing reservation for: ${operatorSession.characterId}`);
    const result = await this.dataStore.refresh();
    logger.debug(`[OperatorManager] Refresh result: ${result ? 'success' : 'failed'}`);
    return result;
  }

  /**
   * 未登録のSpeaker/Styleを検出
   *
   * @returns 登録状況の分類結果
   */
  async detectUnregisteredSpeakers(): Promise<{
    registered: Array<{
      speakerId: string;
      speakerName: string;
      characterId: string;
      registeredStyles: number;
      totalStyles: number;
      allStylesHaveSpeechRate: boolean;
    }>;
    partiallyRegistered: Array<{
      speakerId: string;
      speakerName: string;
      characterId: string;
      missingStyles: Array<{
        styleId: number;
        styleName: string;
      }>;
    }>;
    unregistered: Array<{
      speakerId: string;
      speakerName: string;
      totalStyles: number;
      styles: Array<{
        styleId: number;
        styleName: string;
      }>;
    }>;
  }> {
    // 1. API Speakersを取得
    const { getSpeakerProvider } = await import('../environment/speaker-provider.js');
    const speakerProvider = getSpeakerProvider();
    const apiSpeakers = await speakerProvider.getSpeakers();

    // 2. 登録済みキャラクターを取得
    const mergedConfig = this.configManager.getMergedConfig();
    const characters = mergedConfig?.characters || {};

    const registered = [];
    const partiallyRegistered = [];
    const unregistered = [];

    // 3. 各Speakerを分類
    for (const speaker of apiSpeakers) {
      const registeredChar = Object.entries(characters).find(
        ([_, config]) => config.speakerId === speaker.speakerUuid
      );

      if (!registeredChar) {
        // 完全未登録
        unregistered.push({
          speakerId: speaker.speakerUuid,
          speakerName: speaker.speakerName,
          totalStyles: speaker.styles.length,
          styles: speaker.styles.map(s => ({
            styleId: s.styleId,
            styleName: s.styleName,
          })),
        });
        continue;
      }

      const [characterId, characterConfig] = registeredChar;

      // スタイルの登録状況をチェック
      const missingStyles = speaker.styles.filter(apiStyle => {
        const styleConfig = characterConfig.styles?.[apiStyle.styleId];
        return !styleConfig || styleConfig.morasPerSecond === undefined;
      });

      if (missingStyles.length === 0) {
        // 完全登録
        registered.push({
          speakerId: speaker.speakerUuid,
          speakerName: speaker.speakerName,
          characterId,
          registeredStyles: speaker.styles.length,
          totalStyles: speaker.styles.length,
          allStylesHaveSpeechRate: true,
        });
      } else {
        // 部分登録
        partiallyRegistered.push({
          speakerId: speaker.speakerUuid,
          speakerName: speaker.speakerName,
          characterId,
          missingStyles: missingStyles.map(s => ({
            styleId: s.styleId,
            styleName: s.styleName,
          })),
        });
      }
    }

    return { registered, partiallyRegistered, unregistered };
  }

  /**
   * Speaker/Styleの話速を測定して登録
   *
   * @param speakerName Speaker名
   * @param styleName スタイル名（省略時は全スタイル）
   * @param characterId キャラクターID（省略時は自動生成）
   * @returns 測定結果
   */
  async measureAndRegisterSpeaker(
    speakerName: string,
    styleName?: string,
    characterId?: string
  ): Promise<{
    speakerId: string;
    speakerName: string;
    measurements: Array<{
      styleId: number;
      styleName: string;
      morasPerSecond: number;
    }>;
  }> {
    // 1. Speakerを検証
    const { getSpeakerProvider } = await import('../environment/speaker-provider.js');
    const speakerProvider = getSpeakerProvider();
    const apiSpeakers = await speakerProvider.getSpeakers();

    const speaker = apiSpeakers.find(s => s.speakerName === speakerName);
    if (!speaker) {
      throw new Error(`Speaker "${speakerName}" が見つかりません`);
    }

    // 2. 測定対象のスタイルを決定
    const targetStyles = styleName
      ? speaker.styles.filter(s => s.styleName === styleName)
      : speaker.styles;

    if (targetStyles.length === 0) {
      throw new Error(`Style "${styleName}" が見つかりません`);
    }

    // 3. 話速測定（測定ロジックを呼び出し）
    const measurements = await this.speechRateMeasurer.measureSpeechRateForStyles(
      speaker.speakerUuid,
      targetStyles
    );

    // 4. characterIdの決定
    const finalCharacterId = characterId || generateCharacterId(speakerName);

    // 5. config.jsonに登録
    await this.configManager.updateCharacterConfig(finalCharacterId, {
      speakerId: speaker.speakerUuid,
      name: speaker.speakerName,
      personality: '',
      speakingStyle: '',
      greeting: '',
      farewell: '',
      defaultStyleId: targetStyles[0].styleId,
      styles: Object.fromEntries(
        measurements.map(m => [
          m.styleId,
          {
            styleName: m.styleName,
            morasPerSecond: m.morasPerSecond,
          },
        ])
      ),
    });

    return {
      speakerId: speaker.speakerUuid,
      speakerName: speaker.speakerName,
      measurements,
    };
  }

  /**
   * キャラクターの話速を測定（登録済みキャラクター用）
   *
   * @param characterId キャラクターID
   * @param styleName スタイル名（省略時は全スタイル）
   * @param dryRun trueの場合は測定のみで設定更新しない
   * @returns 測定結果
   */
  async measureCharacterSpeechRate(
    characterId: string,
    styleName?: string,
    dryRun: boolean = false
  ): Promise<{
    characterId: string;
    speakerId: string;
    speakerName: string;
    measurements: Array<{
      styleId: number;
      styleName: string;
      morasPerSecond: number;
    }>;
  }> {
    // 1. CharacterConfigを取得
    const characterConfig = await this.configManager.getCharacterConfig(characterId);
    if (!characterConfig) {
      throw new Error(`Character "${characterId}" が見つかりません`);
    }

    // 2. SpeakerProviderからSpeaker情報を取得
    const { getSpeakerProvider } = await import('../environment/speaker-provider.js');
    const speakerProvider = getSpeakerProvider();
    const apiSpeakers = await speakerProvider.getSpeakers();

    const speaker = apiSpeakers.find(s => s.speakerUuid === characterConfig.speakerId);
    if (!speaker) {
      throw new Error(`Speaker "${characterConfig.speakerId}" が見つかりません`);
    }

    // 3. 測定対象のスタイルを決定
    const targetStyles = styleName
      ? speaker.styles.filter(s => s.styleName === styleName)
      : speaker.styles;

    if (targetStyles.length === 0) {
      throw new Error(`Style "${styleName}" が見つかりません`);
    }

    // 4. 話速測定
    const measurements = await this.speechRateMeasurer.measureSpeechRateForStyles(
      speaker.speakerUuid,
      targetStyles
    );

    // 5. config.jsonに登録（dryRunでない場合）
    if (!dryRun) {
      await this.configManager.updateCharacterConfig(characterId, {
        styles: Object.fromEntries(
          measurements.map(m => [
            m.styleId,
            {
              styleName: m.styleName,
              morasPerSecond: m.morasPerSecond,
            },
          ])
        ),
      });
    }

    return {
      characterId,
      speakerId: speaker.speakerUuid,
      speakerName: speaker.speakerName,
      measurements,
    };
  }

}

export default OperatorManager;
