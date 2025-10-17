/**
 * src/queue/speech-queue.test.ts: SpeechQueue特有のテスト
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { SpeechQueue } from './speech-queue.js';
import type { SpeechTask } from './speech-queue.js';

describe('SpeechQueue', () => {
  let speechQueue: SpeechQueue;
  let processedTasks: SpeechTask[] = [];

  beforeEach(() => {
    processedTasks = [];
    speechQueue = new SpeechQueue(async (task) => {
      processedTasks.push(task);
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  });

  test('音声タスクの基本的なエンキュー', async () => {
    const result = speechQueue.enqueue('テストメッセージ', { rate: 200 });

    expect(result.success).toBe(true);
    expect(result.taskId).toBeDefined();
    expect(result.promise).toBeDefined();
    expect(result.outputFile).toBeUndefined();

    await result.promise;

    expect(processedTasks).toHaveLength(1);
    expect(processedTasks[0].type).toBe('speech');
    expect(processedTasks[0].text).toBe('テストメッセージ');
    expect(processedTasks[0].options.rate).toBe(200);
  });

  test('outputFileオプションが結果に含まれること', () => {
    const result = speechQueue.enqueue('テスト', {
      outputFile: '/tmp/test.wav'
    });

    expect(result.outputFile).toBe('/tmp/test.wav');
  });

  test('空文字列のテキストでも正常に処理されること', async () => {
    // 新しいキューインスタンスを作成して独立性を確保
    const localProcessedTasks: SpeechTask[] = [];
    const localQueue = new SpeechQueue(async (task) => {
      localProcessedTasks.push(task);
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    const result = localQueue.enqueue('', {});

    expect(result.success).toBe(true);

    await result.promise;

    expect(localProcessedTasks).toHaveLength(1);
    expect(localProcessedTasks[0].text).toBe('');
  });

  test('大量タスクのパフォーマンステスト', async () => {
    const taskCount = 50;
    const startTime = Date.now();
    const results = [];

    // 大量のタスクを追加
    for (let i = 0; i < taskCount; i++) {
      results.push(speechQueue.enqueue(`メッセージ${i}`, {}));
    }

    // 全タスクの完了を待つ
    await Promise.all(results.map(r => r.promise));

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(processedTasks).toHaveLength(taskCount);
    expect(processingTime).toBeLessThan(3000); // 3秒以内
  });

  test('waitForAllTasksでエラー情報を取得できること', async () => {
    const errorQueue = new SpeechQueue(async (task) => {
      if (task.text === 'エラー') {
        throw new Error('テストエラー');
      }
      processedTasks.push(task);
    });

    errorQueue.enqueue('正常1', {});
    errorQueue.enqueue('エラー', {});
    errorQueue.enqueue('正常2', {});

    const { errors } = await errorQueue.waitForAllTasks();

    expect(errors).toHaveLength(1);
    expect(errors[0].error.message).toBe('テストエラー');
    expect(processedTasks).toHaveLength(2); // エラータスクは処理されない
  });
});