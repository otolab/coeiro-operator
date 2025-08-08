/**
 * src/say/audio-player.ts: 音声再生管理
 * speakerライブラリによるネイティブ音声出力を担当
 */

import Speaker from 'speaker';
import { writeFile } from 'fs/promises';
import * as Echogarden from 'echogarden';
// @ts-ignore - dsp.jsには型定義がない
import DSP from 'dsp.js';
// @ts-ignore - node-libsamplerateには型定義がない
import SampleRate from 'node-libsamplerate';
import { Transform } from 'stream';
import type { AudioResult, Chunk, Config, AudioConfig } from './types.js';
import { logger } from '../utils/logger.js';
import {
    SAMPLE_RATES,
    AUDIO_FORMAT,
    BUFFER_SIZES,
    FILTER_SETTINGS,
    CROSSFADE_SETTINGS
} from './constants.js';

export class AudioPlayer {
    private speaker: Speaker | null = null;
    private synthesisRate: number = SAMPLE_RATES.SYNTHESIS;
    private playbackRate: number = SAMPLE_RATES.PLAYBACK;
    private channels: number = AUDIO_FORMAT.CHANNELS;
    private bitDepth: number = AUDIO_FORMAT.BIT_DEPTH;
    private echogardenInitialized: boolean = false;
    private noiseReductionEnabled: boolean = FILTER_SETTINGS.NOISE_REDUCTION_DEFAULT;
    private lowpassFilterEnabled: boolean = FILTER_SETTINGS.LOWPASS_FILTER_DEFAULT;
    private lowpassCutoff: number = FILTER_SETTINGS.LOWPASS_CUTOFF;
    private isInitialized = false;
    private audioConfig: AudioConfig;
    private config: Config;

    /**
     * AudioPlayerの初期化
     */
    constructor(config: Config) {
        this.config = config;
        this.audioConfig = this.getDefaultAudioConfig();
    }

    /**
     * デフォルトのaudio設定を取得
     */
    private getDefaultAudioConfig(): AudioConfig {
        const latencyMode = this.config.audio?.latencyMode || 'balanced';
        
        const presets = {
            'ultra-low': {
                bufferSettings: { 
                    highWaterMark: BUFFER_SIZES.PRESETS.ULTRA_LOW.HIGH_WATER_MARK, 
                    lowWaterMark: BUFFER_SIZES.PRESETS.ULTRA_LOW.LOW_WATER_MARK, 
                    dynamicAdjustment: true 
                },
                paddingSettings: PADDING_SETTINGS.PRESETS.ULTRA_LOW,
                crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.ULTRA_LOW
            },
            'balanced': {
                bufferSettings: { 
                    highWaterMark: BUFFER_SIZES.PRESETS.BALANCED.HIGH_WATER_MARK, 
                    lowWaterMark: BUFFER_SIZES.PRESETS.BALANCED.LOW_WATER_MARK, 
                    dynamicAdjustment: true 
                },
                paddingSettings: PADDING_SETTINGS.PRESETS.BALANCED,
                crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.BALANCED
            },
            'quality': {
                bufferSettings: { 
                    highWaterMark: BUFFER_SIZES.PRESETS.QUALITY.HIGH_WATER_MARK, 
                    lowWaterMark: BUFFER_SIZES.PRESETS.QUALITY.LOW_WATER_MARK, 
                    dynamicAdjustment: false 
                },
                paddingSettings: PADDING_SETTINGS.PRESETS.QUALITY,
                crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.QUALITY
            }
        };

        const preset = presets[latencyMode];
        return {
            latencyMode,
            bufferSettings: { ...preset.bufferSettings, ...this.config.audio?.bufferSettings },
            paddingSettings: { ...preset.paddingSettings, ...this.config.audio?.paddingSettings },
            crossfadeSettings: { ...preset.crossfadeSettings, ...this.config.audio?.crossfadeSettings }
        };
    }

