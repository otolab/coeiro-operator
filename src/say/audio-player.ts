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
import type { AudioResult, Chunk } from './types.js';

export class AudioPlayer {
    private speaker: Speaker | null = null;
    private synthesisRate: number = 24000;  // 音声生成時のサンプルレート
    private playbackRate: number = 48000;   // 再生時のサンプルレート
    private channels: number = 1;
    private bitDepth: number = 16;
    private echogardenInitialized: boolean = false;
    private noiseReductionEnabled: boolean = false;
    private lowpassFilterEnabled: boolean = false;
    private lowpassCutoff: number = 24000; // デフォルト24kHz
    private isInitialized = false;

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
    setLowpassFilter(enabled: boolean, cutoffFreq: number = 8000): void {
        this.lowpassFilterEnabled = enabled;
        this.lowpassCutoff = cutoffFreq;
    }

    /**
     * Echogardenの初期化
     */
    private async initializeEchogarden(): Promise<void> {
        try {
            this.echogardenInitialized = true;
            console.log('Echogarden初期化完了');
        } catch (error) {
            console.warn(`Echogarden初期化エラー: ${(error as Error).message}`);
            this.noiseReductionEnabled = false;
            this.echogardenInitialized = false;
        }
    }

    async initialize(): Promise<boolean> {
        try {
            // speakerライブラリを使用（ネイティブ音声出力）
            this.speaker = new Speaker({
                channels: this.channels,
                bitDepth: this.bitDepth,
                sampleRate: this.playbackRate
            });
            
            // ノイズ除去が有効な場合はEchogardenを初期化
            if (this.noiseReductionEnabled) {
                await this.initializeEchogarden();
            }
            
            console.error(`音声プレーヤー初期化: speakerライブラリ使用（ネイティブ出力）${this.noiseReductionEnabled ? ' + Echogarden' : ''}`);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error(`音声プレーヤー初期化エラー: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 音声ストリームを再生（ストリーミング処理パイプライン）
     */
    async playAudioStream(audioResult: AudioResult, bufferSize?: number): Promise<void> {
        if (!this.isInitialized) {
            throw new Error('AudioPlayer is not initialized');
        }

        try {
            // WAVデータからPCMデータを抽出
            const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
            
            // PCMデータのサイズ確認・調整
            if (pcmData.length === 0) {
                console.warn('PCMデータが空です');
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

        console.log(`リサンプリングストリーム: ${this.synthesisRate}Hz → ${this.playbackRate}Hz (SRC_SINC_MEDIUM_QUALITY)`);
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
                    console.warn(`ノイズリダクション処理エラー: ${(error as Error).message}`);
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
                    console.warn(`チャンク${audioResult.chunk.index}再生エラー:`, error);
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
     */
    private async playPCMData(pcmData: Uint8Array, bufferSize?: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const speaker = new Speaker({
                channels: 1,        // モノラル
                bitDepth: 16,       // 16bit
                sampleRate: this.synthesisRate,  // 音声生成時のサンプルレート
                // バッファサイズ制御（デフォルト：1024、範囲：256-8192）
                highWaterMark: bufferSize || 1024
            });

            speaker.on('close', () => {
                resolve();
            });

            speaker.on('error', (error) => {
                reject(error);
            });

            // PCMデータをスピーカーに書き込み
            speaker.end(Buffer.from(pcmData));
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
            console.warn(`ローパスフィルター処理エラー: ${(error as Error).message}`);
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
     * クロスフェード処理を適用
     */
    applyCrossfade(pcmData: Uint8Array, overlapSamples: number): Uint8Array {
        // 簡単なクロスフェード実装（音切れ軽減）
        // 副作用を避けるため、新しい配列を作成して返す
        const result = new Uint8Array(pcmData);
        
        if (overlapSamples > 0 && overlapSamples < pcmData.length / 2) {
            for (let i = 0; i < overlapSamples * 2; i += 2) {
                const factor = i / (overlapSamples * 2);
                const sample = (pcmData[i] | (pcmData[i + 1] << 8));
                const fadedSample = Math.floor(sample * factor);
                result[i] = fadedSample & 0xFF;
                result[i + 1] = (fadedSample >> 8) & 0xFF;
            }
        }
        
        return result;
    }
}