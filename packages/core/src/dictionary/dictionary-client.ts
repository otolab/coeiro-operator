/**
 * COEIROINK ユーザー辞書API クライアント
 *
 * COEIROINKのユーザー辞書機能にアクセスするための独立したモジュール
 * CLI、MCP、その他のコンポーネントから再利用可能
 */

/**
 * 辞書単語の定義
 */
export interface DictionaryWord {
  /** 登録する単語（全角英数字推奨） */
  word: string;
  /** 読み方（全角カタカナ） */
  yomi: string;
  /** アクセント位置（0:平板型、1以上:該当モーラが高い） */
  accent: number;
  /** モーラ数（音節数） */
  numMoras: number;
}

/**
 * 辞書登録レスポンス
 */
export interface DictionaryResponse {
  /** 登録成功フラグ */
  success: boolean;
  /** エラーメッセージ（エラー時のみ） */
  error?: string;
  /** 登録された単語数 */
  registeredCount?: number;
}

/**
 * COEIROINKサーバー設定
 */
export interface CoeiroinkServerConfig {
  /** ホスト名（デフォルト: localhost） */
  host?: string;
  /** ポート番号（デフォルト: 50032） */
  port?: string | number;
}

/**
 * ユーザー辞書クライアント
 */
export class DictionaryClient {
  private baseUrl: string;

  constructor(config: CoeiroinkServerConfig = {}) {
    const host = config.host || 'localhost';
    const port = config.port || '50032';
    this.baseUrl = `http://${host}:${port}`;
  }

  /**
   * 辞書に単語を登録
   *
   * 注意事項:
   * - 半角英数字は登録できません（全角に変換して登録）
   * - 登録した辞書はCOEIROINK再起動時にリセットされます
   * - 全角で登録すれば半角入力にも適用されます
   *
   * @param words 登録する単語の配列
   * @returns 登録結果
   */
  async registerWords(words: DictionaryWord[]): Promise<DictionaryResponse> {
    try {
      // 半角英数字を全角に変換（API制限対策）
      const convertedWords = words.map(word => ({
        ...word,
        word: this.toFullWidth(word.word),
      }));

      const response = await fetch(`${this.baseUrl}/v1/set_dictionary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dictionaryWords: convertedWords,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // COEIROINKは常にnullを返すが、成功とみなす
      return {
        success: true,
        registeredCount: words.length,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // 接続エラーの詳細メッセージ
      if (message.includes('ECONNREFUSED')) {
        return {
          success: false,
          error: `COEIROINKサーバーに接続できません。サーバーが起動していることを確認してください (${this.baseUrl})`,
        };
      }

      return {
        success: false,
        error: message,
      };
    }
  }

  /**
   * 半角英数字・記号を全角に変換
   * COEIROINKのAPI制限により、半角英数字では辞書登録が効かないため
   *
   * @param str 変換する文字列
   * @returns 全角変換後の文字列
   */
  private toFullWidth(str: string): string {
    return str.replace(/[A-Za-z0-9!-\/:-@\[-`{-~]/g, char => {
      const code = char.charCodeAt(0);
      
      // ASCII文字（0x21-0x7E）は基本的に0xFEE0を加算で全角に変換可能
      // ただし、一部の文字は個別対応が必要
      
      // スペース（0x20）は対象外なのでここでは処理しない
      
      // 特殊な変換が必要な文字
      switch (char) {
        case ' ': return '　';  // 半角スペース → 全角スペース (U+3000)
        case '"': return '"';   // ダブルクォート
        case '\'': return `'`;  // シングルクォート → 右シングル引用符 (U+2019)
        case '\\': return '＼';  // バックスラッシュ
        case '~': return '～';   // チルダ
        default:
          // その他のASCII印字可能文字（! から ~ まで）
          if (code >= 0x21 && code <= 0x7E) {
            return String.fromCharCode(code + 0xFEE0);
          }
          return char;
      }
    });
  }

  /**
   * サーバーの接続確認
   *
   * @returns 接続可能かどうか
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000), // 3秒タイムアウト
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
