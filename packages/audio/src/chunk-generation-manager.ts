/**
 * src/core/say/chunk-generation-manager.ts: 並行チャンク生成管理
 * 複数チャンクの生成を並行して行い、完成順序ではなく論理順序で管理
 */

import { logger } from '@coeiro-operator/common';
import type { Chunk, AudioResult, VoiceConfig } from './types.js';

export interface GenerationTask {
  chunk: Chunk;
  voiceConfig: VoiceConfig;
  speed: number;
  startTime: number;
  promise: Promise<AudioResult>;
}

export interface GenerationOptions {
  maxConcurrency: number; // 最大並行生成数（デフォルト: 2）
  delayBetweenRequests: number; // リクエスト間隔（ms、デフォルト: 50ms）
  pauseUntilFirstComplete: boolean; // 初回チャンク完了まで並行生成をポーズ（デフォルト: false）
}

/**
 * チャンク生成の並行制御管理クラス
 */
export class ChunkGenerationManager {
  private activeTasks: Map<number, GenerationTask> = new Map();
  private completedResults: Map<number, AudioResult> = new Map();
  private failedTasks: Map<number, Error> = new Map(); // 失敗したタスクのエラーを保存
  private options: GenerationOptions;
  private synthesizeFunction: (
    chunk: Chunk,
    voiceConfig: VoiceConfig,
    speed: number
  ) => Promise<AudioResult>;
  private firstChunkCompleted: boolean = false; // 初回チャンク完了フラグ

  constructor(
    synthesizeFunction: (
      chunk: Chunk,
      voiceConfig: VoiceConfig,
      speed: number
    ) => Promise<AudioResult>,
    options: Partial<GenerationOptions> = {}
  ) {
    this.synthesizeFunction = synthesizeFunction;
    this.options = {
      maxConcurrency: 2,
      delayBetweenRequests: 100, // 間隔を増加して安定性向上
      pauseUntilFirstComplete: true, // デフォルトで初回ポーズを有効化
      ...options,
    };
  }

  /**
   * チャンクの生成を開始（並行制御あり）
   */
  async startGeneration(chunk: Chunk, voiceConfig: VoiceConfig, speed: number): Promise<void> {
    // 初回ポーズ機能: 初回チャンク完了まで後続チャンクの生成を待機
    if (this.options.pauseUntilFirstComplete && chunk.index > 0 && !this.firstChunkCompleted) {
      logger.debug(`チャンク${chunk.index}: 初回チャンク完了まで生成をポーズ`);
      await this.waitForFirstChunkCompletion();
    }

    // 並行数制限のチェック
    while (this.activeTasks.size >= this.options.maxConcurrency) {
      await this.waitForAnyTaskCompletion();
    }

    // 新しい生成タスクを開始
    // Promise コンストラクタで明示的にエラーをキャッチ
    logger.debug(`[ChunkGen] チャンク${chunk.index}: synthesizeFunction呼び出し開始`);

    const handledPromise = new Promise<AudioResult | undefined>((resolve, reject) => {
      // synthesizeFunctionを呼び出し、その結果を処理
      this.synthesizeFunction(chunk, voiceConfig, speed)
        .then((result: AudioResult) => {
          logger.debug(`[ChunkGen] チャンク${chunk.index}: 生成成功`);
          this.onTaskCompleted(chunk.index, result);
          resolve(result);
        })
        .catch((error: Error) => {
          logger.debug(`[ChunkGen] チャンク${chunk.index}: エラーキャッチ - ${error.message}`);
          this.onTaskFailed(chunk.index, error);
          // エラーを失敗として処理し、undefinedを返す
          resolve(undefined);
        });
    });

    logger.debug(`[ChunkGen] チャンク${chunk.index}: Promiseハンドラー設定完了`);

    const task: GenerationTask = {
      chunk,
      voiceConfig,
      speed,
      startTime: Date.now(),
      promise: handledPromise as Promise<AudioResult>,
    };

    this.activeTasks.set(chunk.index, task);
    logger.debug(
      `チャンク${chunk.index}の生成開始 (並行数: ${this.activeTasks.size}, 初回完了: ${this.firstChunkCompleted})`
    );

    // リクエスト間隔の調整
    if (this.options.delayBetweenRequests > 0) {
      await this.delay(this.options.delayBetweenRequests);
    }
  }

