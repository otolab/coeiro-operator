/**
 * src/say/audio-player.ts: 音声再生管理
 * speakerライブラリを使用した直接音声再生を担当
 */

import Speaker from 'speaker';
import { writeFile } from 'fs/promises';
import type { AudioResult, Chunk } from './types.js';

export class AudioPlayer {
    private isInitialized = false;

    async initialize(): Promise<boolean> {
        try {
            // speakerライブラリ使用（ネイティブ音声デバイス直接出力）
            console.error(`音声プレーヤー初期化: speaker使用（ネイティブ音声再生）`);
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error(`音声プレーヤー初期化エラー: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 音声ファイルを再生
     */
    async playAudioFile(audioFile: string): Promise<void> {
        try {
            if (!this.isInitialized) {
                throw new Error('AudioPlayer is not initialized');
            }
            
            // WAVファイルを読み込んでPCMデータとして再生
            const fs = await import('fs/promises');
            const wavBuffer = await fs.readFile(audioFile);
            const pcmData = this.extractPCMFromWAV(wavBuffer.buffer as ArrayBuffer);
            
            return this.playPCMData(pcmData);
        } catch (error) {
            throw new Error(`音声再生エラー: ${(error as Error).message}`);
        }
    }

    /**
     * 音声ストリームを再生（メモリ上で直接再生）
     */
    async playAudioStream(audioResult: AudioResult, bufferSize?: number): Promise<void> {
        try {
            if (!this.isInitialized) {
                throw new Error('AudioPlayer is not initialized');
            }
            
            // PCMデータを抽出
            const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
            
            // speakerでPCMデータを直接再生（一時ファイル不要）
            return this.playPCMData(pcmData, bufferSize);
            
        } catch (error) {
            throw new Error(`音声再生エラー: ${(error as Error).message}`);
        }
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
                const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
                await this.playPCMData(pcmData, bufferSize);
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
                // PCMデータを抽出
                const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
                
                // 各チャンクを非同期で再生（順序は保たない、低レイテンシ優先）
                const playPromise = this.playPCMData(pcmData).catch((error: Error) => {
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
                sampleRate: 24000,  // COEIROINKのサンプリングレート
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