/**
 * COEIROINK ユーザー辞書永続化機能
 *
 * 登録した辞書データを永続化し、次回起動時に自動的に復元する
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { DictionaryWord } from './dictionary-client.js';

/**
 * 永続化辞書データ
 */
export interface PersistentDictionary {
  /** 辞書のバージョン */
  version: string;
  /** 最終更新日時 */
  lastUpdated: string;
  /** カスタム単語リスト */
  customWords: DictionaryWord[];
  /** デフォルト辞書を含めるか */
  includeDefaults: boolean;
}

/**
 * 辞書永続化マネージャー
 */
export class DictionaryPersistenceManager {
  private readonly configDir: string;
  private readonly dictionaryFile: string;

  constructor() {
    // ~/.coeiro-operator ディレクトリを使用
    this.configDir = path.join(os.homedir(), '.coeiro-operator');
    this.dictionaryFile = path.join(this.configDir, 'user-dictionary.json');

    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 辞書データを保存
   */
  async save(words: DictionaryWord[], includeDefaults: boolean = true): Promise<void> {
    const data: PersistentDictionary = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      customWords: words,
      includeDefaults,
    };

    try {
      await fs.promises.writeFile(this.dictionaryFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`辞書データの保存に失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 辞書データを読み込み
   */
  async load(): Promise<PersistentDictionary | null> {
    if (!fs.existsSync(this.dictionaryFile)) {
      return null;
    }

    try {
      const content = await fs.promises.readFile(this.dictionaryFile, 'utf8');
      const data = JSON.parse(content) as PersistentDictionary;

      // バージョンチェック（将来の拡張用）
      if (!data.version) {
        throw new Error('辞書データのバージョンが不明です');
      }

      return data;
    } catch (error) {
      throw new Error(`辞書データの読み込みに失敗しました: ${(error as Error).message}`);
    }
  }

  /**
   * 辞書データを削除
   */
  async clear(): Promise<void> {
    if (fs.existsSync(this.dictionaryFile)) {
      await fs.promises.unlink(this.dictionaryFile);
    }
  }

  /**
   * 辞書データが存在するか確認
   */
  exists(): boolean {
    return fs.existsSync(this.dictionaryFile);
  }

  /**
   * 辞書データのパスを取得
   */
  getFilePath(): string {
    return this.dictionaryFile;
  }
}
