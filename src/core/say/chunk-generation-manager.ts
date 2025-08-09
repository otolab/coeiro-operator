/**
 * src/core/say/chunk-generation-manager.ts: 並行チャンク生成管理
 * 複数チャンクの生成を並行して行い、完成順序ではなく論理順序で管理
 */

import { logger } from '../../utils/logger.js';
import type { Chunk, AudioResult, OperatorVoice } from './types.js';

export interface GenerationTask {
    chunk: Chunk;
    voiceInfo: string | OperatorVoice;
    speed: number;
    startTime: number;
    promise: Promise<AudioResult>;
}

export interface GenerationOptions {
    maxConcurrency: number;        // 最大並行生成数（デフォルト: 2）
    delayBetweenRequests: number; // リクエスト間隔（ms、デフォルト: 50ms）
}

/**
 * チャンク生成の並行制御管理クラス
 */
export class ChunkGenerationManager {
    private activeTasks: Map<number, GenerationTask> = new Map();
    private completedResults: Map<number, AudioResult> = new Map();
    private options: GenerationOptions;
    private synthesizeFunction: (chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number) => Promise<AudioResult>;

    constructor(
        synthesizeFunction: (chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number) => Promise<AudioResult>,
        options: Partial<GenerationOptions> = {}
    ) {
        this.synthesizeFunction = synthesizeFunction;
        this.options = {
            maxConcurrency: 2,
            delayBetweenRequests: 50,
            ...options
        };
    }

    /**
     * チャンクの生成を開始（並行制御あり）
     */
    async startGeneration(chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number): Promise<void> {
        // 並行数制限のチェック
        while (this.activeTasks.size >= this.options.maxConcurrency) {
            await this.waitForAnyTaskCompletion();
        }

        // 新しい生成タスクを開始
        const task: GenerationTask = {
            chunk,
            voiceInfo,
            speed,
            startTime: Date.now(),
            promise: this.synthesizeFunction(chunk, voiceInfo, speed)
        };

        this.activeTasks.set(chunk.index, task);
        logger.debug(`チャンク${chunk.index}の生成開始 (並行数: ${this.activeTasks.size})`);

        // 生成完了時の処理を設定
        task.promise
            .then((result: AudioResult) => {
                this.onTaskCompleted(chunk.index, result);
            })
            .catch((error: Error) => {
                this.onTaskFailed(chunk.index, error);
            });

        // リクエスト間隔の調整
        if (this.options.delayBetweenRequests > 0) {
            await this.delay(this.options.delayBetweenRequests);
        }
    }

    /**
     * 指定されたチャンクの生成結果を取得（完了まで待機）
     */
    async getResult(chunkIndex: number): Promise<AudioResult> {
        // 既に完了している場合
        if (this.completedResults.has(chunkIndex)) {
            const result = this.completedResults.get(chunkIndex)!;
            this.completedResults.delete(chunkIndex); // 取得後はクリア
            return result;
        }

        // 生成中の場合は完了を待機
        const activeTask = this.activeTasks.get(chunkIndex);
        if (activeTask) {
            return await activeTask.promise;
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
        const promises = Array.from(this.activeTasks.values()).map(task => task.promise);
        await Promise.all(promises);
    }

    /**
     * すべてのタスクをクリア
     */
    clear(): void {
        this.activeTasks.clear();
        this.completedResults.clear();
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
            totalMemoryUsage
        };
    }

    private async waitForAnyTaskCompletion(): Promise<void> {
        if (this.activeTasks.size === 0) {
            return;
        }

        const promises = Array.from(this.activeTasks.values()).map(task => task.promise);
        await Promise.race(promises);
    }

    private onTaskCompleted(chunkIndex: number, result: AudioResult): void {
        const task = this.activeTasks.get(chunkIndex);
        if (task) {
            const duration = Date.now() - task.startTime;
            logger.debug(`チャンク${chunkIndex}生成完了 (所要時間: ${duration}ms)`);
            
            this.activeTasks.delete(chunkIndex);
            this.completedResults.set(chunkIndex, result);
        }
    }

    private onTaskFailed(chunkIndex: number, error: Error): void {
        logger.error(`チャンク${chunkIndex}生成失敗: ${error.message}`);
        this.activeTasks.delete(chunkIndex);
        // エラーの場合は結果をストアしない（getResultで例外が発生）
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}