/**
 * queue-unified.test.ts
 * Queue統一実装のテスト
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { SpeechQueue } from './speech-queue.js';
import type { SpeechTask } from './types.js';

describe('Queue統一実装テスト', () => {
  let speechQueue: SpeechQueue;
  let processCallbacks: SpeechTask[] = [];

  beforeEach(() => {
    processCallbacks = [];

    speechQueue = new SpeechQueue(
      async (task: SpeechTask) => {
        processCallbacks.push(task);
      }
    );
  });

  test('通常の音声タスクのキューイング', async () => {
    const result = speechQueue.enqueue('テストメッセージ');

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();

    // waitForAllTasksを呼んで完了を待つ
    await speechQueue.waitForAllTasks();

    expect(processCallbacks).toHaveLength(1);
    expect(processCallbacks[0].type).toBe('speech');
    expect(processCallbacks[0].text).toBe('テストメッセージ');
  });

  test('複数タスクのキューイング', async () => {
    const result1 = speechQueue.enqueue('タスク1');
    const result2 = speechQueue.enqueue('タスク2');

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);

    // 全タスクの完了を待つ
    await speechQueue.waitForAllTasks();

    expect(processCallbacks).toHaveLength(2);
    expect(processCallbacks[0].text).toBe('タスク1');
    expect(processCallbacks[1].text).toBe('タスク2');
  });

  test('キューのステータス取得', async () => {
    speechQueue.enqueue('タスク1');
    speechQueue.enqueue('タスク2');

    // 処理が開始されるまで少し待つ
    await new Promise(resolve => setTimeout(resolve, 10));

    const status = speechQueue.getStatus();

    // キューの処理が始まっているため、queueLengthは1または0になる
    expect(status.queueLength).toBeLessThanOrEqual(2);
    expect(status.isProcessing).toBeDefined();
    expect(status.nextTaskId).toBeDefined();
  });

  test('enqueueAndWaitの同期的完了待機', async () => {
    // クリーンな状態から始める
    processCallbacks = [];

    const result = await speechQueue.enqueueAndWait('同期テスト');

    expect(result.success).toBe(true);
    expect(processCallbacks).toHaveLength(1);
    expect(processCallbacks[0].text).toBe('同期テスト');
  });

  test('キューのクリア', async () => {
    speechQueue.enqueue('タスク1');
    speechQueue.enqueue('タスク2');

    speechQueue.clear();

    const status = speechQueue.getStatus();
    expect(status.queueLength).toBe(0);
    expect(status.isProcessing).toBe(false);
  });

  test('エラーハンドリング', async () => {
    // エラーを発生させるプロセッサ
    const errorQueue = new SpeechQueue(
      async (task: SpeechTask) => {
        if (task.text === 'エラータスク') {
          throw new Error('テストエラー');
        }
      }
    );

    errorQueue.enqueue('正常タスク');
    errorQueue.enqueue('エラータスク');
    errorQueue.enqueue('正常2');

    const result = await errorQueue.waitForAllTasks();

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error.message).toBe('テストエラー');
  });

  test('複合タスクの順次実行', async () => {
    // 複数の音声タスクを順次実行
    await speechQueue.enqueueAndWait('メッセージ1');
    await speechQueue.enqueueAndWait('メッセージ2');
    await speechQueue.enqueueAndWait('メッセージ3');

    expect(processCallbacks).toHaveLength(3);
    expect(processCallbacks[0].text).toBe('メッセージ1');
    expect(processCallbacks[1].text).toBe('メッセージ2');
    expect(processCallbacks[2].text).toBe('メッセージ3');
  });
});
