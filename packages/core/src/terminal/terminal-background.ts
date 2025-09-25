import { TerminalBackground as TermBg } from '@coeiro-operator/term-bg';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { ConfigManager } from '../operator/config-manager.js';
import { getSpeakerProvider } from '../environment/speaker-provider.js';
import { logger } from '@coeiro-operator/common';

export class TerminalBackground {
  private currentCharacterId: string | null = null;
  private configManager: ConfigManager;
  private termBg: TermBg;
  private sessionId: string | undefined;

  constructor(configManager: ConfigManager, sessionId?: string) {
    this.configManager = configManager;
    this.termBg = new TermBg();
    this.sessionId = sessionId || this.getSessionId();
  }

  /**
   * セッションIDを取得（OperatorManagerと同じロジック）
   */
  private getSessionId(): string | undefined {
    // ITERM_SESSION_IDを優先、次にTERM_SESSION_IDを使用
    let sessionId = process.env.ITERM_SESSION_ID || process.env.TERM_SESSION_ID;

    if (sessionId && sessionId !== 'inherit') {
      // プレフィックス（例: "w4t0p0:"）を除去
      // 環境変数のセッションIDは "w4t0p0:UUID" の形式だが、
      // iTerm2 APIは "UUID" のみを期待する
      const colonIndex = sessionId.indexOf(':');
      if (colonIndex !== -1) {
        sessionId = sessionId.substring(colonIndex + 1);
      }
      return sessionId;
    }

    return undefined;
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
      // 背景画像を設定
      if (config.backgroundImages?.[characterId]) {
        logger.error(`📷 キャラクター専用背景画像を設定中: ${characterId}`);
        await this.setBackgroundImage(config.backgroundImages[characterId]);
      }

      // オペレータ画像を表示（APIから取得して背景に設定）
      if (config.operatorImage?.display === 'api') {
        logger.error('🌐 APIからオペレータ画像を取得中...');
        const imagePath = await this.fetchOperatorImageFromAPI(characterId);
        if (imagePath) {
          logger.error(`🖼️ APIから取得した画像を背景に設定中: ${imagePath}`);
          await this.setBackgroundImage(imagePath, config.operatorImage.opacity);
        } else {
          logger.error('⚠️ APIからオペレータ画像を取得できませんでした');
        }
      } else if (config.operatorImage?.display === 'file' && config.operatorImage.filePath) {
        const imagePath = config.operatorImage.filePath.startsWith('/')
          ? config.operatorImage.filePath
          : join(process.cwd(), config.operatorImage.filePath);
        logger.error(`📁 ファイルからオペレータ画像を設定中: ${imagePath}`);
        await this.setBackgroundImage(imagePath, config.operatorImage.opacity);
      } else {
        logger.error('ℹ️ オペレータ画像の設定なし:', {
          display: config.operatorImage?.display,
          hasFilePath: !!config.operatorImage?.filePath
        });
      }
    } catch (error) {
      logger.error(`背景画像の設定に失敗しました: ${error}`);
    }
  }

  /**
   * 背景画像を設定
   */
  private async setBackgroundImage(imagePath: string, opacity?: number): Promise<void> {
    try {
      // 絶対パスに変換
      const absolutePath = imagePath.startsWith('/') ? imagePath : join(process.cwd(), imagePath);

      logger.error('🔄 背景画像設定を試行中:', {
        imagePath: absolutePath,
        sessionId: this.sessionId,
        opacity: opacity ?? 0.3,
        position: 'bottom-right',
        scale: 0.15
      });

      await this.termBg.setBackground({
        imagePath: absolutePath,
        opacity: opacity ?? 0.3,  // デフォルト30%の不透明度
        position: 'bottom-right',  // 右下に配置
        scale: 0.15,  // 15%のサイズに縮小
        mode: 'fit',  // アスペクト比を保持
        sessionId: this.sessionId  // SessionIDを指定
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
      await this.termBg.clearBackground(this.sessionId);
      this.currentCharacterId = null;
      logger.info(`背景画像をクリアしました${this.sessionId ? ` (Session: ${this.sessionId})` : ''}`);
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