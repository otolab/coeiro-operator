/**
 * src/core/say/audio-stream-controller.ts: 音声ストリーム制御
 * 並行生成と順序再生の協調制御を担当
 */

import { logger } from '@coeiro-operator/common';
import { ChunkGenerationManager, GenerationOptions, toSpeakSettings } from './chunk-generation-manager.js';
import type { Chunk, AudioResult, VoiceConfig } from './types.js';

export interface StreamControllerOptions extends GenerationOptions {
  bufferAheadCount: number; // 先読みチャンク数（デフォルト: 1）
}

/**
 * 音声ストリーム制御クラス
 * 生成と再生の協調制御を行い、並行生成とシリアル再生を実現
 */
export class AudioStreamController {
  private generationManager: ChunkGenerationManager;
  private options: StreamControllerOptions;
  private synthesizeFunction: (
    chunk: Chunk,
    voiceConfig: VoiceConfig,
    speed: number
  ) => Promise<AudioResult>;

  constructor(
    synthesizeFunction: (
      chunk: Chunk,
      voiceConfig: VoiceConfig,
      speed: number
    ) => Promise<AudioResult>,
    options: Partial<StreamControllerOptions> = {}
  ) {
    this.synthesizeFunction = synthesizeFunction;
    this.options = {
      maxConcurrency: 2, // 1=逐次、2以上=並行、デフォルト: 2
      delayBetweenRequests: 50,
      bufferAheadCount: 1,
      pauseUntilFirstComplete: true, // デフォルトで初回ポーズを有効化
      ...options,
    };

    this.generationManager = new ChunkGenerationManager(synthesizeFunction, {
      maxConcurrency: this.options.maxConcurrency,
      delayBetweenRequests: this.options.delayBetweenRequests,
      pauseUntilFirstComplete: this.options.pauseUntilFirstComplete,
    });
  }

  /**
   * 並行生成対応の音声合成ジェネレータ
   */
  async *synthesizeStream(
    chunks: Chunk[],
    voiceConfig: VoiceConfig,
    speed: number
  ): AsyncGenerator<AudioResult> {
    const mode = this.options.maxConcurrency === 1 ? '逐次' : '並行';
    logger.debug(`${mode}生成モードで音声合成開始 (maxConcurrency=${this.options.maxConcurrency})`);

    if (chunks.length === 0) {
      return;
    }

    // SpeakSettings変換
    const speakSettings = toSpeakSettings(voiceConfig, speed);

    // 新しいgenerate()メソッドを使用（シンプル）
    for await (const result of this.generationManager.generate(chunks, speakSettings)) {
      if (result.success) {
        logger.debug(`${mode}生成: チャンク${result.data.chunk.index}結果取得`);
        yield result.data;
      } else {
        // エラー発生：ログ出力して再throw
        logger.error(`${mode}生成エラー: チャンク${result.chunkIndex} - ${result.error.message}`);
        throw result.error;
      }
    }

    logger.debug(`${mode}生成モード完了`);
  }

  /**
   * 並行生成の有効/無効を切り替え（maxConcurrencyで制御）
   */
  setParallelGenerationEnabled(enabled: boolean): void {
    this.options.maxConcurrency = enabled ? 2 : 1;
    logger.info(
      `並行生成モード: ${enabled ? '有効 (maxConcurrency=2)' : '無効 (maxConcurrency=1)'}`
    );
  }

  /**
   * 並行生成オプションを更新
   */
  updateOptions(options: Partial<StreamControllerOptions>): void {
    this.options = { ...this.options, ...options };

    // GenerationManagerのオプションも更新
    this.generationManager = new ChunkGenerationManager(this.synthesizeFunction, {
      maxConcurrency: this.options.maxConcurrency,
      delayBetweenRequests: this.options.delayBetweenRequests,
      pauseUntilFirstComplete: this.options.pauseUntilFirstComplete,
    });

    logger.debug('AudioStreamController オプション更新', this.options);
  }

  /**
   * 現在の設定を取得
   */
  getOptions(): StreamControllerOptions {
    return { ...this.options };
  }

  /**
   * 生成統計情報を取得
   */
  getGenerationStats() {
    return this.generationManager.getStats();
  }

  /**
   * すべての生成タスクをクリア
   */
  async clear(): Promise<void> {
    await this.generationManager.clear();
  }
}
