/**
 * src/operator/config-manager.ts: 設定管理システム
 * 動的音声フォント取得、設定マージ、キャッシュ管理を担当
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import {
  BUILTIN_CHARACTER_CONFIGS,
  BaseCharacterConfig,
  CharacterConfig,
} from './character-defaults.js';
import { getSpeakerProvider } from '../environment/speaker-provider.js';
import { AudioConfig, FullConfig as BaseFullConfig, OperatorConfig } from '../types.js';
import { deepMerge } from '@coeiro-operator/common';

// FullConfig型の定義（BaseFullConfigを拡張）
export interface FullConfig extends Omit<BaseFullConfig, 'characters'> {
  characters: Record<string, BaseCharacterConfig | CharacterConfig>;
}

// ターミナル背景設定の型定義
export interface TerminalBackgroundConfig {
  enabled: boolean;
  backgroundImages?: {
    [characterId: string]: string; // キャラクターIDごとの背景画像パス
  };
  operatorImage?: {
    display: 'api' | 'file' | 'none'; // API取得/ファイル指定/表示なし
    position: 'top-right' | 'bottom-right'; // 表示位置
    opacity: number; // 透明度 (0.0 - 1.0)
    filePath?: string; // display: 'file'の場合のパス
  };
}

// 完全な設定の型定義
interface Config {
  connection: {
    host: string;
    port: string;
  };
  audio: AudioConfig;
  operator: {
    timeout: number;
    assignmentStrategy: 'random';
  };
  terminal: {
    background: TerminalBackgroundConfig;
  };
  characters: Record<
    string,
    Partial<BaseCharacterConfig> & { speakerId?: string; disabled?: boolean }
  >;
}

// ユーザー設定の型定義（すべてオプショナル）
type UserConfig = Partial<Config>;

// デフォルト設定の定義（必須フィールドのみ）
const DEFAULT_CONFIG = {
  connection: {
    host: 'localhost',
    port: '50032',
  },
  operator: {
    // rate未指定 = 話者固有速度を使用
    timeout: 14400000, // 4時間
    assignmentStrategy: 'random' as const,
  },
  terminal: {
    background: {
      enabled: true,
      operatorImage: {
        display: 'api' as const,
        position: 'bottom-right' as const,
        opacity: 0.3,
      },
    },
  },
  // audio と characters はオプショナルなので、実装で必要に応じて設定
} as const;

interface MergedConfig {
  characters: Record<string, CharacterConfig>;
  operatorTimeout: number;
  characterSettings: {
    assignmentStrategy: 'random';
  };
}

export class ConfigManager {
  private configDir: string;
  private configFile: string;
  private mergedConfig: MergedConfig | null = null;
  private speakerProvider = getSpeakerProvider();

  constructor(configDir: string) {
    this.configDir = configDir;
    this.configFile = join(configDir, 'config.json');
  }

  /**
   * JSONファイルを安全に読み込み
   */
  async readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * JSONファイルを安全に書き込み
   */
  async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    const tempFile = `${filePath}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');

    try {
      const fs = await import('fs');
      await fs.promises.rename(tempFile, filePath);
    } catch (error) {
      console.error(`設定ファイル書き込みエラー: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * 統一設定ファイルを読み込み
   */
  async loadConfig(): Promise<UserConfig> {
    return await this.readJsonFile<UserConfig>(this.configFile, {});
  }

  /**
   * 接続設定を更新して音声プロバイダを再設定
   */
  private async updateVoiceProviderConnection(): Promise<void> {
    try {
      const connectionConfig = await this.getConnectionConfig();
      this.speakerProvider.updateConnection(connectionConfig);
    } catch (error) {
      console.error(`接続設定更新エラー: ${(error as Error).message}`);
    }
  }

  /**
   * 動的設定を構築してマージ
   */
  async buildDynamicConfig(): Promise<void> {
    await this.updateVoiceProviderConnection();

    const config = await this.loadConfig();

    try {
      const speakers = await this.speakerProvider.getSpeakers();
      const dynamicCharacters: Record<string, CharacterConfig> = {};

      // speakersがundefinedまたは配列でない場合は空の配列として扱う
      const availableSpeakers = Array.isArray(speakers) ? speakers : [];

      for (const [characterId, builtinConfig] of Object.entries(BUILTIN_CHARACTER_CONFIGS)) {
        // speakerIdでCOEIROINKのSpeakerとマッチング
        const speaker = availableSpeakers.find(s => s.speakerUuid === builtinConfig.speakerId);
        if (!speaker) continue; // 利用可能なspeakerがない場合はスキップ

        // ユーザー設定はcharacterIdで管理
        const userCharacterConfig = config.characters?.[characterId] || {};

        if (userCharacterConfig.disabled) continue;

        // 利用可能なスタイル一覧を追加
        const availableStyles = speaker.styles?.map(s => s.styleName) || [];

        dynamicCharacters[characterId] = {
          ...builtinConfig,
          availableStyles,
          ...userCharacterConfig,
        };
      }

      const operatorConfig = await this.getOperatorConfig();
      this.mergedConfig = {
        characters: dynamicCharacters,
        operatorTimeout: operatorConfig.timeout,
        characterSettings: {
          assignmentStrategy: operatorConfig.assignmentStrategy,
        },
      };
    } catch (error) {
      console.error(`動的設定構築エラー:`, error);

      // サーバーから取得できなかった場合は空の設定を使用
      const staticCharacters: Record<string, CharacterConfig> = {};

      this.mergedConfig = {
        characters: staticCharacters,
        operatorTimeout: config.operator?.timeout || 14400000,
        characterSettings: {
          assignmentStrategy: config.operator?.assignmentStrategy || 'random',
        },
      };
    }
  }

  /**
   * マージ済み設定を取得
   */
  getMergedConfig(): MergedConfig | null {
    return this.mergedConfig;
  }

  /**
   * キャラクター設定を取得
   */
  async getCharacterConfig(characterId: string): Promise<CharacterConfig | null> {
    if (!this.mergedConfig) {
      await this.buildDynamicConfig();
    }
    return this.mergedConfig?.characters[characterId] || null;
  }

  /**
   * 利用可能なキャラクターIDを取得
   */
  async getAvailableCharacterIds(): Promise<string[]> {
    if (!this.mergedConfig) {
      await this.buildDynamicConfig();
    }
    return Object.keys(this.mergedConfig?.characters || {});
  }

  /**
   * オペレータのタイムアウト時間を取得
   */
  async getOperatorTimeout(): Promise<number> {
    const operatorConfig = await this.getOperatorConfig();
    return operatorConfig.timeout;
  }

  /**
   * 設定ディレクトリの存在確認と作成
   */
  async ensureConfigDir(): Promise<void> {
    try {
      await mkdir(this.configDir, { recursive: true });
    } catch (error) {
      console.error(`設定ディレクトリ作成エラー: ${(error as Error).message}`);
    }
  }

  /**
   * デフォルト話速（rate）を取得
   * 設定ファイルのaudio.defaultRateから読み込み
   */
  async getDefaultRate(): Promise<number | undefined> {
    const audioConfig = await this.getAudioConfig();
    return audioConfig.defaultRate;
  }

  /**
   * ターミナル背景設定を取得
   */
  async getTerminalBackgroundConfig(): Promise<TerminalBackgroundConfig> {
    const config = await this.loadConfig();
    return deepMerge(DEFAULT_CONFIG.terminal.background, config.terminal?.background);
  }

  /**
   * 接続設定を取得
   */
  async getConnectionConfig(): Promise<{ host: string; port: string }> {
    const config = await this.loadConfig();
    return deepMerge(DEFAULT_CONFIG.connection, config.connection);
  }

  /**
   * 音声設定を取得
   */
  async getAudioConfig(): Promise<AudioConfig> {
    const config = await this.loadConfig();
    return config.audio || {};
  }

  /**
   * オペレータ設定を取得
   */
  async getOperatorConfig(): Promise<OperatorConfig> {
    const config = await this.loadConfig();
    return deepMerge(DEFAULT_CONFIG.operator, config.operator);
  }

  /**
   * 完全なConfig型を取得（SayCoeiroink用）
   */
  async getFullConfig(): Promise<FullConfig> {
    if (!this.mergedConfig) {
      await this.buildDynamicConfig();
    }

    return {
      connection: await this.getConnectionConfig(),
      audio: await this.getAudioConfig(),
      operator: await this.getOperatorConfig(),
      characters: this.mergedConfig?.characters || {},
    };
  }
}

export default ConfigManager;
