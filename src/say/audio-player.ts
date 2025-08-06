/**
 * src/say/audio-player.ts: 音声再生管理
 * speakerライブラリによるネイティブ音声出力を担当
 */

import Speaker from 'speaker';
import { writeFile } from 'fs/promises';
import type { AudioResult, Chunk } from './types.js';

export class AudioPlayer {
    private speaker: Speaker | null = null;
    private sampleRate: number = 24000;
    private channels: number = 1;
    private bitDepth: number = 16;

    async initialize(): Promise<boolean> {
        try {
            // speakerライブラリを使用（ネイティブ音声出力）
            this.speaker = new Speaker({
                channels: this.channels,
                bitDepth: this.bitDepth,
                sampleRate: this.sampleRate
            });
            
            console.error(`音声プレーヤー初期化: speakerライブラリ使用（ネイティブ出力）`);
            return true;
        } catch (error) {
            console.error(`音声プレーヤー初期化エラー: ${(error as Error).message}`);
            return false;
        }
    }

    /**
     * 音声ストリームを再生（speakerライブラリを使用）
     */
    async playAudioStream(audioResult: AudioResult): Promise<void> {
        if (!this.speaker) {
            throw new Error('音声プレーヤーが初期化されていません');
        }

        try {
            // WAVデータからPCMデータを抽出
            const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);
            
            // PCMデータを直接speakerに送信
            return new Promise((resolve, reject) => {
                // 新しいSpeakerインスタンスを作成（ストリーミング用）
                const streamSpeaker = new Speaker({
                    channels: this.channels,
                    bitDepth: this.bitDepth,
                    sampleRate: this.sampleRate
                });

                streamSpeaker.on('close', () => {
                    resolve();
                });

                streamSpeaker.on('error', (error) => {
                    reject(new Error(`音声再生エラー: ${error.message}`));
                });

                // PCMデータを書き込み
                streamSpeaker.write(Buffer.from(pcmData));
                streamSpeaker.end();
            });
            
        } catch (error) {
            throw new Error(`音声再生エラー: ${(error as Error).message}`);
        }
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