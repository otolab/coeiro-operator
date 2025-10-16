/**
 * src/say/speech-queue.ts: 音声合成キュー管理
 * 非同期音声タスクのキューイングと順次処理を担当
 */

import type { SpeechTask, SpeechTaskType, SynthesizeOptions, SynthesizeResult } from './types.js';
import { logger } from '@coeiro-operator/common';

export class SpeechQueue {
  private speechQueue: SpeechTask[] = [];
  private isProcessing: boolean = false;
  private taskIdCounter: number = Date.now();
  private errors: Array<{taskId: number; error: Error}> = [];

  constructor(
    private processCallback: (task: SpeechTask) => Promise<void>
  ) {}

  /**
   * 音声タスクをキューに追加（同期的）
   */
  enqueue(text: string, options: SynthesizeOptions = {}): SynthesizeResult {
    const taskId = this.taskIdCounter++;

    const task: SpeechTask = {
      id: taskId,
      type: 'speech',
      text,
      options,
      timestamp: Date.now(),
    };

    this.speechQueue.push(task);

    // キュー処理を開始
    setTimeout(() => this.processQueue(), 0);

    return {
      success: true,
      taskId,
      queueLength: this.speechQueue.length,
    };
  }

  /**
   * 音声タスクをキューに追加して完了を待つ
   */
  async enqueueAndWait(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    const taskId = this.taskIdCounter++;

    return new Promise((resolve, reject) => {
      const task: SpeechTask = {
        id: taskId,
        type: 'speech',
        text,
        options,
        timestamp: Date.now(),
        resolve: () =>
          resolve({
            success: true,
            taskId,
            queueLength: this.speechQueue.length,
          }),
        reject,
      };

      this.speechQueue.push(task);

      // キュー処理を開始
      setTimeout(() => this.processQueue(), 0);
    });
  }

  /**
   * キューに入っているすべてのタスクの完了を待つ
   * @returns エラーが発生した場合はエラーリストを含む結果を返す
   */
  async waitForAllTasks(): Promise<{ errors: Array<{taskId: number; error: Error}> }> {
    return new Promise((resolve) => {
      const checkQueue = () => {
        if (this.speechQueue.length === 0 && !this.isProcessing) {
          // エラーリストを返してクリア
          const errors = [...this.errors];
          this.errors = [];
          resolve({ errors });
        } else {
          setTimeout(checkQueue, 100);
        }
      };
      checkQueue();
    });
  }


  /**
   * キューの処理を開始
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    if (this.speechQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.speechQueue.length > 0) {
      const task = this.speechQueue.shift();
      if (!task) break;

      try {
        await this.processTask(task);
        logger.verbose(`音声タスク完了: ${task.id} (${task.type})`);

        // CLI用完了通知
        if (task.resolve) {
          task.resolve();
        }
      } catch (error) {
        logger.error(`音声タスクエラー: ${task.id} (${task.type}), ${(error as Error).message}`);

        // エラーを保存
        this.errors.push({
          taskId: task.id,
          error: error as Error
        });

        // CLI用エラー通知
        if (task.reject) {
          task.reject(error as Error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * タスクの処理を実行
   */
  private async processTask(task: SpeechTask): Promise<void> {
    // 音声合成タスクの処理
    await this.processCallback(task);
  }

  /**
   * キューの状態を取得
   */
  getStatus() {
    return {
      queueLength: this.speechQueue.length,
      isProcessing: this.isProcessing,
      nextTaskId: this.speechQueue[0]?.id || null,
    };
  }

  /**
   * キューをクリア
   * @param taskIds 削除するタスクIDの配列（省略時は全タスク削除）
   * @returns 削除されたタスク数
   */
  clear(taskIds?: number[]): { removedCount: number } {
    if (!taskIds || taskIds.length === 0) {
      // 既存の動作：全タスククリア
      const count = this.speechQueue.length;
      this.speechQueue = [];
      this.isProcessing = false;
      return { removedCount: count };
    }

    // 新機能：指定タスクのみ削除
    const before = this.speechQueue.length;
    this.speechQueue = this.speechQueue.filter(
      task => !taskIds.includes(task.id)
    );
    const removedCount = before - this.speechQueue.length;

    // キューが空になった場合は処理中フラグもリセット
    if (this.speechQueue.length === 0) {
      this.isProcessing = false;
    }

    return { removedCount };
  }
}