  /**
   * 指定されたチャンクの生成結果を取得（完了まで待機）
   */
  async getResult(chunkIndex: number): Promise<AudioResult> {
    // 既に失敗している場合はエラーを再スロー
    if (this.failedTasks.has(chunkIndex)) {
      const error = this.failedTasks.get(chunkIndex)!;
      this.failedTasks.delete(chunkIndex); // 取得後はクリア
      throw error;
    }

    // 既に完了している場合
    if (this.completedResults.has(chunkIndex)) {
      const result = this.completedResults.get(chunkIndex)!;
      this.completedResults.delete(chunkIndex); // 取得後はクリア
      return result;
    }

    // 生成中の場合は完了を待機
    const activeTask = this.activeTasks.get(chunkIndex);
    if (activeTask) {
      const result = await activeTask.promise;

      // undefinedの場合はエラーが発生している
      if (result === undefined) {
        if (this.failedTasks.has(chunkIndex)) {
          const savedError = this.failedTasks.get(chunkIndex)!;
          this.failedTasks.delete(chunkIndex);
          throw savedError;
        }
        throw new Error(`チャンク${chunkIndex}の生成に失敗しました`);
      }

      return result;
    }

    throw new Error(`チャンク${chunkIndex}の生成タスクが見つかりません`);
  }

  /**
   * 指定されたチャンクが生成完了しているかチェック
   */
  isCompleted(chunkIndex: number): boolean {
    return this.completedResults.has(chunkIndex);
  }

  /**
   * 指定されたチャンクが生成中かチェック
   */
  isInProgress(chunkIndex: number): boolean {
    return this.activeTasks.has(chunkIndex);
  }

  /**
   * 現在の並行生成数を取得
   */
  getActiveConcurrency(): number {
    return this.activeTasks.size;
  }

  /**
   * 完了待ちの結果数を取得
   */
  getPendingResultsCount(): number {
    return this.completedResults.size;
  }

  /**
   * すべてのタスクの完了を待機
   */
  async waitForAllTasks(): Promise<void> {
    const promises = Array.from(this.activeTasks.values()).map(task =>
      // エラーをキャッチして無視（onTaskFailedで処理済み）
      task.promise.catch(() => {})
    );
    await Promise.all(promises);
  }

  /**
   * すべてのタスクをクリア
   */
  async clear(): Promise<void> {
    // 実行中のタスクがある場合は、すべて完了を待つ（エラーは無視）
    if (this.activeTasks.size > 0) {
      const promises = Array.from(this.activeTasks.values()).map(task =>
        task.promise.catch(() => {}) // エラーを無視
      );
      await Promise.allSettled(promises); // すべて完了まで待つ
    }

    this.activeTasks.clear();
    this.completedResults.clear();
    this.failedTasks.clear(); // 失敗タスクもクリア
    this.firstChunkCompleted = false; // 初回完了フラグもリセット
  }

  /**
   * 生成統計情報を取得
   */
  getStats(): {
    activeTasks: number;
    completedResults: number;
    totalMemoryUsage: number;
  } {
    let totalMemoryUsage = 0;
    for (const result of this.completedResults.values()) {
      totalMemoryUsage += result.audioBuffer.byteLength;
    }

    return {
      activeTasks: this.activeTasks.size,
      completedResults: this.completedResults.size,
      totalMemoryUsage,
    };
  }

  private async waitForAnyTaskCompletion(): Promise<void> {
    if (this.activeTasks.size === 0) {
      return;
    }

    const promises = Array.from(this.activeTasks.values()).map(task =>
      // エラーをキャッチして無視（onTaskFailedで処理済み）
      task.promise.catch(() => {})
    );
    await Promise.race(promises);
  }

  /**
   * 初回チャンク（チャンク0）の完了を待機
   */
  private async waitForFirstChunkCompletion(): Promise<void> {
    // 既に完了している場合は即座に返す
    if (this.firstChunkCompleted) {
      return;
    }

    // チャンク0のタスクが存在する場合は完了を待機
    const firstTask = this.activeTasks.get(0);
    if (firstTask) {
      try {
        await firstTask.promise;
      } catch {
        // エラーは既にonTaskFailedで処理されるので無視
      }
    }

    // ポーリングによる確認（安全のため）
    while (!this.firstChunkCompleted) {
      await this.delay(10); // 10ms間隔でチェック
    }
  }

  private onTaskCompleted(chunkIndex: number, result: AudioResult): void {
    const task = this.activeTasks.get(chunkIndex);
    if (task) {
      const duration = Date.now() - task.startTime;
      logger.debug(`チャンク${chunkIndex}生成完了 (所要時間: ${duration}ms)`);

      this.activeTasks.delete(chunkIndex);
      this.completedResults.set(chunkIndex, result);

      // 初回チャンク完了フラグの設定
      if (chunkIndex === 0 && !this.firstChunkCompleted) {
        this.firstChunkCompleted = true;
        logger.debug('初回チャンク完了: 並行生成ポーズを解除');
      }
    }
  }

  private onTaskFailed(chunkIndex: number, error: Error): void {
    logger.error(`チャンク${chunkIndex}生成失敗: ${error.message}`);
    this.activeTasks.delete(chunkIndex);
    // エラーを保存して、getResultで再スローできるようにする
    this.failedTasks.set(chunkIndex, error);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
