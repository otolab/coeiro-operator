/**
 * src/core/say/audio-stream-controller.ts: 音声ストリーム制御
 * 並行生成と順序再生の協調制御を担当
 */

import { logger } from '../../utils/logger.js';
import { ChunkGenerationManager, GenerationOptions } from './chunk-generation-manager.js';
import type { Chunk, AudioResult, OperatorVoice } from './types.js';

export interface StreamControllerOptions extends GenerationOptions {
    enableParallelGeneration: boolean; // 並行生成の有効/無効（デフォルト: false）
    bufferAheadCount: number;          // 先読みチャンク数（デフォルト: 1）
}

/**
 * 音声ストリーム制御クラス
 * 生成と再生の協調制御を行い、並行生成とシリアル再生を実現
 */
export class AudioStreamController {
    private generationManager: ChunkGenerationManager;
    private options: StreamControllerOptions;
    private synthesizeFunction: (chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number) => Promise<AudioResult>;

    constructor(
        synthesizeFunction: (chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number) => Promise<AudioResult>,
        options: Partial<StreamControllerOptions> = {}
    ) {
        this.synthesizeFunction = synthesizeFunction;
        this.options = {
            maxConcurrency: 2,
            delayBetweenRequests: 50,
            enableParallelGeneration: false,
            bufferAheadCount: 1,
            ...options
        };

        this.generationManager = new ChunkGenerationManager(
            synthesizeFunction,
            {
                maxConcurrency: this.options.maxConcurrency,
                delayBetweenRequests: this.options.delayBetweenRequests
            }
        );
    }

    /**
     * 並行生成対応の音声合成ジェネレータ
     */
    async* synthesizeStream(
        chunks: Chunk[],
        voiceInfo: string | OperatorVoice,
        speed: number
    ): AsyncGenerator<AudioResult> {
        if (!this.options.enableParallelGeneration) {
            // 従来の逐次生成
            yield* this.synthesizeStreamSequential(chunks, voiceInfo, speed);
            return;
        }

        // 並行生成モード
        yield* this.synthesizeStreamParallel(chunks, voiceInfo, speed);
    }

    /**
     * 逐次生成（従来の方式）
     */
    private async* synthesizeStreamSequential(
        chunks: Chunk[],
        voiceInfo: string | OperatorVoice,
        speed: number
    ): AsyncGenerator<AudioResult> {
        logger.debug('逐次生成モードで音声合成開始');
        
        for (const chunk of chunks) {
            logger.debug(`逐次生成: チャンク${chunk.index}処理中`);
            const result = await this.synthesizeFunction(chunk, voiceInfo, speed);
            yield result;
        }
        
        logger.debug('逐次生成モード完了');
    }

    /**
     * 並行生成（新方式）
     */
    private async* synthesizeStreamParallel(
        chunks: Chunk[],
        voiceInfo: string | OperatorVoice,
        speed: number
    ): AsyncGenerator<AudioResult> {
        logger.debug('並行生成モードで音声合成開始');
        
        if (chunks.length === 0) {
            return;
        }

        try {
            // 最初のチャンクは即座に開始
            await this.generationManager.startGeneration(chunks[0], voiceInfo, speed);
            
            let currentIndex = 0;
            
            while (currentIndex < chunks.length) {
                // 先読み生成の開始
                const nextIndex = currentIndex + 1;
                if (nextIndex < chunks.length && 
                    !this.generationManager.isInProgress(nextIndex) && 
                    !this.generationManager.isCompleted(nextIndex)) {
                    
                    // バッファ先読み数に基づいて生成開始
                    const generateUpTo = Math.min(
                        currentIndex + this.options.bufferAheadCount + 1,
                        chunks.length
                    );
                    
                    for (let i = nextIndex; i < generateUpTo; i++) {
                        if (!this.generationManager.isInProgress(i) && 
                            !this.generationManager.isCompleted(i)) {
                            await this.generationManager.startGeneration(chunks[i], voiceInfo, speed);
                        }
                    }
                }

                // 現在のチャンクの完了を待機してyield
                logger.debug(`並行生成: チャンク${currentIndex}結果待機中`);
                const result = await this.generationManager.getResult(currentIndex);
                
                logger.debug(`並行生成: チャンク${currentIndex}結果取得、yield開始`);
                yield result;
                
                currentIndex++;
            }
            
            logger.debug('並行生成モード完了');
            
        } catch (error) {
            logger.error(`並行生成エラー: ${(error as Error).message}`);
            throw error;
        } finally {
            // クリーンアップ
            this.generationManager.clear();
        }
    }

    /**
     * 並行生成の有効/無効を切り替え
     */
    setParallelGenerationEnabled(enabled: boolean): void {
        this.options.enableParallelGeneration = enabled;
        logger.info(`並行生成モード: ${enabled ? '有効' : '無効'}`);
    }

    /**
     * 並行生成オプションを更新
     */
    updateOptions(options: Partial<StreamControllerOptions>): void {
        this.options = { ...this.options, ...options };
        
        // GenerationManagerのオプションも更新
        this.generationManager = new ChunkGenerationManager(
            this.synthesizeFunction,
            {
                maxConcurrency: this.options.maxConcurrency,
                delayBetweenRequests: this.options.delayBetweenRequests
            }
        );
        
        logger.debug('AudioStreamController オプション更新', this.options);
    }

    /**
     * 現在の設定を取得
     */
    getOptions(): StreamControllerOptions {
        return { ...this.options };
    }

    /**
     * 生成統計情報を取得
     */
    getGenerationStats() {
        return this.generationManager.getStats();
    }

    /**
     * すべての生成タスクをクリア
     */
    clear(): void {
        this.generationManager.clear();
    }
}