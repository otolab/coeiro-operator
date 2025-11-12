/**
 * index-new.ts: 簡素化されたSayCoeiroinkクラス
 * 音声合成ライブラリのファサード
 */

import { OperatorManager, ConfigManager, CharacterInfoService } from '@coeiro-operator/core';
import { SpeechQueue } from './speech-queue.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { VoiceResolver } from './voice-resolver.js';
import { SynthesisProcessor } from './synthesis-processor.js';
import { logger } from '@coeiro-operator/common';
import type {
  Config,
  SpeechTask,
  SynthesizeOptions,
  SynthesizeResult,
} from './types.js';
import type { StreamControllerOptions } from './audio-stream-controller.js';

export class SayCoeiroink {
  private configManager: ConfigManager;
  private config: Config;
  private operatorManager: OperatorManager;
  private speechQueue: SpeechQueue | null = null;
  private audioPlayer: AudioPlayer | null = null;
  private audioSynthesizer: AudioSynthesizer | null = null;
  private voiceResolver: VoiceResolver | null = null;
  private synthesisProcessor: SynthesisProcessor | null = null;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    this.config = {} as Config;

    // CharacterInfoServiceを初期化
    const characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(configManager);

    // OperatorManagerを初期化（DI）
    this.operatorManager = new OperatorManager(configManager, characterInfoService);
  }

  async initialize(): Promise<void> {
    try {
      // ConfigManagerから完全な設定を取得
      this.config = await this.configManager.getFullConfig();

      // 基本コンポーネントを初期化
      this.audioPlayer = new AudioPlayer(this.config);
      this.audioSynthesizer = new AudioSynthesizer(this.config);

      // 音声解決と合成処理を初期化
      this.voiceResolver = new VoiceResolver(
        this.configManager,
        this.operatorManager,
        this.audioSynthesizer
      );

      this.synthesisProcessor = new SynthesisProcessor(
        this.config,
        this.audioPlayer,
        this.audioSynthesizer,
        this.voiceResolver
      );

      // SpeechQueueを初期化
      this.speechQueue = new SpeechQueue(
        async (task: SpeechTask) => {
          await this.synthesisProcessor!.process(task.text, task.options);
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