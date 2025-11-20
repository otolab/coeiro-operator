/**
 * index-new.ts: 簡素化されたSayCoeiroinkクラス
 * 音声合成ライブラリのファサード
 */

import { OperatorManager, ConfigManager, CharacterInfoService } from '@coeiro-operator/core';
import { SpeechQueue } from './speech-queue.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { SynthesisProcessor } from './synthesis-processor.js';
import { logger } from '@coeiro-operator/common';
import { convertToSpeed, validateSpeedParameters } from './speed-utils.js';
import type {
  Config,
  SpeechTask,
  SynthesizeOptions,
  SynthesizeResult,
  CLISynthesizeOptions,
  SpeakSettings,
  ProcessingOptions,
} from './types.js';
import type { Character } from '@coeiro-operator/core';
import type { StreamControllerOptions } from './audio-stream-controller.js';

export class SayCoeiroink {
  private configManager: ConfigManager;
  private config: Config;
  private operatorManager: OperatorManager;
  private characterInfoService: CharacterInfoService;
  private speechQueue: SpeechQueue | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private audioSynthesizer: AudioSynthesizer | null = null;
  private synthesisProcessor: SynthesisProcessor | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.config = {} as Config;

    // CharacterInfoServiceを初期化
    this.characterInfoService = new CharacterInfoService();
    this.characterInfoService.initialize(configManager);

