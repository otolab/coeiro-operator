import { TerminalBackground as TermBg } from '@coeiro-operator/term-bg';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ConfigManager } from '../operator/config/config-manager.js';
import { getSpeakerProvider } from '../environment/speaker-provider.js';
import { logger } from '@coeiro-operator/common';
import { getSessionId } from '../operator/index.js';

export class TerminalBackground {
  private currentCharacterId: string | null = null;
  private configManager: ConfigManager;
  private termBg: TermBg;
  private sessionId: string | undefined;
  private projectName: string | undefined;
  private initialized: boolean = false;

  constructor(configManager: ConfigManager, sessionId?: string) {
    this.configManager = configManager;
    this.termBg = new TermBg();
    this.sessionId = sessionId;
  }

  /**
   * セッションIDを取得して初期化
   */
  async initialize(): Promise<void> {
    if (!this.sessionId && !this.projectName) {
      const sessionInfo = await getSessionId();

      if (sessionInfo.projectName) {
        // itmuxプロジェクト名でウィンドウを特定
        this.projectName = sessionInfo.projectName;
      } else if (sessionInfo.itermSessionId) {
        // iTerm2セッションIDでセッションを特定
        this.sessionId = sessionInfo.itermSessionId;
      }
      // projectNameもitermSessionIdもない場合は対象ウィンドウを特定できないため背景画像設定をスキップ
      // NOTE: current_sessionへのフォールバックは行わない（意図しないウィンドウへの設定を防ぐため）
    }
    this.initialized = true;
  }

  /**
   * 背景画像が有効かチェック
   */
  async isEnabled(): Promise<boolean> {
    const config = await this.configManager.getTerminalBackgroundConfig();
    const isITerm = this.termBg.isITerm2();

    logger.error('🔍 Terminal background check:', {
      configEnabled: config.enabled,
      isITerm2: isITerm,
      TERM_PROGRAM: process.env.TERM_PROGRAM,
      ITERM_SESSION_ID: process.env.ITERM_SESSION_ID,
      TERM_SESSION_ID: process.env.TERM_SESSION_ID
    });

    return config.enabled && isITerm;
  }

  /**
   * キャラクター切り替え時の背景更新
   */
  async switchCharacter(characterId: string): Promise<void> {
    const config = await this.configManager.getTerminalBackgroundConfig();

    logger.error('🎨 背景画像切り替え処理を開始:', {
      characterId,
      sessionId: this.sessionId,
      configEnabled: config.enabled,
      isITerm2: this.termBg.isITerm2()
    });

    // 1. 機能が無効ならスキップ
    if (!config.enabled || !this.termBg.isITerm2()) {
      logger.error('⏭️ 背景画像設定をスキップ:', {
        reason: !config.enabled ? '設定が無効' : 'iTerm2ではない',
        configEnabled: config.enabled,
        isITerm2: this.termBg.isITerm2()
      });
      return;
    }

    this.currentCharacterId = characterId;

    try {
      // 2. 画像パスを決定
      let imagePath: string | null = null;

      if (config.imagePaths && characterId in config.imagePaths) {
        // 明示的な設定がある場合
        const pathValue = config.imagePaths[characterId];
        if (pathValue === null || pathValue === false) {
          // null/false = このキャラクターは画像なし
          logger.error(`🚫 ${characterId} は画像無効設定`);
          await this.clearBackground();
          return;
        }
        // string = ファイルパス
        imagePath = pathValue;
        logger.error(`📷 キャラクター専用画像を使用: ${characterId}`);
      } else {
        // 設定がない場合はAPIから取得
        logger.error('🌐 APIからオペレータ画像を取得中...');
        imagePath = await this.fetchOperatorImageFromAPI(characterId);
        if (!imagePath) {
          logger.error('⚠️ APIからオペレータ画像を取得できませんでした');
        }
      }

      // 3. 画像を設定（パスがある場合のみ）
      if (imagePath) {
        const display = config.display || {};
        logger.error(`🖼️ 背景画像を設定中: ${imagePath}`);
        await this.setBackgroundImage(imagePath, {
          opacity: display.opacity || 0.3,
          position: display.position || 'bottom-right',
          scale: display.scale || 0.15
        });
      } else {
        // 画像が取得できない場合はクリア
        await this.clearBackground();
      }
    } catch (error) {
      logger.error(`背景画像の設定に失敗しました: ${error}`);
    }
  }

