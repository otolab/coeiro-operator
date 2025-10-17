/**
 * src/queue/task-queue.ts: ジェネリックタスクキュー管理
 * 非同期タスクのキューイングと順次処理を担当
 */

import type { BaseTask, EnqueueResult, QueueStatus, ClearResult } from './types.js';
import { logger } from '@coeiro-operator/common';

/**
 * ジェネリックタスクキュー
 * @template T タスクの型（BaseTaskを拡張）
 */
export class TaskQueue<T extends BaseTask> {
  private taskQueue: T[] = [];
  private currentProcessPromise: Promise<void> | null = null;
  private currentTask: T | null = null;
  private taskIdCounter: number = Date.now();
  private errors: Array<{taskId: number; error: Error}> = [];

  constructor(
    private processCallback: (task: T) => Promise<void>
  ) {}

  /**
   * タスクを作成してキューに追加
   * @param taskData タスクデータ（id, promise, resolve, reject以外のフィールド）
   */
  enqueue(taskData: Omit<T, 'id' | 'promise' | 'resolve' | 'reject' | 'timestamp'>): EnqueueResult {
    const taskId = this.taskIdCounter++;

    // OpenPromiseパターンでPromiseを作成
    let resolveTask!: () => void;
    let rejectTask!: (error: Error) => void;
    const taskPromise = new Promise<void>((resolve, reject) => {
      resolveTask = resolve;
      rejectTask = reject;
    });

    const task = {
      ...taskData,
      id: taskId,
      timestamp: Date.now(),
      promise: taskPromise,
      resolve: resolveTask,
      reject: rejectTask,
    } as T;

    this.taskQueue.push(task);

    // 処理を別のタイミングで開始
    setTimeout(() => {
      // processQueueのエラーをキャッチして、unhandled rejectionを防ぐ
      this.processQueue().catch(error => {
        logger.error('[TaskQueue] processQueueエラー:', error);
        // エラーは既にprocessQueue内で処理されているので、ここでは記録のみ
      });
    }, 0);

    return {
      success: true,
      taskId,
      promise: task.promise,
      queueLength: this.taskQueue.length,
    };
  }

  /**
   * キューに入っているすべてのタスクの完了を待つ
   * @returns エラーが発生した場合はエラーリストを含む結果を返す
   */
  async waitForAllTasks(): Promise<{ errors: Array<{taskId: number; error: Error}> }> {
    logger.debug(`[TaskQueue] waitForAllTasks開始, currentProcessPromise: ${this.currentProcessPromise !== null}, queue長: ${this.taskQueue.length}`);

    // 処理中のprocessQueueがあれば待つ
    if (this.currentProcessPromise) {
      logger.debug(`[TaskQueue] processQueueの完了を待機中...`);
      await this.currentProcessPromise;
      logger.debug(`[TaskQueue] processQueue完了`);
    }

    // キューに残っているタスクのPromiseも念のため待つ
    const promises = this.taskQueue
      .filter(task => task.promise)
      .map(task => task.promise as Promise<void>);
    if (promises.length > 0) {
      logger.debug(`[TaskQueue] 残りのタスクPromise待機中: ${promises.length}件`);
      await Promise.allSettled(promises);
    }

    // エラーリストを返してクリア
    const errors = [...this.errors];
    logger.debug(`[TaskQueue] waitForAllTasks完了, エラー数: ${errors.length}`);
    this.errors = [];
    return { errors };
  }

