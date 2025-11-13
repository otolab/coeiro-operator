/**
 * src/core/say/chunk-generation-manager.ts: 並行チャンク生成管理
 * 複数チャンクの生成を並行して行い、完成順序ではなく論理順序で管理
 */

import { logger } from '@coeiro-operator/common';
import type { Chunk, AudioResult, SpeakSettings } from './types.js';

export interface GenerationTask {
  chunk: Chunk;
  speakSettings: SpeakSettings;
  startTime: number;
  promise: Promise<AudioResult>;
}

/** OpenPromiseパターン用のタスク */
interface OpenPromiseTask {
  promise: Promise<AudioResult>;
  resolve: (result: AudioResult) => void;
  reject: (error: Error) => void;
  startTime: number;
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
    speakSettings: SpeakSettings
  ) => Promise<AudioResult>;
  private firstChunkCompleted: boolean = false; // 初回チャンク完了フラグ

  // 新しいgenerate()メソッド用のフィールド
  private newActiveTasks: Map<number, OpenPromiseTask> = new Map();
  private errorOccurred: boolean = false;
  private firstError: Error | null = null;

  constructor(
    synthesizeFunction: (
      chunk: Chunk,
      speakSettings: SpeakSettings
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
  async startGeneration(chunk: Chunk, speakSettings: SpeakSettings): Promise<void> {
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
      this.synthesizeFunction(chunk, speakSettings)
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
      speakSettings,
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

  /**
   * 新しいインターフェース: チャンク配列を並列生成し、順序保証されたストリームを返す
   *
   * @param chunks - 生成対象のチャンク配列（既に分割済み）
   * @param speakSettings - 音声設定
   * @returns 順序保証された音声結果のストリーム
   */
  async *generate(
    chunks: Chunk[],
    speakSettings: SpeakSettings
  ): AsyncGenerator<import('./types.js').GenerationResult> {
    if (chunks.length === 0) {
      return;
    }

    // 初期化
    this.newActiveTasks.clear();
    this.errorOccurred = false;
    this.firstError = null;
    let newFirstChunkCompleted = false;

    let currentIndex = 0;

    while (currentIndex < chunks.length) {
      // 現在のチャンクを開始（まだ開始されていない場合）
      if (!this.newActiveTasks.has(currentIndex) && !this.errorOccurred) {
        // pauseUntilFirstComplete: 初回完了まで待機（currentIndex > 0の場合）
        if (this.options.pauseUntilFirstComplete && currentIndex > 0 && !newFirstChunkCompleted) {
          // 初回完了を待つ（理論上はここには到達しないはず）
          logger.warn(`チャンク${currentIndex}: 初回未完了で未開始状態（異常）`);
        }

        // 並行数制限チェック
        while (this.newActiveTasks.size >= this.options.maxConcurrency) {
          await this.waitForAnyNewTaskCompletion();
        }

        this.startNewGeneration(chunks[currentIndex], speakSettings);
      }

      // エラー発生時は新規生成を停止
      if (!this.errorOccurred) {
        // 先読み生成を開始
        const nextIndex = currentIndex + 1;
        if (nextIndex < chunks.length) {
          const generateUpTo = Math.min(nextIndex + 1, chunks.length); // bufferAheadCount=1相当
          for (let i = nextIndex; i < generateUpTo; i++) {
            if (!this.newActiveTasks.has(i)) {
              // pauseUntilFirstComplete: 初回完了まで待機
              if (this.options.pauseUntilFirstComplete && i > 0 && !newFirstChunkCompleted) {
                // 初回完了を待つ
                break;
              }

              // 並行数制限チェック
              while (this.newActiveTasks.size >= this.options.maxConcurrency) {
                await this.waitForAnyNewTaskCompletion();
              }

              this.startNewGeneration(chunks[i], speakSettings);
            }
          }
        }
      }

      // 現在のチャンクの完了を待機
      const result = await this.waitForNewResult(currentIndex);

      // エラーチェック
      if (!result.success) {
        logger.error(`チャンク${result.chunkIndex}生成失敗、ストリーム終了`);
        yield result;
        await this.cleanupNewTasks();
        return;
      }

      // 初回完了フラグ
      if (currentIndex === 0) {
        newFirstChunkCompleted = true;
      }

      // 成功結果をyield
      yield result;
      currentIndex++;
    }

    await this.cleanupNewTasks();
  }

  /**
   * OpenPromiseパターンで新しい生成タスクを開始
   */
  private startNewGeneration(chunk: Chunk, speakSettings: SpeakSettings): void {
    logger.debug(`[ChunkGen] チャンク${chunk.index}: 生成開始（新方式）`);
    logger.debug(`SpeakSettings: characterId=${speakSettings.characterId}, styleId=${speakSettings.styleId}`);

    // 1. OpenPromiseパターン: Promiseを先に作成
    let resolveTask!: (result: AudioResult) => void;
    let rejectTask!: (error: Error) => void;
    const taskPromise = new Promise<AudioResult>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    // 2. 即座にcatchを設定（Unhandled Rejection防止）
    taskPromise.catch(() => {
      // エラーは waitForNewResult で処理される
    });

    // 3. タスクを登録
    const task: OpenPromiseTask = {
      promise: taskPromise,
      resolve: resolveTask,
      reject: rejectTask,
      startTime: Date.now(),
    };
    this.newActiveTasks.set(chunk.index, task);

    // 4. synthesizeFunctionを呼び出し
    this.synthesizeFunction(chunk, speakSettings)
      .then((result) => {
        logger.debug(`[ChunkGen] チャンク${chunk.index}: 生成成功（新方式）`);
        resolveTask(result);
      })
      .catch((error: Error) => {
        logger.debug(`[ChunkGen] チャンク${chunk.index}: エラー（新方式）- ${error.message}`);
        rejectTask(error);
      });
  }

  /**
   * 指定されたチャンクの生成結果を待機
   */
  private async waitForNewResult(chunkIndex: number): Promise<import('./types.js').GenerationResult> {
    const task = this.newActiveTasks.get(chunkIndex);
    if (!task) {
      return {
        success: false,
        error: new Error(`チャンク${chunkIndex}が見つかりません`),
        chunkIndex,
      };
    }

    try {
      const audioResult = await task.promise;
      this.newActiveTasks.delete(chunkIndex);
      return { success: true, data: audioResult };
    } catch (error) {
      this.newActiveTasks.delete(chunkIndex);

      // 最初のエラーを記録
      if (!this.errorOccurred) {
        this.errorOccurred = true;
        this.firstError = error as Error;
      } else {
        // 2番目以降のエラーはログ出力のみ
        logger.error(`チャンク${chunkIndex}生成失敗（複数エラー）: ${(error as Error).message}`);
      }

      return {
        success: false,
        error: error as Error,
        chunkIndex,
      };
    }
  }

  /**
   * いずれかのタスクの完了を待機
   */
  private async waitForAnyNewTaskCompletion(): Promise<void> {
    if (this.newActiveTasks.size === 0) {
      return;
    }

    const promises = Array.from(this.newActiveTasks.values()).map(task => task.promise.catch(() => {}));
    await Promise.race(promises);
  }

  /**
   * 残タスクの完了を待ってクリーンアップ
   */
  private async cleanupNewTasks(): Promise<void> {
    if (this.newActiveTasks.size > 0) {
      const promises = Array.from(this.newActiveTasks.values()).map(task => task.promise.catch(() => {}));
      await Promise.allSettled(promises);
    }

    this.newActiveTasks.clear();
    this.errorOccurred = false;
    this.firstError = null;
  }
}