    /**
     * 動的バッファサイズの計算
     */
    private calculateOptimalBufferSize(audioLength: number, chunkIndex: number = 0): number {
        if (!this.audioConfig.bufferSettings?.dynamicAdjustment) {
            return this.audioConfig.bufferSettings?.highWaterMark || 256;
        }

        // 音声長とチャンク位置に基づく動的調整
        if (chunkIndex === 0 && audioLength < 1000) {
            return Math.min(this.audioConfig.bufferSettings?.highWaterMark || 256, 64);
        }
        
        if (audioLength < 1000) return this.audioConfig.bufferSettings?.highWaterMark || 256;
        if (audioLength < 5000) return Math.max(this.audioConfig.bufferSettings?.highWaterMark || 256, 128);
        return Math.max(this.audioConfig.bufferSettings?.highWaterMark || 256, 256);
    }

    /**
     * 音声生成時のサンプルレートを設定
     */
    setSynthesisRate(synthesisRate: number): void {
        this.synthesisRate = synthesisRate;
    }

    /**
     * 再生時のサンプルレートを設定
     */
    setPlaybackRate(playbackRate: number): void {
        this.playbackRate = playbackRate;
    }

    /**
     * ノイズ除去機能を有効/無効に設定
     */
    setNoiseReduction(enabled: boolean): void {
        this.noiseReductionEnabled = enabled;
    }

    /**
     * ローパスフィルターを有効/無効に設定
     */
    setLowpassFilter(enabled: boolean, cutoffFreq: number = FILTER_SETTINGS.LOWPASS_CUTOFF): void {
        this.lowpassFilterEnabled = enabled;
        this.lowpassCutoff = cutoffFreq;
    }

    /**
     * Echogardenの初期化
     */
    private async initializeEchogarden(): Promise<void> {
        try {
            this.echogardenInitialized = true;
            logger.debug('Echogarden初期化完了');
        } catch (error) {
            logger.warn(`Echogarden初期化エラー: ${(error as Error).message}`);
            this.noiseReductionEnabled = false;
            this.echogardenInitialized = false;
        }
    }

