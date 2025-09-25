/**
 * src/core/environment/speaker-provider.ts: Speaker情報プロバイダ
 * COEIROINKサーバーからの動的Speaker情報取得を一元管理
 */

// CONNECTION_SETTINGSを直接定義（循環参照を避けるため）
const CONNECTION_SETTINGS = {
  DEFAULT_HOST: 'localhost',
  DEFAULT_PORT: '50032',
} as const;

export interface VoiceStyle {
  styleId: number;
  styleName: string;
}

export interface Speaker {
  speakerName: string;
  speakerUuid: string;
  styles: VoiceStyle[];
  base64Portrait?: string; // 立ち絵画像のbase64データ
}

export interface ConnectionConfig {
  host: string;
  port: string;
}

/**
 * Speaker情報プロバイダクラス
 * COEIROINKサーバーからのSpeaker情報取得を一元管理
 */
export class SpeakerProvider {
  private connectionConfig: ConnectionConfig;

  constructor(connectionConfig?: Partial<ConnectionConfig>) {
    this.connectionConfig = {
      host: connectionConfig?.host || CONNECTION_SETTINGS.DEFAULT_HOST,
      port: connectionConfig?.port || CONNECTION_SETTINGS.DEFAULT_PORT,
    };
  }

  /**
   * 接続設定を更新
   */
  updateConnection(config: Partial<ConnectionConfig>): void {
    this.connectionConfig = {
      ...this.connectionConfig,
      ...config,
    };
  }

  /**
   * サーバー接続確認
   */
  async checkConnection(): Promise<boolean> {
    const url = `http://${this.connectionConfig.host}:${this.connectionConfig.port}/v1/speakers`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 利用可能な音声一覧を取得
   */
  async getSpeakers(): Promise<Speaker[]> {
    const url = `http://${this.connectionConfig.host}:${this.connectionConfig.port}/v1/speakers`;

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const speakers = (await response.json()) as Speaker[];
      return speakers;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to fetch speakers: ${errorMessage}`);
    }
  }

  /**
   * 特定のSpeakerの立ち絵画像を取得
   */
  async getSpeakerPortrait(speakerId: string): Promise<string | null> {
    const speakers = await this.getSpeakers();
    const speaker = speakers.find(s => s.speakerUuid === speakerId);
    return speaker?.base64Portrait || null;
  }

  /**
   * 特定の音声のスタイル情報を取得
   */
  async getVoiceStyles(voiceId: string): Promise<VoiceStyle[]> {
    const speakers = await this.getSpeakers();
    const speaker = speakers.find(s => s.speakerUuid === voiceId);
    return speaker?.styles || [];
  }

  /**
   * 特定の音声の最初のスタイルIDを取得（フォールバック用）
   */
  async getFirstStyleId(voiceId: string): Promise<number> {
    const styles = await this.getVoiceStyles(voiceId);
    return styles.length > 0 ? styles[0].styleId : 0; // デフォルトスタイルID
  }

  /**
   * 全Speakerを取得（エイリアス）
   */
  async getAllSpeakers(): Promise<Speaker[]> {
    return await this.getSpeakers();
  }

  /**
   * デバッグ用：音声一覧をコンソール出力
   */
  async logAvailableVoices(): Promise<void> {
    try {
      const speakers = await this.getSpeakers();

      console.log('Available voices:');
      speakers.forEach(speaker => {
        console.log(`${speaker.speakerUuid}: ${speaker.speakerName}`);
        speaker.styles.forEach(style => {
          console.log(`  Style ${style.styleId}: ${style.styleName}`);
        });
      });
    } catch {
      console.error(
        `Error: Cannot connect to COEIROINK server at http://${this.connectionConfig.host}:${this.connectionConfig.port}`
      );
      console.error('Make sure the server is running.');
      // デバッグ用メソッドなので、エラーが発生してもプログラムを停止させない
      console.log('Available voices:');
      // エラー時は何も表示しない（エラーメッセージは既に出力済み）
    }
  }

  /**
   * 音声名からIDを生成（英語名への変換）
   */
  private speakerNameToId(speakerName: string): string {
    const SPEAKER_NAME_TO_ID_MAP: Record<string, string> = {
      つくよみちゃん: 'tsukuyomi',
      アンジーさん: 'angie',
      アルマちゃん: 'alma',
      'AI声優-朱花': 'akane',
      ディアちゃん: 'dia',
      KANA: 'kana',
      'AI声優-KANA': 'kana',
      金苗: 'kanae',
      'AI声優-金苗': 'kanae',
      リリンちゃん: 'rilin',
      MANA: 'mana',
      'AI声優-MANA': 'mana',
      おふとんP: 'ofutonp',
      クロワちゃん: 'kurowa',
      'AI声優-青葉': 'aoba',
      'AI声優-銀芽': 'ginga',
    };

    // マッピングに存在しない場合の処理
    if (SPEAKER_NAME_TO_ID_MAP[speakerName]) {
      return SPEAKER_NAME_TO_ID_MAP[speakerName];
    }

    // 英数字を含む場合のみ変換を試みる
    const converted = speakerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (converted.length === 0) {
      // 空文字列になる場合は、名前をローマ字風に変換（簡易的な処理）
      console.warn(`未登録の音声名: ${speakerName} - デフォルトIDを生成します`);
      return 'unknown_' + Date.now().toString(36);
    }

    return converted;
  }
}

/**
 * シングルトンインスタンス
 * プロジェクト全体で共有されるSpeakerプロバイダ
 */
let globalSpeakerProvider: SpeakerProvider | null = null;

/**
 * グローバルSpeakerプロバイダを取得
 * 設定ファイルから接続情報を読み込んで初期化
 */
export function getSpeakerProvider(connectionConfig?: Partial<ConnectionConfig>): SpeakerProvider {
  if (!globalSpeakerProvider || connectionConfig) {
    globalSpeakerProvider = new SpeakerProvider(connectionConfig);
  }
  return globalSpeakerProvider;
}

/**
 * Speakerプロバイダをリセット（テスト用）
 */
export function resetSpeakerProvider(): void {
  globalSpeakerProvider = null;
}