  /**
   * キューの処理を開始
   */
  private async processQueue(): Promise<void> {
    logger.debug(`[TaskQueue] processQueue開始, queue長: ${this.taskQueue.length}`);

    // 既に処理中なら、その完了を待つだけ
    if (this.currentProcessPromise) {
      logger.debug(`[TaskQueue] 既に処理中のためスキップ`);
      return this.currentProcessPromise;
    }

    if (this.taskQueue.length === 0) {
      logger.debug(`[TaskQueue] キューが空のため終了`);
      this.currentProcessPromise = null;
      return;
    }

    // 新しい処理を開始
    this.currentProcessPromise = (async () => {
      // キューが空になるまで処理を続ける
      while (this.taskQueue.length > 0) {
        // 1つのタスクを処理
        const task = this.taskQueue.shift();
        if (!task) break;

        this.currentTask = task;

        try {
          // 中断されたタスクはスキップ
          if (task.aborted) {
            if (task.reject) {
              task.reject(new Error('Task aborted'));
              // Unhandled rejectionを防ぐためにPromiseをcatch
              if (task.promise) {
                task.promise.catch(() => {
                  // エラーは既にrejectで通知済みなので、ここでは何もしない
                });
              }
            }
            continue;
          }

          logger.debug(`[TaskQueue] タスク処理開始: ${task.id}`);
          await this.processTask(task);
          logger.debug(`[TaskQueue] タスク処理成功: ${task.id}`);

          // 処理後に再度中断チェック
          if (task.aborted) {
            if (task.reject) {
              task.reject(new Error('Task aborted'));
              // Unhandled rejectionを防ぐためにPromiseをcatch
              if (task.promise) {
                task.promise.catch(() => {
                  // エラーは既にrejectで通知済みなので、ここでは何もしない
                });
              }
            }
            continue;
          }

          logger.verbose(`タスク完了: ${task.id} (${task.type})`);

          // OpenPromiseを解決
          if (task.resolve) {
            task.resolve();
          }
        } catch (error) {
          logger.error(`[TaskQueue] タスクエラー: ${task.id} (${task.type}), ${(error as Error).message}`);
          logger.error(`[TaskQueue] エラースタック:`, (error as Error).stack);

          // エラーを保存
          this.errors.push({
            taskId: task.id,
            error: error as Error
          });
          logger.debug(`[TaskQueue] エラーをリストに保存: 現在のエラー数=${this.errors.length}`);

          // OpenPromiseをreject
          if (task.reject) {
            logger.debug(`[TaskQueue] タスクのPromiseをreject`);
            task.reject(error as Error);
          }
        } finally {
          this.currentTask = null;
        }
      }
    })();

    // 処理を待つ
    await this.currentProcessPromise;
    this.currentProcessPromise = null;
  }

  /**
   * タスクの処理を実行
   */
  private async processTask(task: T): Promise<void> {
    await this.processCallback(task);
  }

  /**
   * キューの状態を取得
   */
  getStatus(): QueueStatus {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.currentProcessPromise !== null,
      nextTaskId: this.taskQueue[0]?.id || null,
      currentTaskId: this.currentTask?.id || null,
    };
  }

  /**
   * キューをクリア
   * @param taskIds 削除するタスクIDの配列（省略時は全タスク削除）
   * @returns 削除されたタスク数と、実行中タスクの中断状態
   */
  async clear(taskIds?: number[]): Promise<ClearResult> {
    let aborted = false;

    if (!taskIds || taskIds.length === 0) {
      // 全タスククリア
      const count = this.taskQueue.length;

      // クリア前にタスクをreject
      for (const task of this.taskQueue) {
        task.aborted = true;
        if (task.reject) {
          task.reject(new Error('Queue cleared'));
          // Unhandled rejectionを防ぐためにPromiseをcatch
          if (task.promise) {
            task.promise.catch(() => {
              // エラーは既にrejectで通知済みなので、ここでは何もしない
            });
          }
        }
      }

      this.taskQueue = [];

      // 実行中のタスクがあれば中断を試みる
      if (this.currentTask) {
        this.currentTask.aborted = true;
        if (this.currentTask.abort) {
          await this.currentTask.abort();
          aborted = true;
        }
        // 実行中タスクのrejectは呼ばない（processQueue内で処理される）
      }

      // 処理の完了を待つ
      if (this.currentProcessPromise) {
        await this.currentProcessPromise;
      }
      this.currentProcessPromise = null;

      return { removedCount: count, aborted };
    }

    // 指定タスクのみ削除
    const before = this.taskQueue.length;

    // 実行中のタスクが削除対象かチェック
    if (this.currentTask && taskIds.includes(this.currentTask.id)) {
      this.currentTask.aborted = true;
      if (this.currentTask.abort) {
        await this.currentTask.abort();
        aborted = true;
      }
      // 実行中タスクのrejectは呼ばない（processQueue内で処理される）
    }

    this.taskQueue = this.taskQueue.filter(
      task => {
        const shouldRemove = taskIds.includes(task.id);
        if (shouldRemove) {
          task.aborted = true;
          if (task.reject) {
            task.reject(new Error('Task removed from queue'));
            // Unhandled rejectionを防ぐためにPromiseをcatch
            if (task.promise) {
              task.promise.catch(() => {
                // エラーは既にrejectで通知済みなので、ここでは何もしない
              });
            }
          }
        }
        return !shouldRemove;
      }
    );
    const removedCount = before - this.taskQueue.length;

    // キューが空になった場合は処理中フラグもリセット
    if (this.taskQueue.length === 0 && !this.currentTask) {
      this.currentProcessPromise = null;
    }

    return { removedCount, aborted };
  }
}