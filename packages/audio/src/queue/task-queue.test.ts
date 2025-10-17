/**
 * src/queue/task-queue.test.ts: TaskQueueのテスト
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { TaskQueue } from './task-queue.js';
import type { BaseTask } from './types.js';

// テスト用タスク
interface TestTask extends BaseTask {
  type: 'test';
  data: string;
}

describe('TaskQueue', () => {
  let taskQueue: TaskQueue<TestTask>;
  let processedTasks: TestTask[] = [];

  beforeEach(() => {
    processedTasks = [];
    taskQueue = new TaskQueue<TestTask>(async (task) => {
      processedTasks.push(task);
      // 処理をシミュレート
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  test('タスクのエンキューと処理', async () => {
    const result = taskQueue.enqueue({
      type: 'test',
      data: 'テストデータ',
    });

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
    expect(result.promise).toBeDefined();

    // タスクの完了を待つ
    await result.promise;

    expect(processedTasks).toHaveLength(1);
    expect(processedTasks[0].data).toBe('テストデータ');
  });

  test('複数タスクの順次処理', async () => {
    const results = [
      taskQueue.enqueue({ type: 'test', data: 'タスク1' }),
      taskQueue.enqueue({ type: 'test', data: 'タスク2' }),
      taskQueue.enqueue({ type: 'test', data: 'タスク3' }),
    ];

    // すべてのタスクの完了を待つ
    await Promise.all(results.map(r => r.promise));

    expect(processedTasks).toHaveLength(3);
    expect(processedTasks[0].data).toBe('タスク1');
    expect(processedTasks[1].data).toBe('タスク2');
    expect(processedTasks[2].data).toBe('タスク3');
  });

  test('エラーハンドリング', async () => {
    const errorQueue = new TaskQueue<TestTask>(async (task) => {
      if (task.data === 'エラー') {
        throw new Error('処理エラー');
      }
      processedTasks.push(task);
    });

    const result1 = errorQueue.enqueue({ type: 'test', data: '正常' });
    const result2 = errorQueue.enqueue({ type: 'test', data: 'エラー' });
    const result3 = errorQueue.enqueue({ type: 'test', data: '正常2' });

    // エラーが発生してもPromiseはrejectされる
    await expect(result2.promise).rejects.toThrow('処理エラー');

    // 他のタスクは正常に処理される
    await result1.promise;
    await result3.promise;

    expect(processedTasks).toHaveLength(2);

    // エラー情報を取得
    const { errors } = await errorQueue.waitForAllTasks();
    expect(errors).toHaveLength(1);
    expect(errors[0].error.message).toBe('処理エラー');
  });

  test('キューのクリア', async () => {
    const results = [
      taskQueue.enqueue({ type: 'test', data: 'タスク1' }),
      taskQueue.enqueue({ type: 'test', data: 'タスク2' }),
      taskQueue.enqueue({ type: 'test', data: 'タスク3' }),
    ];

    // 即座にクリア
    const clearResult = await taskQueue.clear();

    expect(clearResult.removedCount).toBeGreaterThanOrEqual(0);

    // Promiseはrejectされる
    for (const result of results) {
      await expect(result.promise).rejects.toThrow('Queue cleared');
    }
  });

  test('タスクの中断', async () => {
    let abortCalled = false;
    let processingStarted = false;

    const abortQueue = new TaskQueue<TestTask>(async (task) => {
      processingStarted = true;

      // abort関数を注入
      task.abort = async () => {
        abortCalled = true;
      };

      // abortedフラグをチェックして早期終了
      if (task.aborted) {
        return;
      }

      // 長い処理をシミュレート
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 100);

        // abortedフラグの監視
        const checkAborted = setInterval(() => {
          if (task.aborted) {
            clearInterval(checkAborted);
            clearTimeout(timer);
            reject(new Error('Task aborted'));
          }
        }, 10);
      }).catch(() => {
        // 中断による例外を処理
      });

      if (!task.aborted) {
        processedTasks.push(task);
      }
    });

    const result = abortQueue.enqueue({ type: 'test', data: 'タスク' });

    // 処理開始を待つ
    await new Promise(resolve => setTimeout(resolve, 20));

    // クリアして中断
    const clearResult = await abortQueue.clear();

    expect(processingStarted).toBe(true);
    expect(clearResult.aborted).toBe(true);
    expect(abortCalled).toBe(true);

    // Promiseがrejectされることを確認（Task abortedメッセージを期待）
    await expect(result.promise).rejects.toThrow('Task aborted');
  });

  test('ステータスの取得', async () => {
    taskQueue.enqueue({ type: 'test', data: 'タスク1' });
    taskQueue.enqueue({ type: 'test', data: 'タスク2' });

    // 処理開始を待つ
    await new Promise(resolve => setTimeout(resolve, 10));

    const status = taskQueue.getStatus();

    expect(status.queueLength).toBeLessThanOrEqual(2);
    expect(status.isProcessing).toBeDefined();
    expect(status.currentTaskId).toBeDefined();
  });
});