    // OperatorManagerを初期化（DI）
    this.operatorManager = new OperatorManager(configManager, this.characterInfoService);
  }

  async initialize(): Promise<void> {
    try {
      // ConfigManagerから完全な設定を取得
      this.config = await this.configManager.getFullConfig();

      // 基本コンポーネントを初期化
      this.audioPlayer = new AudioPlayer(this.config);
      this.audioSynthesizer = new AudioSynthesizer(this.config);

      // 音声合成処理を初期化
      this.synthesisProcessor = new SynthesisProcessor(
        this.config,
        this.audioPlayer,
        this.audioSynthesizer
      );

      // SpeechQueueを初期化
      this.speechQueue = new SpeechQueue(
        async (task: SpeechTask) => {
          // CLISynthesizeOptions → SpeakSettings + ProcessingOptionsに変換
          const { speakSettings, processingOptions } = await this.resolveCharacterOptions(task.options);
          await this.synthesisProcessor!.process(task.text, speakSettings, processingOptions);
        }
      );

      await this.operatorManager.initialize();
    } catch (err) {
      throw new Error(`SayCoeiroink initialization failed: ${(err as Error).message}`);
    }
  }

  async buildDynamicConfig(): Promise<void> {
    try {
      await this.configManager.buildDynamicConfig();
      await this.operatorManager.buildDynamicConfig();
      // 設定を再取得して更新
      this.config = await this.configManager.getFullConfig();

      // 依存コンポーネントも更新
      if (this.synthesisProcessor) {
        (this.synthesisProcessor as any).config = this.config;
      }
    } catch (err) {
      throw new Error(`buildDynamicConfig failed: ${(err as Error).message}`);
    }
  }

  // ========================================================================
  // 内部ヘルパーメソッド
  // ========================================================================

  /**
   * CLISynthesizeOptionsをSpeakSettings + ProcessingOptionsに変換
   * voice文字列→Character解決、style文字列→styleId解決、rate/factor→speed計算
   */
  private async resolveCharacterOptions(
    options: CLISynthesizeOptions
  ): Promise<{ speakSettings: SpeakSettings; processingOptions: ProcessingOptions }> {
    // Characterを解決
    let character: Character;
    const allowFallback = options.allowFallback ?? true;

    if (!options.voice) {
      // voiceが未指定 → Operator経由でアサイン、なければデフォルトキャラクター
      const session = await this.operatorManager.getCurrentOperatorSession();
      if (!session) {
        // オペレータアサインなし → デフォルトキャラクターを使用（最初に見つかるキャラクター）
        const availableCharacterIds = await this.characterInfoService.getAvailableCharacterIds();
        if (availableCharacterIds.length === 0) {
          throw new Error('No characters configured. Please configure at least one character.');
        }
        const defaultCharacterId = availableCharacterIds[0];
        const defaultCharacter = await this.characterInfoService.getCharacterInfo(defaultCharacterId);
        if (!defaultCharacter) {
          throw new Error(`Default character not found: ${defaultCharacterId}`);
        }
        character = defaultCharacter;
        logger.debug(`Using default character: ${character.characterId}`);
      } else {
        const assignedCharacter = await this.characterInfoService.getCharacterInfo(session.characterId);
        if (!assignedCharacter) {
          throw new Error(`Assigned character not found: ${session.characterId}`);
        }
        character = assignedCharacter;
        logger.debug(`Character assigned: ${character.characterId}`);
      }
    } else {
      // voiceが指定済み → CharacterInfoServiceから取得
      const resolvedCharacter = await this.characterInfoService.getCharacterInfo(options.voice);
      if (!resolvedCharacter) {
        if (allowFallback) {
          logger.warn(`Character not found: ${options.voice}, falling back to assignment`);
          const session = await this.operatorManager.getCurrentOperatorSession();
          if (!session) {
            throw new Error('No operator assigned and character not found.');
          }
          const assignedCharacter = await this.characterInfoService.getCharacterInfo(session.characterId);
          if (!assignedCharacter) {
            throw new Error(`Assigned character not found: ${session.characterId}`);
          }
          character = assignedCharacter;
        } else {
          throw new Error(`Character not found: ${options.voice}`);
        }
      } else {
        character = resolvedCharacter;
      }
    }

    // selectedStyleIdを解決
    let selectedStyleId = character.defaultStyleId;
    if (options.style) {
      // style名からstyleIdを検索
      const styleEntry = Object.entries(character.styles).find(
        ([_, styleConfig]) => styleConfig.styleName === options.style
      );
      if (styleEntry) {
        selectedStyleId = parseInt(styleEntry[0]);
      } else {
        logger.warn(`Style not found: ${options.style}, using default style`);
      }
    }

    const styleConfig = character.styles[selectedStyleId];
    if (!styleConfig) {
      throw new Error(`Style ${selectedStyleId} not found for character ${character.characterId}`);
    }

    // speed計算
    const speedSpec = {
      rate: typeof options.rate === 'number' ? options.rate : undefined,
      factor: options.factor
    };
    validateSpeedParameters(speedSpec);
    const speed = convertToSpeed(speedSpec, {
      styleMorasPerSecond: styleConfig.morasPerSecond
    });

    // SpeakSettings作成
    const speakSettings: SpeakSettings = {
      characterId: character.characterId,
      speakerId: character.speakerId,
      styleId: selectedStyleId,
      speed,
      styleMorasPerSecond: styleConfig.morasPerSecond,
    };

    // ProcessingOptions作成
    const processingOptions: ProcessingOptions = {
      outputFile: options.outputFile,
      chunkMode: options.chunkMode,
      bufferSize: options.bufferSize,
    };

    logger.debug('SpeakSettings作成完了:', speakSettings);
    logger.debug('ProcessingOptions作成完了:', processingOptions);

    return { speakSettings, processingOptions };
  }

  // ========================================================================
  // 主要API
  // ========================================================================

  /**
   * オーディオドライバーのウォームアップ
   */
  async warmup(): Promise<void> {
    if (!this.audioPlayer) {
      throw new Error('AudioPlayer is not initialized. Call initialize() first.');
    }
    await this.audioPlayer.warmupAudioDriver();
  }

  /**
   * 音声合成タスクをキューに追加
   */
  synthesize(text: string, options: SynthesizeOptions = {}): SynthesizeResult {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }
    return this.speechQueue.enqueueSpeech(text, options);
  }

  /**
   * キューに入っているすべてのタスクの完了を待つ
   * エラーが発生した場合は最初のエラーを投げる
   */
  async waitCompletion(): Promise<void> {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }
    const result = await this.speechQueue.waitForAllTasks();

    // エラーがある場合は最初のエラーを投げる
    if (result.errors.length > 0) {
      const firstError = result.errors[0];
      logger.warn(`音声処理中に${result.errors.length}件のエラーが発生しました`);
      throw firstError.error;
    }
  }

  /**
   * キューが指定された長さになるまで待機（イベントベース）
   * @param targetLength 待機解除するキュー長（デフォルト0 = 完全に空になるまで待機）
   * エラーが発生した場合は最初のエラーを投げる
   */
  async waitForQueueLength(targetLength: number = 0): Promise<void> {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }
    const result = await this.speechQueue.waitForQueueLength(targetLength);

    // エラーがある場合は最初のエラーを投げる
    if (result.errors.length > 0) {
      const firstError = result.errors[0];
      logger.warn(`音声処理中に${result.errors.length}件のエラーが発生しました`);
      throw firstError.error;
    }
  }

  // ========================================================================
  // ユーティリティメソッド
  // ========================================================================

  /**
   * 利用可能な音声をリスト表示
   */
  async listVoices(): Promise<void> {
    if (!this.audioSynthesizer) {
      throw new Error('AudioSynthesizer is not initialized. Call initialize() first.');
    }
    await this.audioSynthesizer.listVoices();
  }

  /**
   * キューの状態を取得
   */
  getSpeechQueueStatus() {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }
    return this.speechQueue.getStatus();
  }

  /**
   * キューをクリア
   * @param taskIds 削除するタスクIDの配列（省略時は全タスク削除）
   * @returns 削除されたタスク数
   */
  async clearSpeechQueue(taskIds?: number[]): Promise<{ removedCount: number }> {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }

    // 全タスククリアまたはタスクが残らない場合は再生も停止
    if (!taskIds || taskIds.length === 0) {
      // 全タスククリアの場合は再生も停止
      if (this.audioPlayer) {
        this.audioPlayer.stopPlayback();
      }
    }

    return await this.speechQueue.clear(taskIds);
  }

  /**
   * clearQueue エイリアス（テスト用）
   * clearSpeechQueue と同じ動作
   */
  async clearQueue(): Promise<{ removedCount: number }> {
    return await this.clearSpeechQueue();
  }

  /**
   * 音声再生を停止（チャンク境界で停止）
   * 現在再生中のチャンクは最後まで再生され、次のチャンクから停止します
   */
  stopPlayback(): void {
    if (!this.audioPlayer) {
      throw new Error('AudioPlayer is not initialized. Call initialize() first.');
    }
    this.audioPlayer.stopPlayback();
  }

  // ========================================================================
  // 並行生成制御
  // ========================================================================

  /**
   * 並行生成の有効/無効を設定
   */
  setParallelGenerationEnabled(enabled: boolean): void {
    if (!this.audioSynthesizer) {
      throw new Error('AudioSynthesizer is not initialized. Call initialize() first.');
    }
    this.audioSynthesizer.setParallelGenerationEnabled(enabled);
    logger.info(`並行生成設定変更: ${enabled ? '有効' : '無効'}`);
  }

  /**
   * AudioStreamControllerのオプションを更新
   */
  updateStreamControllerOptions(options: Partial<StreamControllerOptions>): void {
    if (!this.audioSynthesizer) {
      throw new Error('AudioSynthesizer is not initialized. Call initialize() first.');
    }
    this.audioSynthesizer.updateStreamControllerOptions(options);
    logger.info('AudioStreamController設定更新', options);
  }

  /**
   * 並行生成の統計情報を取得
   */
  getGenerationStats() {
    if (!this.audioSynthesizer) {
      throw new Error('AudioSynthesizer is not initialized. Call initialize() first.');
    }
    return this.audioSynthesizer.getGenerationStats();
  }

  /**
   * ストリーム制御オプションを取得
   */
  getStreamControllerOptions() {
    if (!this.audioSynthesizer) {
      throw new Error('AudioSynthesizer is not initialized. Call initialize() first.');
    }
    return this.audioSynthesizer.getStreamControllerOptions();
  }

  // ========================================================================
  // リソース管理
  // ========================================================================

  /**
   * リソースのクリーンアップ
   */
  async cleanup(): Promise<void> {
    logger.debug('SayCoeiroink cleanup開始');

    try {
      if (this.speechQueue) {
        await this.speechQueue.clear(); // 全タスククリア
      }

      if (this.audioPlayer) {
        await this.audioPlayer.cleanup();
      }

      logger.info('SayCoeiroink cleanup完了');
    } catch (error) {
      logger.warn(`SayCoeiroink cleanup warning: ${(error as Error).message}`);
    }
  }
}

// デフォルトエクスポート
export default SayCoeiroink;

// 型と定数のエクスポート
export type { Config, SynthesizeResult, SynthesizeOptions } from './types.js';
export { BUFFER_SIZES } from './constants.js';