    async initialize(): Promise<boolean> {
        try {
            // speakerライブラリを使用（ネイティブ音声出力）
            const bufferSize = this.audioConfig.bufferSettings?.highWaterMark || BUFFER_SIZES.PRESETS.BALANCED.HIGH_WATER_MARK;
            this.speaker = new Speaker({
                channels: this.channels,
                bitDepth: this.bitDepth,
                sampleRate: this.playbackRate,
                highWaterMark: bufferSize
            });
            
            // ノイズ除去が有効な場合はEchogardenを初期化
            if (this.noiseReductionEnabled) {
                await this.initializeEchogarden();
            }
            
            logger.info(`音声プレーヤー初期化: speakerライブラリ使用（ネイティブ出力）${this.noiseReductionEnabled ? ' + Echogarden' : ''}`);
            this.isInitialized = true;
            return true;
        } catch (error) {
            logger.error(`音声プレーヤー初期化エラー: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 音声ストリームを再生（ストリーミング処理パイプライン）
     */
    async playAudioStream(audioResult: AudioResult, bufferSize?: number): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('音声プレーヤーが初期化されていません');
        }

        try {
            // WAVデータからPCMデータを抽出
            const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
            
            // PCMデータのサイズ確認・調整
            if (pcmData.length === 0) {
                logger.warn('PCMデータが空です');
                return;
            }

            // 高品質処理が有効な場合はストリーミング処理パイプラインを使用
            if (this.noiseReductionEnabled || this.lowpassFilterEnabled || this.synthesisRate !== this.playbackRate) {
                return await this.processAudioStreamPipeline(pcmData);
            } else {
                // シンプルな直接再生
                return this.playPCMData(pcmData, bufferSize);
            }
            
        } catch (error) {
            throw new Error(`音声再生エラー: ${(error as Error).message}`);
        }
    }

    /**
     * ストリーミング音声処理パイプライン
     * 処理順序: 1) リサンプリング 2) ローパスフィルター 3) ノイズリダクション 4) Speaker出力
     */
    private async processAudioStreamPipeline(pcmData: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            const streamSpeaker = new Speaker({
                channels: this.channels,
                bitDepth: this.bitDepth,
                sampleRate: this.playbackRate
            });

            streamSpeaker.on('close', () => {
                resolve();
            });

            streamSpeaker.on('error', (error) => {
                reject(new Error(`音声再生エラー: ${error.message}`));
            });

            try {
                // 1. リサンプリング（Transform stream）
                const resampleTransform = this.createResampleTransform();
                
                // 2. ローパスフィルター（Transform stream）
                const lowpassTransform = this.createLowpassTransform();
                
                // 3. ノイズリダクション（Transform stream）
                const noiseReductionTransform = this.createNoiseReductionTransform();

                // パイプライン構築: リサンプリング → ローパス → ノイズ除去 → Speaker
                let pipeline = resampleTransform;
                
                if (this.lowpassFilterEnabled) {
                    pipeline = pipeline.pipe(lowpassTransform);
                }
                
                if (this.noiseReductionEnabled) {
                    pipeline = pipeline.pipe(noiseReductionTransform);
                }
                
                pipeline.pipe(streamSpeaker);

                // PCMデータをパイプラインに送信
                resampleTransform.write(Buffer.from(pcmData));
                resampleTransform.end();

            } catch (error) {
                reject(new Error(`パイプライン構築エラー: ${(error as Error).message}`));
            }
        });
    }

    /**
     * リサンプリング用Transform streamを作成
     */
    private createResampleTransform(): Transform {
        if (this.synthesisRate === this.playbackRate) {
            // サンプルレートが同じ場合はパススルー
            return new Transform({
                transform(chunk, encoding, callback) {
                    callback(null, chunk);
                }
            });
        }

        const resampleStream = new SampleRate({
            type: SampleRate.SRC_SINC_MEDIUM_QUALITY,
            channels: this.channels,
            fromRate: this.synthesisRate,
            fromDepth: this.bitDepth,
            toRate: this.playbackRate,
            toDepth: this.bitDepth
        });

        logger.debug(`リサンプリングストリーム: ${this.synthesisRate}Hz → ${this.playbackRate}Hz (SRC_SINC_MEDIUM_QUALITY)`);
        return resampleStream;
    }

    /**
     * ローパスフィルター用Transform streamを作成
     */
    private createLowpassTransform(): Transform {
        return new Transform({
            transform: (chunk, encoding, callback) => {
                try {
                    if (!this.lowpassFilterEnabled) {
                        callback(null, chunk);
                        return;
                    }

                    const pcmData = new Uint8Array(chunk);
                    const filteredData = this.applyLowpassFilterToChunk(pcmData);
                    callback(null, Buffer.from(filteredData));
                } catch (error) {
                    callback(error instanceof Error ? error : new Error(String(error)));
                }
            }
        });
    }

    /**
     * ノイズリダクション用Transform streamを作成
     */
    private createNoiseReductionTransform(): Transform {
        return new Transform({
            transform: async (chunk, encoding, callback) => {
                try {
                    if (!this.noiseReductionEnabled || !this.echogardenInitialized) {
                        callback(null, chunk);
                        return;
                    }

                    const pcmData = new Uint8Array(chunk);
                    const denoisedData = await this.applyNoiseReductionToChunk(pcmData);
                    callback(null, Buffer.from(denoisedData));
                } catch (error) {
                    logger.warn(`ノイズリダクション処理エラー: ${(error as Error).message}`);
                    callback(null, chunk); // エラー時は元データを返す
                }
            }
        });
    }

    /**
     * 真のストリーミング音声再生（非同期ジェネレータから直接再生）
     */
    async playStreamingAudio(audioStream: AsyncGenerator<AudioResult>, bufferSize?: number): Promise<void> {
        try {
            if (!this.isInitialized) {
                throw new Error('AudioPlayer is not initialized');
            }
            
            for await (const audioResult of audioStream) {
                // PCMデータを抽出して即座に再生
                await this.playAudioStream(audioResult, bufferSize);
            }
        } catch (error) {
            throw new Error(`ストリーミング音声再生エラー: ${(error as Error).message}`);
        }
    }

    /**
     * 並列ストリーミング再生（最初のチャンクから再生開始、以降は自動継続）
     */
    async playStreamingAudioParallel(audioStream: AsyncGenerator<AudioResult>): Promise<void> {
        try {
            if (!this.isInitialized) {
                throw new Error('AudioPlayer is not initialized');
            }
            
            const playQueue: Promise<void>[] = [];
            
            for await (const audioResult of audioStream) {
                // 各チャンクを非同期で再生（順序は保たない、低レイテンシ優先）
                const playPromise = this.playAudioStream(audioResult).catch((error: Error) => {
                    logger.warn(`チャンク${audioResult.chunk.index}再生エラー:`, error);
                });
                
                playQueue.push(playPromise);
                
                // 最大3チャンクまでの並列再生
                if (playQueue.length >= 3) {
                    await Promise.race(playQueue);
                    // 完了したプロミスを削除
                    const completedIndex = playQueue.findIndex(p => 
                        p === Promise.resolve()
                    );
                    if (completedIndex !== -1) {
                        playQueue.splice(completedIndex, 1);
                    }
                }
            }
            
            // 残りのチャンクの再生完了を待機
            await Promise.all(playQueue);
            
        } catch (error) {
            throw new Error(`並列ストリーミング音声再生エラー: ${(error as Error).message}`);
        }
    }

    /**
     * PCMデータを直接スピーカーに再生
     * synthesis/playbackレートが異なる場合は適切なSpeaker設定を使用
     */
    private async playPCMData(pcmData: Uint8Array, bufferSize?: number, chunk?: Chunk): Promise<void> {
        return new Promise((resolve, reject) => {
            // synthesisRateとplaybackRateが異なる場合は、実際の生成レートを使用
            const actualSampleRate = this.synthesisRate === this.playbackRate ? 
                this.playbackRate : this.synthesisRate;
                
            const speaker = new Speaker({
                channels: AUDIO_FORMAT.CHANNELS,
                bitDepth: AUDIO_FORMAT.BIT_DEPTH,
                sampleRate: actualSampleRate,  // 実際のデータのサンプルレート
                // バッファサイズ制御（デフォルト：1024、範囲：256-8192）
                highWaterMark: bufferSize || BUFFER_SIZES.DEFAULT
            });

            speaker.on('close', () => {
                resolve();
            });

            speaker.on('error', (error) => {
                reject(error);
            });

            // クロスフェード処理を適用（設定に基づく）
            let processedData = pcmData;
            if (this.audioConfig.crossfadeSettings?.enabled && chunk) {
                const skipFirst = this.audioConfig.crossfadeSettings.skipFirstChunk && chunk.isFirst;
                if (!skipFirst) {
                    const overlapSamples = this.audioConfig.crossfadeSettings.overlapSamples || 24;
                    processedData = this.applyCrossfade(pcmData, overlapSamples, chunk.isFirst);
                }
            }

            // PCMデータをスピーカーに書き込み
            speaker.end(Buffer.from(processedData));
        });
    }

    /**
     * 音声ファイルを保存
     */
    async saveAudio(audioBuffer: ArrayBuffer, outputFile: string): Promise<void> {
        try {
            await writeFile(outputFile, Buffer.from(audioBuffer));
        } catch (error) {
            throw new Error(`音声ファイル保存エラー: ${(error as Error).message}`);
        }
    }

    /**
     * チャンク単位のローパスフィルター処理
     */
    private applyLowpassFilterToChunk(pcmData: Uint8Array): Uint8Array {
        try {
            const samplesCount = pcmData.length / 2;
            const audioSamples = new Float32Array(samplesCount);
            
            for (let i = 0; i < samplesCount; i++) {
                const sampleIndex = i * 2;
                const sample = pcmData[sampleIndex] | (pcmData[sampleIndex + 1] << 8);
                audioSamples[i] = (sample < 32768 ? sample : sample - 65536) / 32768.0;
            }

            // ローパスフィルターを適用
            const lowpassFilter = new DSP.IIRFilter(DSP.LOWPASS, this.lowpassCutoff, this.playbackRate, 1);
            lowpassFilter.process(audioSamples);

            // Float32ArrayをPCMデータに戻す
            const processedData = new Uint8Array(pcmData.length);
            for (let i = 0; i < samplesCount; i++) {
                const sample = Math.max(-1.0, Math.min(1.0, audioSamples[i]));
                const intSample = Math.floor(sample * 32767);
                const outputIndex = i * 2;
                processedData[outputIndex] = intSample & 0xFF;
                processedData[outputIndex + 1] = (intSample >> 8) & 0xFF;
            }

            return processedData;
        } catch (error) {
            logger.warn(`ローパスフィルター処理エラー: ${(error as Error).message}`);
            return pcmData;
        }
    }

    /**
     * チャンク単位のノイズリダクション処理
     */
    private async applyNoiseReductionToChunk(pcmData: Uint8Array): Promise<Uint8Array> {
        try {
            const samplesCount = pcmData.length / 2;
            const audioSamples = new Float32Array(samplesCount);
            
            for (let i = 0; i < samplesCount; i++) {
                const sampleIndex = i * 2;
                const sample = pcmData[sampleIndex] | (pcmData[sampleIndex + 1] << 8);
                audioSamples[i] = (sample < 32768 ? sample : sample - 65536) / 32768.0;
            }

            const rawAudio = {
                audioChannels: [audioSamples],
                sampleRate: this.playbackRate
            };
            
            const result = await Echogarden.denoise(rawAudio, {
                engine: 'rnnoise'
            });

            const processedData = new Uint8Array(pcmData.length);
            const denoisedSamples = result.denoisedAudio.audioChannels[0];
            for (let i = 0; i < samplesCount; i++) {
                const sample = Math.max(-1.0, Math.min(1.0, denoisedSamples[i]));
                const intSample = Math.floor(sample * 32767);
                const outputIndex = i * 2;
                processedData[outputIndex] = intSample & 0xFF;
                processedData[outputIndex + 1] = (intSample >> 8) & 0xFF;
            }

            return processedData;
        } catch (error) {
            console.warn(`ノイズリダクション処理エラー: ${(error as Error).message}`);
            return pcmData;
        }
    }

    /**
     * WAVヘッダーを除去してPCMデータを抽出
     */
    extractPCMFromWAV(wavBuffer: ArrayBuffer): Uint8Array {
        const view = new DataView(wavBuffer);
        
        // WAVヘッダーの検証とデータ位置の特定
        if (view.getUint32(0, false) !== 0x52494646) { // "RIFF"
            throw new Error('Invalid WAV file');
        }
        
        let dataOffset = 12; // RIFFヘッダー後
        while (dataOffset < wavBuffer.byteLength - 8) {
            const chunkType = view.getUint32(dataOffset, false);
            const chunkSize = view.getUint32(dataOffset + 4, true);
            
            if (chunkType === 0x64617461) { // "data"
                // データチャンクが見つかった
                const pcmData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + chunkSize);
                return new Uint8Array(pcmData);
            }
            
            dataOffset += 8 + chunkSize;
        }
        
        throw new Error('WAV data chunk not found');
    }

    /**
     * クロスフェード処理を適用（改良版）
     */
    applyCrossfade(pcmData: Uint8Array, overlapSamples: number, isFirstChunk: boolean = false): Uint8Array {
        // 副作用を避けるため、新しい配列を作成して返す
        const result = new Uint8Array(pcmData);
        
        // 先頭チャンクで音声途切れを防ぐため、条件を厳格化
        if (overlapSamples > 0 && overlapSamples < pcmData.length / 2 && !isFirstChunk) {
            for (let i = 0; i < overlapSamples * 2; i += 2) {
                // より自然なフェード曲線（smoothstep）を使用
                const t = i / (overlapSamples * 2);
                const factor = this.smoothstep(t);
                
                const sample = (pcmData[i] | (pcmData[i + 1] << 8));
                // 符号付き16bit整数として扱う
                const signedSample = sample < 32768 ? sample : sample - 65536;
                const fadedSample = Math.floor(signedSample * factor);
                
                // 16bit範囲でクランプして無符号に戻す
                const clampedSample = Math.max(-32768, Math.min(32767, fadedSample));
                const unsignedSample = clampedSample < 0 ? clampedSample + 65536 : clampedSample;
                
                result[i] = unsignedSample & 0xFF;
                result[i + 1] = (unsignedSample >> 8) & 0xFF;
            }
        }
        
        return result;
    }

    /**
     * より自然なフェード曲線（smoothstep関数）
     */
    private smoothstep(t: number): number {
        // t * t * (3 - 2 * t) でイーズイン・イーズアウト
        const clamped = Math.max(0, Math.min(1, t));
        return clamped * clamped * (3 - 2 * clamped);
    }
}