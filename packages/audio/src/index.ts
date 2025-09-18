/**
 * index-new.ts: 簡素化されたSayCoeiroinkクラス
 * 音声合成ライブラリのファサード
 */

import { OperatorManager, ConfigManager } from '@coeiro-operator/core';
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
    this.operatorManager = new OperatorManager();
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
    return this.speechQueue.enqueue(text, options);
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
   */
  clearSpeechQueue(): void {
    if (!this.speechQueue) {
      throw new Error('SpeechQueue is not initialized. Call initialize() first.');
    }
    this.speechQueue.clear();
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
        this.speechQueue.clear();
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