  /**
   * 背景画像を設定
   */
  private async setBackgroundImage(
    imagePath: string,
    options?: {
      opacity?: number;
      position?: 'bottom-right' | 'top-right';
      scale?: number;
    }
  ): Promise<void> {
    try {
      // 絶対パスに変換
      const absolutePath = imagePath.startsWith('/') ? imagePath : join(process.cwd(), imagePath);

      const { opacity = 0.3, position = 'bottom-right', scale = 0.15 } = options || {};

      logger.error('🔄 背景画像設定を試行中:', {
        imagePath: absolutePath,
        sessionId: this.sessionId,
        opacity,
        position,
        scale
      });

      await this.termBg.setBackground({
        imagePath: absolutePath,
        opacity,
        position,
        scale,
        mode: 'fit',  // アスペクト比を保持
        sessionId: this.sessionId,
        projectName: this.projectName,
      });

      logger.error(`✅ 背景画像の設定に成功: ${absolutePath}${this.sessionId ? ` (Session: ${this.sessionId})` : ''}`);
    } catch (error) {
      logger.error(`❌ 背景画像の設定に失敗: ${error}`);
      logger.error('失敗の詳細:', {
        errorMessage: (error as Error).message,
        sessionId: this.sessionId,
        imagePath
      });
      throw error;  // エラーを再スロー
    }
  }

  /**
   * APIからオペレータ画像を取得
   */
  private async fetchOperatorImageFromAPI(characterId: string): Promise<string | null> {
    try {
      // ConfigManagerからキャラクター設定を取得
      const characterConfig = await this.configManager.getCharacterConfig(characterId);
      if (!characterConfig || !characterConfig.speakerId) {
        logger.info(`キャラクター ${characterId} の設定が見つかりません`);
        return null;
      }

      // SpeakerProviderから立ち絵を取得
      const connectionConfig = await this.configManager.getConnectionConfig();
      const speakerProvider = getSpeakerProvider(connectionConfig);
      const portrait = await speakerProvider.getSpeakerPortrait(characterConfig.speakerId);

      if (!portrait) {
        logger.info(`キャラクター ${characterId} の立ち絵が見つかりません`);
        return null;
      }

      // データURLプレフィックスを除去（必要な場合）
      let base64Data = portrait;
      if (base64Data.startsWith('data:image')) {
        const commaIndex = base64Data.indexOf(',');
        if (commaIndex !== -1) {
          base64Data = base64Data.substring(commaIndex + 1);
        }
      }

      // Base64画像をファイルとして保存
      const tempPath = `/tmp/operator-${characterId}.png`;
      const imageBuffer = Buffer.from(base64Data, 'base64');
      await writeFile(tempPath, imageBuffer);

      // PNGヘッダーの確認
      const header = imageBuffer.slice(0, 4);
      const isPNG = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;

      if (!isPNG) {
        logger.error(`保存したファイルが有効なPNGファイルではありません`);
        return null;
      }

      return tempPath;
    } catch (error) {
      logger.error(`API画像取得エラー: ${error}`);
    }
    return null;
  }

  /**
   * 背景をクリア
   */
  async clearBackground(): Promise<void> {
    if (!this.termBg.isITerm2()) {
      return;
    }

    try {
      await this.termBg.clearBackground(this.sessionId, this.projectName);
      this.currentCharacterId = null;
      logger.info(`背景画像をクリアしました${this.sessionId ? ` (Session: ${this.sessionId})` : this.projectName ? ` (Project: ${this.projectName})` : ''}`);
    } catch (error) {
      logger.error(`背景のクリアに失敗しました: ${error}`);
    }
  }

  /**
   * 現在のキャラクターID取得
   */
  getCurrentCharacter(): string | null {
    return this.currentCharacterId;
  }
}