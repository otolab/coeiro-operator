/**
 * synthesis-processor.ts: 音声合成処理を担当
 */

import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { logger } from '@coeiro-operator/common';
import { BUFFER_SIZES, FILTER_SETTINGS } from './constants.js';
import { convertToSpeed, validateSpeedParameters } from './speed-utils.js';
import type {
  Config,
  ProcessingOptions,
  SynthesizeResult,
  SpeakSettings,
} from './types.js';

export class SynthesisProcessor {
  constructor(
    private config: Config,
    private audioPlayer: AudioPlayer,
    private audioSynthesizer: AudioSynthesizer
  ) {}

  /**
   * AudioPlayerの初期化と設定
   */
  async initializeAudioPlayer(): Promise<boolean> {
    // プリセットベースの設定がaudio-player.ts内で適用されるため、
    // 個別設定の上書きのみここで行う
    const audioConfig = this.config.audio;

    if (audioConfig?.processing?.synthesisRate) {
      this.audioPlayer.setSynthesisRate(audioConfig.processing.synthesisRate);
    }

    if (audioConfig?.processing?.playbackRate) {
      this.audioPlayer.setPlaybackRate(audioConfig.processing.playbackRate);
    }

    if (audioConfig?.processing?.noiseReduction !== undefined) {
      this.audioPlayer.setNoiseReduction(audioConfig.processing.noiseReduction);
    }

    if (audioConfig?.processing?.lowpassFilter !== undefined) {
      const cutoff = audioConfig.processing.lowpassCutoff || FILTER_SETTINGS.LOWPASS_CUTOFF;
      this.audioPlayer.setLowpassFilter(audioConfig.processing.lowpassFilter, cutoff);
    }

    return await this.audioPlayer.initialize();
  }

  /**
   * 音声合成処理のメインメソッド
   * @param text 合成するテキスト
   * @param speakSettings 音声生成パラメータ
   * @param processingOptions 処理制御オプション
   */
  async process(
    text: string,
    speakSettings: SpeakSettings,
    processingOptions: ProcessingOptions = {}
  ): Promise<SynthesizeResult> {
    logger.info(
      `音声合成開始: テキスト="${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
    );
    logger.debug(`SpeakSettings:`, speakSettings);
    logger.debug(`ProcessingOptions:`, processingOptions);

    // サーバー接続確認を最初に行う
    await this.validateServerConnection();

    // オプション解析
    const resolvedOptions = this.resolveOptions(processingOptions);

    // 出力モードに応じた処理
    if (resolvedOptions.outputFile) {
      return await this.processFileOutput(
        text,
        speakSettings,
        resolvedOptions.chunkMode,
        resolvedOptions.outputFile
      );
    } else {
      return await this.processStreamingOutput(
        text,
        speakSettings,
        resolvedOptions.chunkMode,
        resolvedOptions.bufferSize
      );
    }
  }

  /**
   * オプション解析
   */
  private resolveOptions(options: ProcessingOptions): {
    outputFile: string | null;
    chunkMode: any;
    bufferSize: number;
  } {
    const resolved = {
      outputFile: options.outputFile || null,
      chunkMode: options.chunkMode || this.config.audio?.splitMode || 'punctuation',
      bufferSize: options.bufferSize || this.config.audio?.bufferSize || BUFFER_SIZES.DEFAULT,
    };

    logger.debug('=== PROCESSING OPTIONS DEBUG ===');
    logger.debug(`Resolved options:`);
    logger.debug(
      `  chunkMode: ${resolved.chunkMode} (from: ${options.chunkMode ? 'options' : 'config.audio.splitMode fallback'})`
    );
    logger.debug(`  config.audio.splitMode: ${this.config.audio?.splitMode || 'undefined'}`);
    logger.debug(`  bufferSize: ${resolved.bufferSize}`);

    return resolved;
  }

  /**
   * サーバー接続確認
   */
  private async validateServerConnection(): Promise<void> {
    if (!(await this.audioSynthesizer.checkServerConnection())) {
      const host = this.config.connection?.host || 'localhost';
      const port = this.config.connection?.port || '50032';
      logger.error(`COEIROINKサーバーに接続できません: http://${host}:${port}`);
      throw new Error(`Cannot connect to COEIROINK server (http://${host}:${port})`);
    }
  }

  /**
   * ファイル出力処理
   */
  private async processFileOutput(
    text: string,
    speakSettings: SpeakSettings,
    chunkMode: any,
    outputFile: string
  ): Promise<SynthesizeResult> {
    logger.info(`ファイル出力モード: ${outputFile}`);

    // Step 1: 音声合成（データ生成のみ）
    logger.info('音声データ生成開始...');
    logger.debug(`合成パラメータ - chunkMode: ${chunkMode}, speed: ${speakSettings.speed}`);
    const generator = this.audioSynthesizer.synthesizeStream(text, speakSettings, chunkMode);

    // Step 2: データ収集（フラットな処理）
    logger.info('音声データ収集中...');
    const audioChunks: ArrayBuffer[] = [];
    for await (const audioResult of generator) {
      audioChunks.push(audioResult.audioBuffer);
    }

    // Step 3: データ結合
    logger.info('音声データ結合中...');
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedBuffer = new ArrayBuffer(totalLength);
    const view = new Uint8Array(combinedBuffer);
    let offset = 0;

    for (const chunk of audioChunks) {
      view.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    // Step 4: ファイル保存（フラットな呼び出し）
    logger.info('ファイル保存中...');
    await this.audioPlayer.saveAudio(combinedBuffer, outputFile);

    logger.info(`ファイル出力完了: ${outputFile}`);
    return { success: true, outputFile, mode: 'file' };
  }

  /**
   * ストリーミング再生処理
   */
  private async processStreamingOutput(
    text: string,
    speakSettings: SpeakSettings,
    chunkMode: any,
    bufferSize: number
  ): Promise<SynthesizeResult> {
    logger.info('ストリーミング再生モード');

    // Step 1: 音声合成（データ生成のみ）
    logger.info('音声合成開始...');
    logger.debug(`合成パラメータ - chunkMode: ${chunkMode}, speed: ${speakSettings.speed}`);
    const generator = this.audioSynthesizer.synthesizeStream(text, speakSettings, chunkMode);

    // Step 2: 音声再生（再生のみ） - フラットな呼び出し
    logger.info('音声再生開始...');

    // AudioPlayerの初期化
    if (!(await this.initializeAudioPlayer())) {
      logger.error('音声プレーヤーの初期化に失敗');
      throw new Error('音声プレーヤーの初期化に失敗しました');
    }

    // 再生実行
    await this.audioPlayer.playStreamingAudio(generator, bufferSize);

    logger.info('音声ストリーミング再生完了');
    return { success: true, mode: 'streaming' };
  }
}