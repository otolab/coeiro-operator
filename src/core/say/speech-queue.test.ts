/**
 * src/say/speech-queue.test.ts: SpeechQueueクラステスト
 */

import { SpeechQueue } from './speech-queue.js';
import type { SpeechTask, SynthesizeOptions, SynthesizeResult } from './types.js';

describe('SpeechQueue', () => {
    let speechQueue: SpeechQueue;
    let mockProcessCallback: jest.Mock;

    beforeEach(() => {
        mockProcessCallback = jest.fn().mockResolvedValue(undefined);
        speechQueue = new SpeechQueue(mockProcessCallback);
    });

    describe('初期化', () => {
        test('初期状態でキューが空であること', () => {
            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(0);
            expect(status.isProcessing).toBe(false);
        });
    });

    describe('enqueue', () => {
        test('タスクを正常にキューに追加できること', async () => {
            const text = 'テストメッセージ';
            const options: SynthesizeOptions = { rate: 150 };

            const result = await speechQueue.enqueue(text, options);

            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
            expect(result.queueLength).toBe(1);

            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(1);
        });

        test('複数のタスクを順次追加できること', async () => {
            await speechQueue.enqueue('メッセージ1', {});
            await speechQueue.enqueue('メッセージ2', {});
            await speechQueue.enqueue('メッセージ3', {});

            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(3);
        });

        test('各タスクに一意のIDが割り当てられること', async () => {
            const result1 = await speechQueue.enqueue('メッセージ1', {});
            const result2 = await speechQueue.enqueue('メッセージ2', {});

            expect(result1.taskId).not.toBe(result2.taskId);
        });
    });

    describe('processQueue', () => {
        test('キューが空の場合は処理が実行されないこと', async () => {
            // processQueueは内部的に自動実行される
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(mockProcessCallback).not.toHaveBeenCalled();
        });

        test('単一のタスクが正常に処理されること', async () => {
            await speechQueue.enqueue('テストメッセージ', { rate: 200 });

            // 処理完了を待機
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(mockProcessCallback).toHaveBeenCalledTimes(1);
            expect(mockProcessCallback).toHaveBeenCalledWith(expect.objectContaining({
                text: 'テストメッセージ',
                options: { rate: 200 }
            }));

            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(0);
            expect(status.isProcessing).toBe(false);
        });

        test('複数のタスクが順次処理されること', async () => {
            await speechQueue.enqueue('メッセージ1', {});
            await speechQueue.enqueue('メッセージ2', {});
            await speechQueue.enqueue('メッセージ3', {});

            // 処理完了を待機
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(mockProcessCallback).toHaveBeenCalledTimes(3);
            
            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(0);
        });

        test('処理中にエラーが発生してもキューが継続処理されること', async () => {
            // 2番目のタスクでエラーが発生するように設定
            mockProcessCallback
                .mockResolvedValueOnce(undefined)  // 1番目は成功
                .mockRejectedValueOnce(new Error('処理エラー'))  // 2番目はエラー
                .mockResolvedValueOnce(undefined);  // 3番目は成功

            await speechQueue.enqueue('メッセージ1', {});
            await speechQueue.enqueue('メッセージ2', {});
            await speechQueue.enqueue('メッセージ3', {});

            // 処理完了を待機
            await new Promise(resolve => setTimeout(resolve, 500));

            expect(mockProcessCallback).toHaveBeenCalledTimes(3);
            
            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(0);
        });

        test('処理中フラグが正しく管理されること', async () => {
            // 長時間の処理をシミュレート
            mockProcessCallback.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 200))
            );

            await speechQueue.enqueue('長時間処理', {});

            // 処理開始直後
            await new Promise(resolve => setTimeout(resolve, 50));
            let status = speechQueue.getStatus();
            expect(status.isProcessing).toBe(true);

            // 処理完了後
            await new Promise(resolve => setTimeout(resolve, 300));
            status = speechQueue.getStatus();
            expect(status.isProcessing).toBe(false);
        });
    });

    describe('getStatus', () => {
        test('正確なステータス情報を返すこと', async () => {
            await speechQueue.enqueue('メッセージ1', {});
            await speechQueue.enqueue('メッセージ2', {});

            const status = speechQueue.getStatus();

            expect(status).toEqual({
                queueLength: 2,
                isProcessing: expect.any(Boolean)
            });
        });
    });

    describe('clear', () => {
        test('キューを正常にクリアできること', async () => {
            await speechQueue.enqueue('メッセージ1', {});
            await speechQueue.enqueue('メッセージ2', {});
            await speechQueue.enqueue('メッセージ3', {});

            expect(speechQueue.getStatus().queueLength).toBe(3);

            speechQueue.clear();

            expect(speechQueue.getStatus().queueLength).toBe(0);
        });

        test('処理中でもキューをクリアできること', async () => {
            // 長時間の処理をシミュレート
            mockProcessCallback.mockImplementation(() => 
                new Promise(resolve => setTimeout(resolve, 300))
            );

            await speechQueue.enqueue('長時間処理', {});
            await speechQueue.enqueue('メッセージ2', {});

            // 処理開始を待機
            await new Promise(resolve => setTimeout(resolve, 50));

            speechQueue.clear();

            const status = speechQueue.getStatus();
            expect(status.queueLength).toBe(0);
            // 現在実行中のタスクは継続される
            expect(status.isProcessing).toBe(true);
        });
    });

    describe('エッジケース', () => {
        test('空文字列のテキストでも正常に処理されること', async () => {
            const result = await speechQueue.enqueue('', {});

            expect(result.success).toBe(true);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(mockProcessCallback).toHaveBeenCalledWith(expect.objectContaining({
                text: ''
            }));
        });

        test('オプションがundefinedでも正常に処理されること', async () => {
            const result = await speechQueue.enqueue('テスト', undefined as any);

            expect(result.success).toBe(true);
            
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(mockProcessCallback).toHaveBeenCalledWith(expect.objectContaining({
                text: 'テスト',
                options: {}
            }));
        });

        test('processCallback が null や undefined を返しても正常に動作すること', async () => {
            mockProcessCallback.mockResolvedValue(null);
            
            await speechQueue.enqueue('テスト', {});
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(mockProcessCallback).toHaveBeenCalled();
            expect(speechQueue.getStatus().queueLength).toBe(0);
        });
    });

    describe('パフォーマンス', () => {
        test('大量のタスクを効率的に処理できること', async () => {
            const taskCount = 100;
            const startTime = Date.now();

            // 高速処理をシミュレート
            mockProcessCallback.mockResolvedValue(undefined);

            // 大量のタスクを追加
            for (let i = 0; i < taskCount; i++) {
                await speechQueue.enqueue(`メッセージ${i}`, {});
            }

            // 処理完了を待機
            await new Promise(resolve => setTimeout(resolve, 1000));

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(mockProcessCallback).toHaveBeenCalledTimes(taskCount);
            expect(speechQueue.getStatus().queueLength).toBe(0);
            
            // 処理時間が合理的な範囲内であることを確認（1秒以内）
            expect(processingTime).toBeLessThan(1000);
        });
    });
});