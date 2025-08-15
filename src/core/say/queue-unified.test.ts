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
    let warmupCallbacks: number = 0;

    beforeEach(() => {
        processCallbacks = [];
        warmupCallbacks = 0;
        
        speechQueue = new SpeechQueue(
            async (task: SpeechTask) => {
                processCallbacks.push(task);
            },
            async () => {
                warmupCallbacks++;
            }
        );
    });

    test('通常の音声タスクのキューイング', async () => {
        const result = await speechQueue.enqueue('テストメッセージ');
        
        expect(result.success).toBe(true);
        expect(result.taskId).toBeDefined();
        
        // 非同期処理の完了を待つ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(processCallbacks).toHaveLength(1);
        expect(processCallbacks[0].type).toBe('speech');
        expect(processCallbacks[0].text).toBe('テストメッセージ');
    });

    test('ウォームアップタスクのキューイング', async () => {
        const result = await speechQueue.enqueueWarmup();
        
        expect(result.success).toBe(true);
        
        // 非同期処理の完了を待つ
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(warmupCallbacks).toBe(1);
    });

    test('完了待機タスクのキューイング', async () => {
        const startTime = Date.now();
        const result = await speechQueue.enqueueCompletionWait();
        
        expect(result.success).toBe(true);
        
        // 非同期処理の完了を待つ（500ms + 余裕）
        await new Promise(resolve => setTimeout(resolve, 600));
        
        const elapsedTime = Date.now() - startTime;
        expect(elapsedTime).toBeGreaterThanOrEqual(500); // 500ms待機が実行されている
    });

    test('CLI用同期実行（enqueueAndWait）', async () => {
        const startTime = Date.now();
        
        const result = await speechQueue.enqueueAndWait('同期テスト');
        
        const elapsedTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(processCallbacks).toHaveLength(1);
        expect(processCallbacks[0].text).toBe('同期テスト');
        expect(elapsedTime).toBeLessThan(100); // 同期処理なので高速
    });

    test('ウォームアップ同期実行', async () => {
        const result = await speechQueue.enqueueWarmupAndWait();
        
        expect(result.success).toBe(true);
        expect(warmupCallbacks).toBe(1);
    });

    test('完了待機同期実行', async () => {
        const startTime = Date.now();
        
        const result = await speechQueue.enqueueCompletionWaitAndWait();
        
        const elapsedTime = Date.now() - startTime;
        
        expect(result.success).toBe(true);
        expect(elapsedTime).toBeGreaterThanOrEqual(500); // 500ms待機が実行されている
    });

    test('複合タスクの順次実行', async () => {
        // ウォームアップ → 音声 → 完了待機の順で実行
        await speechQueue.enqueueWarmupAndWait();
        await speechQueue.enqueueAndWait('メインメッセージ');
        await speechQueue.enqueueCompletionWaitAndWait();
        
        expect(warmupCallbacks).toBe(1);
        expect(processCallbacks).toHaveLength(1);
        expect(processCallbacks[0].text).toBe('メインメッセージ');
    });
});