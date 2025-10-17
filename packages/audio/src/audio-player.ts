/**
 * src/say/audio-player.ts: 音声再生管理
 * @echogarden/audio-ioによる音声出力を担当
 */

import { writeFile } from 'fs/promises';
import * as Echogarden from 'echogarden';
// @ts-expect-error - dsp.jsには型定義がない
import DSP from 'dsp.js';
import { Transform } from 'stream';
import { createAudioOutput, type AudioOutput } from '@echogarden/audio-io';
import type { AudioResult, Chunk, Config, AudioConfig } from './types.js';
import { logger } from '@coeiro-operator/common';
import { OpenPromise } from './open-promise.js';
import {
  SAMPLE_RATES,
  AUDIO_FORMAT,
  BUFFER_SIZES,
  FILTER_SETTINGS,
  CROSSFADE_SETTINGS,
  PADDING_SETTINGS,
} from './constants.js';

export class AudioPlayer {
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

  // チャンク境界での停止制御フラグ
  private shouldStop: boolean = false;

  // @echogarden/audio-io関連
  private audioOutput: AudioOutput | null = null;
  private chunkQueue: Int16Array[] = [];
  private currentChunkOffset: number = 0;
  private completionPromise: OpenPromise<void> | null = null;

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
          dynamicAdjustment: true,
        },
        paddingSettings: PADDING_SETTINGS.PRESETS.ULTRA_LOW,
        crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.ULTRA_LOW,
      },
      balanced: {
        bufferSettings: {
          highWaterMark: BUFFER_SIZES.PRESETS.BALANCED.HIGH_WATER_MARK,
          lowWaterMark: BUFFER_SIZES.PRESETS.BALANCED.LOW_WATER_MARK,
          dynamicAdjustment: true,
        },
        paddingSettings: PADDING_SETTINGS.PRESETS.BALANCED,
        crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.BALANCED,
      },
      quality: {
        bufferSettings: {
          highWaterMark: BUFFER_SIZES.PRESETS.QUALITY.HIGH_WATER_MARK,
          lowWaterMark: BUFFER_SIZES.PRESETS.QUALITY.LOW_WATER_MARK,
          dynamicAdjustment: false,
        },
        paddingSettings: PADDING_SETTINGS.PRESETS.QUALITY,
        crossfadeSettings: CROSSFADE_SETTINGS.PRESETS.QUALITY,
      },
    };

    const preset = presets[latencyMode];
    return {
      latencyMode,
      bufferSettings: { ...preset.bufferSettings, ...this.config.audio?.bufferSettings },
      paddingSettings: { ...preset.paddingSettings, ...this.config.audio?.paddingSettings },
      crossfadeSettings: { ...preset.crossfadeSettings, ...this.config.audio?.crossfadeSettings },
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
    if (audioLength < 5000)
      return Math.max(this.audioConfig.bufferSettings?.highWaterMark || 256, 128);
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
      // ノイズ除去が有効な場合はEchogardenを初期化
      if (this.noiseReductionEnabled) {
        await this.initializeEchogarden();
      }

      logger.info(
        `音声プレーヤー初期化: @echogarden/audio-io使用（プリコンパイル済みバイナリ）${this.noiseReductionEnabled ? ' + Echogarden' : ''}`
      );

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
      logger.log(`音声再生: チャンク${audioResult.chunk.index}`);

      // WAVデータからPCMデータを抽出
      const pcmData = this.extractPCMFromWAV(audioResult.audioBuffer);

      // PCMデータのサイズ確認・調整
      if (pcmData.length === 0) {
        logger.warn('PCMデータが空です');
        return;
      }

      // 高品質処理が有効な場合はストリーミング処理パイプラインを使用
      if (
        this.noiseReductionEnabled ||
        this.lowpassFilterEnabled ||
        this.synthesisRate !== this.playbackRate
      ) {
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
   * 処理順序: 1) リサンプリング 2) ローパスフィルター 3) ノイズリダクション 4) 出力
   */
  private async processAudioStreamPipeline(pcmData: Uint8Array): Promise<void> {
    logger.log('高品質音声処理パイプライン開始');

    // Transform streamを通して処理し、最終的にキューに追加
    const processedChunks: Buffer[] = [];

    try {
      // 1. リサンプリング（Transform stream）
      const resampleTransform = this.createResampleTransform();

      // 2. ローパスフィルター（Transform stream）
      const lowpassTransform = this.createLowpassTransform();

      // 3. ノイズリダクション（Transform stream）
      const noiseReductionTransform = this.createNoiseReductionTransform();

      // パイプライン構築: リサンプリング → ローパス → ノイズ除去
      let pipeline = resampleTransform;

      if (this.lowpassFilterEnabled) {
        pipeline = pipeline.pipe(lowpassTransform);
      }

      if (this.noiseReductionEnabled) {
        pipeline = pipeline.pipe(noiseReductionTransform);
      }

      // パイプラインの出力を収集
      return new Promise((resolve, reject) => {
        pipeline.on('data', (chunk: Buffer) => {
          processedChunks.push(chunk);
        });

        pipeline.on('end', async () => {
          // すべての処理済みデータを結合
          const combinedBuffer = Buffer.concat(processedChunks);
          const int16Data = this.convertToInt16Array(new Uint8Array(combinedBuffer));

          // AudioOutputを遅延作成
          await this.ensureAudioOutput();

          // チャンクをキューに追加
          this.chunkQueue.push(int16Data);
          logger.debug(`処理済みチャンクをキューに追加、現在のキューサイズ: ${this.chunkQueue.length}`);

          resolve();
        });

        pipeline.on('error', (error: Error) => {
          reject(new Error(`パイプライン処理エラー: ${error.message}`));
        });

        // PCMデータをパイプラインに送信
        resampleTransform.write(Buffer.from(pcmData));
        resampleTransform.end();
      });
    } catch (error) {
      throw new Error(`パイプライン構築エラー: ${(error as Error).message}`);
    }
  }

  /**
   * リサンプリング用Transform streamを作成
   */
  private createResampleTransform(): Transform {
    // サンプルレートが同じ場合はパススルー
    if (this.synthesisRate === this.playbackRate) {
      return new Transform({
        transform(chunk, encoding, callback) {
          callback(null, chunk);
        },
      });
    }

    // 簡易的な線形補間によるリサンプリング実装
    const ratio = this.playbackRate / this.synthesisRate;
    logger.log(`リサンプリング: ${this.synthesisRate}Hz → ${this.playbackRate}Hz (比率: ${ratio})`);

    return new Transform({
      transform: (chunk, encoding, callback) => {
        try {
          const inputBuffer = Buffer.from(chunk);
          const inputSamples = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.length / 2);
          
          // 出力サンプル数を計算
          const outputLength = Math.floor(inputSamples.length * ratio);
          const outputSamples = new Int16Array(outputLength);
          
          // 線形補間によるリサンプリング
          for (let i = 0; i < outputLength; i++) {
            const srcIndex = i / ratio;
            const srcIndexInt = Math.floor(srcIndex);
            const fraction = srcIndex - srcIndexInt;
            
            if (srcIndexInt < inputSamples.length - 1) {
              // 線形補間
              const sample1 = inputSamples[srcIndexInt];
              const sample2 = inputSamples[srcIndexInt + 1];
              outputSamples[i] = Math.round(sample1 * (1 - fraction) + sample2 * fraction);
            } else if (srcIndexInt < inputSamples.length) {
              // 最後のサンプル
              outputSamples[i] = inputSamples[srcIndexInt];
            } else {
              // パディング（無音）
              outputSamples[i] = 0;
            }
          }
          
          const outputBuffer = Buffer.from(outputSamples.buffer);
          callback(null, outputBuffer);
        } catch (error) {
          logger.error(`リサンプリングエラー: ${(error as Error).message}`);
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
    });
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
      },
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
      },
    });
  }

  /**
   * 真のストリーミング音声再生（非同期ジェネレータから直接再生）
   */
  async playStreamingAudio(
    audioStream: AsyncGenerator<AudioResult>,
    bufferSize?: number
  ): Promise<void> {
    try {
      if (!this.isInitialized) {
        throw new Error('AudioPlayer is not initialized');
      }

      // 再生開始時に停止フラグをリセット
      this.shouldStop = false;

      // 新しい完了Promiseを作成
      this.completionPromise = new OpenPromise<void>();

      for await (const audioResult of audioStream) {
        // チャンク境界で停止チェック
        if (this.shouldStop) {
          logger.info('チャンク境界で再生を停止しました');
          break;
        }

        // PCMデータを抽出して即座に再生
        await this.playAudioStream(audioResult, bufferSize);
      }

      // すべてのチャンクが再生されるまで待機
      await this.waitForCompletion();
    } catch (error) {
      throw new Error(`ストリーミング音声再生エラー: ${(error as Error).message}`);
    }
  }

  /**
   * キューが空になるまで待機（@echogarden/audio-io用）
   */
  private async waitForCompletion(): Promise<void> {
    if (!this.audioOutput) return;

    // キューが既に空の場合は即座に完了
    if (this.chunkQueue.length === 0 && this.currentChunkOffset === 0) {
      return;
    }

    // OpenPromiseがまだない場合は作成
    if (!this.completionPromise || !this.completionPromise.isPending) {
      this.completionPromise = new OpenPromise<void>();
    }

    return this.completionPromise.promise;
  }


  /**
   * @echogarden/audio-io用のaudioOutputを遅延作成
   */
  private async ensureAudioOutput(): Promise<void> {
    if (!this.audioOutput) {
      logger.debug('AudioOutput作成中...');

      // bufferDurationの計算（latencyModeに基づく）
      let bufferDuration: number;
      switch (this.audioConfig.latencyMode) {
        case 'ultra-low':
          bufferDuration = 20; // 20ms
          break;
        case 'quality':
          bufferDuration = 200; // 200ms
          break;
        default: // balanced
          bufferDuration = 100; // 100ms
      }

      this.audioOutput = await createAudioOutput({
        sampleRate: this.playbackRate,
        channelCount: this.channels,
        bufferDuration,
      }, this.audioOutputHandler);

      logger.info(`AudioOutput作成完了: ${this.playbackRate}Hz, ${this.channels}ch, buffer: ${bufferDuration}ms`);
    }
  }

  /**
   * @echogarden/audio-io用のコールバックハンドラ
   */
  private audioOutputHandler = (outputBuffer: Int16Array): void => {
    let bufferOffset = 0;

    while (bufferOffset < outputBuffer.length && !this.shouldStop) {
      if (this.chunkQueue.length > 0) {
        const currentChunk = this.chunkQueue[0];
        const remainingInChunk = currentChunk.length - this.currentChunkOffset;
        const remainingInBuffer = outputBuffer.length - bufferOffset;
        const copyLength = Math.min(remainingInChunk, remainingInBuffer);

        // データをコピー
        outputBuffer.set(
          currentChunk.subarray(this.currentChunkOffset, this.currentChunkOffset + copyLength),
          bufferOffset
        );

        bufferOffset += copyLength;
        this.currentChunkOffset += copyLength;

        // チャンクを使い切ったら次へ
        if (this.currentChunkOffset >= currentChunk.length) {
          this.chunkQueue.shift();
          this.currentChunkOffset = 0;
          logger.debug(`チャンク消費完了、残りキュー: ${this.chunkQueue.length}`);
        }
      } else {
        // キューが空なら無音で埋める
        outputBuffer.fill(0, bufferOffset);

        // キューが空になったら完了を通知
        if (this.completionPromise && this.completionPromise.isPending) {
          this.completionPromise.resolve();
        }
        break;
      }
    }

    // 停止フラグが立っていたら無音で埋める
    if (this.shouldStop) {
      outputBuffer.fill(0, bufferOffset);

      // 停止時も完了を通知
      if (this.completionPromise && this.completionPromise.isPending) {
        this.completionPromise.resolve();
      }
    }
  };

  /**
   * Uint8ArrayからInt16Arrayに変換（リトルエンディアン）
   */
  private convertToInt16Array(pcmData: Uint8Array): Int16Array {
    const int16Data = new Int16Array(pcmData.length / 2);
    for (let i = 0; i < int16Data.length; i++) {
      const low = pcmData[i * 2];
      const high = pcmData[i * 2 + 1];
      // リトルエンディアンで16bit整数を構築
      int16Data[i] = (high << 8) | low;
      // 符号付き整数に変換（-32768 ~ 32767）
      if (int16Data[i] >= 32768) {
        int16Data[i] -= 65536;
      }
    }
    return int16Data;
  }



  /**
   * PCMデータを音声出力キューに追加
   */
  private async playPCMData(
    pcmData: Uint8Array,
    bufferSize?: number,
    chunk?: Chunk
  ): Promise<void> {
    // AudioOutputを遅延作成
    await this.ensureAudioOutput();

    // クロスフェード処理を適用（設定に基づく）
    let processedData = pcmData;
    const crossfadeEnabled = this.audioConfig.crossfadeSettings?.enabled && chunk;

    if (crossfadeEnabled) {
      const skipFirst = this.audioConfig.crossfadeSettings?.skipFirstChunk && chunk?.isFirst;
      if (!skipFirst) {
        const overlapSamples = this.audioConfig.crossfadeSettings?.overlapSamples || 24;
        processedData = this.applyCrossfade(pcmData, overlapSamples, chunk?.isFirst || false);
      }
    }

    // PCMデータをInt16Arrayに変換
    const int16Data = this.convertToInt16Array(processedData);

    // チャンクをキューに追加
    this.chunkQueue.push(int16Data);
    logger.debug(`チャンクをキューに追加、現在のキューサイズ: ${this.chunkQueue.length}`);

    // コールバックベースなので、ここでは追加のみ
    // 実際の再生はaudioOutputHandlerで処理される
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
      const lowpassFilter = new DSP.IIRFilter(
        DSP.LOWPASS,
        this.lowpassCutoff,
        this.playbackRate,
        1
      );
      lowpassFilter.process(audioSamples);

      // Float32ArrayをPCMデータに戻す
      const processedData = new Uint8Array(pcmData.length);
      for (let i = 0; i < samplesCount; i++) {
        const sample = Math.max(-1.0, Math.min(1.0, audioSamples[i]));
        const intSample = Math.floor(sample * 32767);
        const outputIndex = i * 2;
        processedData[outputIndex] = intSample & 0xff;
        processedData[outputIndex + 1] = (intSample >> 8) & 0xff;
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
        sampleRate: this.playbackRate,
      };

      const result = await Echogarden.denoise(rawAudio, {
        engine: 'rnnoise',
      });

      const processedData = new Uint8Array(pcmData.length);
      const denoisedSamples = result.denoisedAudio.audioChannels[0];
      for (let i = 0; i < samplesCount; i++) {
        const sample = Math.max(-1.0, Math.min(1.0, denoisedSamples[i]));
        const intSample = Math.floor(sample * 32767);
        const outputIndex = i * 2;
        processedData[outputIndex] = intSample & 0xff;
        processedData[outputIndex + 1] = (intSample >> 8) & 0xff;
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
    if (view.getUint32(0, false) !== 0x52494646) {
      // "RIFF"
      throw new Error('Invalid WAV file');
    }

    let dataOffset = 12; // RIFFヘッダー後
    while (dataOffset < wavBuffer.byteLength - 8) {
      const chunkType = view.getUint32(dataOffset, false);
      const chunkSize = view.getUint32(dataOffset + 4, true);

      if (chunkType === 0x64617461) {
        // "data"
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
  applyCrossfade(
    pcmData: Uint8Array,
    overlapSamples: number,
    isFirstChunk: boolean = false
  ): Uint8Array {
    // 副作用を避けるため、新しい配列を作成して返す
    const result = new Uint8Array(pcmData);

    // 先頭チャンクで音声途切れを防ぐため、条件を厳格化
    if (overlapSamples > 0 && overlapSamples < pcmData.length / 2 && !isFirstChunk) {
      for (let i = 0; i < overlapSamples * 2; i += 2) {
        // より自然なフェード曲線（smoothstep）を使用
        const t = i / (overlapSamples * 2);
        const factor = this.smoothstep(t);

        const sample = pcmData[i] | (pcmData[i + 1] << 8);
        // 符号付き16bit整数として扱う
        const signedSample = sample < 32768 ? sample : sample - 65536;
        const fadedSample = Math.floor(signedSample * factor);

        // 16bit範囲でクランプして無符号に戻す
        const clampedSample = Math.max(-32768, Math.min(32767, fadedSample));
        const unsignedSample = clampedSample < 0 ? clampedSample + 65536 : clampedSample;

        result[i] = unsignedSample & 0xff;
        result[i + 1] = (unsignedSample >> 8) & 0xff;
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

  /**
   * 無音PCMデータを生成
   * @param durationMs 無音の長さ（ミリ秒）
   * @param sampleRate サンプルレート（デフォルト：24000Hz）
   * @returns 無音のPCMデータ
   */
  generateSilentPCM(
    durationMs: number = 100,
    sampleRate: number = SAMPLE_RATES.SYNTHESIS
  ): Uint8Array {
    const samplesCount = Math.floor((sampleRate * durationMs) / 1000);
    const bytesCount = samplesCount * 2; // 16bit = 2bytes per sample
    return new Uint8Array(bytesCount); // すべて0で初期化される（無音）
  }

  /**
   * ドライバーウォームアップ用の無音再生
   * 短い無音を再生してSpeakerドライバーを起動・安定化
   */
  async warmupAudioDriver(): Promise<void> {
    if (!this.isInitialized) {
      logger.warn('AudioPlayer未初期化のためウォームアップをスキップ');
      return;
    }

    try {
      logger.debug('ドライバーウォームアップ開始（無音再生）');
      const silentPCM = this.generateSilentPCM(100); // 100ms無音
      await this.playPCMData(silentPCM, BUFFER_SIZES.PRESETS.ULTRA_LOW.HIGH_WATER_MARK);
      logger.debug('ドライバーウォームアップ完了');
    } catch (error) {
      logger.warn(`ドライバーウォームアップエラー: ${(error as Error).message}`);
      // エラーが発生しても処理を継続（ウォームアップは補助機能）
    }
  }

  /**
   * 音声再生の停止（チャンク境界で停止）
   * 現在再生中のチャンクは最後まで再生され、次のチャンクから停止します
   */
  async stopPlayback(): Promise<void> {
    logger.info('音声再生の停止要求を受信しました');
    this.shouldStop = true;

    // キューをクリア
    this.chunkQueue = [];
    this.currentChunkOffset = 0;
  }

  /**
   * AudioPlayerのクリーンアップ（リソース解放）
   * 長時間運用やシャットダウン時に呼び出し
   */
  async cleanup(): Promise<void> {
    logger.debug('AudioPlayer cleanup開始');

    try {
      // AudioOutputの破棄
      if (this.audioOutput) {
        await this.audioOutput.dispose();
        this.audioOutput = null;
        this.chunkQueue = [];
        this.currentChunkOffset = 0;
      }

      // Echogardenリソースの解放
      if (this.echogardenInitialized) {
        // Echogardenには明示的なクリーンアップメソッドがないため、フラグのみリセット
        this.echogardenInitialized = false;
      }

      this.isInitialized = false;
      logger.info('AudioPlayer cleanup完了');
    } catch (error) {
      logger.warn(`AudioPlayer cleanup warning: ${(error as Error).message}`);
    }
  }
}
