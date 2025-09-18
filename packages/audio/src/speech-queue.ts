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

  constructor(
    private processCallback: (task: SpeechTask) => Promise<void>,
    private warmupCallback?: () => Promise<void>
  ) {}

  /**
   * 音声タスクをキューに追加
   */
  async enqueue(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    return this.enqueueTask('speech', text, options);
  }

  /**
   * ウォームアップタスクをキューに追加
   */
  async enqueueWarmup(): Promise<SynthesizeResult> {
    return this.enqueueTask('warmup', '', {});
  }

  /**
   * 完了待機タスクをキューに追加（CLI用）
   */
  async enqueueCompletionWait(): Promise<SynthesizeResult> {
    return this.enqueueTask('completion_wait', '', {});
  }

  /**
   * タスクをキューに追加（内部用）
   */
  private async enqueueTask(
    type: SpeechTaskType,
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    const taskId = this.taskIdCounter++;
    const task: SpeechTask = {
      id: taskId,
      type,
      text,
      options,
      timestamp: Date.now(),
    };

    this.speechQueue.push(task);

    // キュー処理を開始（非同期、わずかに遅延させてテスト時の状態確認を可能にする）
    setTimeout(() => this.processQueue(), 0);

    return {
      success: true,
      taskId,
      queueLength: this.speechQueue.length, // 現在のキュー長
    };
  }

  /**
   * 音声タスクをキューに追加して完了を待つ
   */
  async enqueueAndWait(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    return this.enqueueTaskAndWait('speech', text, options);
  }

  /**
   * ウォームアップタスクをキューに追加して完了を待つ
   */
  async enqueueAndWaitWarmup(): Promise<SynthesizeResult> {
    return this.enqueueTaskAndWait('warmup', '', {});
  }

  /**
   * 完了待機タスクをキューに追加して完了を待つ
   */
  async enqueueAndWaitCompletion(): Promise<SynthesizeResult> {
    return this.enqueueTaskAndWait('completion_wait', '', {});
  }

  /**
   * タスクをキューに追加して完了を待つ（内部用）
   */
  private async enqueueTaskAndWait(
    type: SpeechTaskType,
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    const taskId = this.taskIdCounter++;

    return new Promise((resolve, reject) => {
      const task: SpeechTask = {
        id: taskId,
        type,
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

        // CLI用エラー通知
        if (task.reject) {
          task.reject(error as Error);
        }
      }
    }

    this.isProcessing = false;
  }

  /**
   * タスクタイプ別の処理を実行
   */
  private async processTask(task: SpeechTask): Promise<void> {
    switch (task.type) {
      case 'speech':
        await this.processCallback(task);
        break;

      case 'warmup':
        if (this.warmupCallback) {
          await this.warmupCallback();
        } else {
          logger.warn('ウォームアップコールバックが設定されていません');
        }
        break;

      case 'completion_wait':
        // バッファ処理完了のため500ms待機
        await new Promise(resolve => setTimeout(resolve, 500));
        break;

      default:
        logger.warn(`未知のタスクタイプ: ${task.type}`);
    }
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
   */
  clear(): void {
    this.speechQueue = [];
    this.isProcessing = false;
  }
}
