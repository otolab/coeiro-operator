/**
 * src/say/speech-queue.ts: 音声合成キュー管理
 * 非同期音声タスクのキューイングと順次処理を担当
 */

import type { SpeechTask, SynthesizeOptions, SynthesizeResult } from './types.js';
import { logger } from '../../utils/logger.js';

export class SpeechQueue {
    private speechQueue: SpeechTask[] = [];
    private isProcessing: boolean = false;
    private taskIdCounter: number = Date.now();

    constructor(private processCallback: (task: SpeechTask) => Promise<void>) {}

    /**
     * 音声タスクをキューに追加
     */
    async enqueue(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        const taskId = this.taskIdCounter++;
        const task: SpeechTask = {
            id: taskId,
            text,
            options,
            timestamp: Date.now()
        };

        this.speechQueue.push(task);

        // キュー処理を開始（非同期）
        this.processQueue();

        return {
            success: true,
            taskId,
            queueLength: this.speechQueue.length - 1 // 追加したタスクを除く
        };
    }

    /**
     * デバッグ用：音声タスクをキューに追加して完了を待つ
     */
    async enqueueAndWait(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        const taskId = this.taskIdCounter++;
        const task: SpeechTask = {
            id: taskId,
            text,
            options,
            timestamp: Date.now()
        };

        this.speechQueue.push(task);

        // キュー処理を同期的に待つ
        await this.processQueue();

        return {
            success: true,
            taskId,
            queueLength: this.speechQueue.length - 1 // 追加したタスクを除く（enqueueと統一）
        };
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
                await this.processCallback(task);
                logger.verbose(`音声タスク完了: ${task.id}`);
            } catch (error) {
                logger.error(`音声タスクエラー: ${task.id}, ${(error as Error).message}`);
            }
        }
        
        this.isProcessing = false;
    }

    /**
     * キューの状態を取得
     */
    getStatus() {
        return {
            queueLength: this.speechQueue.length,
            isProcessing: this.isProcessing,
            nextTaskId: this.speechQueue[0]?.id || null
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