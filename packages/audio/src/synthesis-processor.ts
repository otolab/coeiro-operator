/**
 * synthesis-processor.ts: 音声合成処理を担当
 */

import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { VoiceResolver } from './voice-resolver.js';
import { logger } from '@coeiro-operator/common';
import { BUFFER_SIZES, FILTER_SETTINGS } from './constants.js';
import type {
  Config,
  VoiceConfig,
  SynthesizeOptions,
  SynthesizeResult,
  AudioResult,
} from './types.js';

export class SynthesisProcessor {
  constructor(
    private config: Config,
    private audioPlayer: AudioPlayer,
    private audioSynthesizer: AudioSynthesizer,
    private voiceResolver: VoiceResolver
  ) {}

  /**
   * 音声合成のみ（再生なし）
   * @returns AsyncGeneratorまたは音声データ
   */
  async synthesizeOnly(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<{
    generator: AsyncGenerator<AudioResult>;
    voiceConfig: VoiceConfig;
    speed: number;
    chunkMode: any;
    bufferSize: number;
  }> {
    // オプション解析
    const resolvedOptions = this.resolveOptions(options);

    // サーバー接続確認
    await this.validateServerConnection();

    // 音声設定の解決
    const voiceConfig = await this.voiceResolver.resolveVoiceConfig(
      resolvedOptions.voice,
      resolvedOptions.style || undefined,
      resolvedOptions.allowFallback
    );

    const speed = this.audioSynthesizer.convertRateToSpeed(resolvedOptions.rate);

    // ジェネレータを返す（再生はしない）
    return {
      generator: this.audioSynthesizer.synthesizeStream(
        text,
        voiceConfig,
        speed,
        resolvedOptions.chunkMode
      ),
      voiceConfig,
      speed,
      chunkMode: resolvedOptions.chunkMode,
      bufferSize: resolvedOptions.bufferSize,
    };
  }

  /**
   * 音声再生のみ（合成済みデータを再生）
   */
  async playOnly(
    generator: AsyncGenerator<AudioResult>,
    bufferSize?: number
  ): Promise<void> {
    // AudioPlayerの初期化
    if (!(await this.initializeAudioPlayer())) {
      throw new Error('音声プレーヤーの初期化に失敗しました');
    }

    // 再生実行
    await this.audioPlayer.playStreamingAudio(generator, bufferSize);
  }

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
   */
  async process(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    logger.info(
      `音声合成開始: テキスト="${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
    );

    // オプション解析
    const resolvedOptions = this.resolveOptions(options);

    // サーバー接続確認を最初に行う
    await this.validateServerConnection();

    // 音声設定の解決
    const voiceConfig = await this.voiceResolver.resolveVoiceConfig(
      resolvedOptions.voice,
      resolvedOptions.style || undefined,
      resolvedOptions.allowFallback
    );

    const speed = this.audioSynthesizer.convertRateToSpeed(resolvedOptions.rate);

    // 出力モードに応じた処理
    if (resolvedOptions.outputFile) {
      return await this.processFileOutput(
        text,
        voiceConfig,
        speed,
        resolvedOptions.chunkMode,
        resolvedOptions.outputFile
      );
    } else {
      return await this.processStreamingOutput(
        text,
        voiceConfig,
        speed,
        resolvedOptions.chunkMode,
        resolvedOptions.bufferSize
      );
    }
  }

  /**
   * オプション解析
   */
  private resolveOptions(options: SynthesizeOptions): {
    voice: string | VoiceConfig | null;
    rate: number;
    outputFile: string | null;
    style: string | null;
    chunkMode: any;
    bufferSize: number;
    allowFallback: boolean;
  } {
    const resolved = {
      voice: options.voice || null,
      rate: options.rate || this.config.operator.rate,
      outputFile: options.outputFile || null,
      style: options.style || null,
      chunkMode: options.chunkMode || this.config.audio?.splitMode || 'punctuation',
      bufferSize: options.bufferSize || this.config.audio?.bufferSize || BUFFER_SIZES.DEFAULT,
      allowFallback: options.allowFallback ?? true,
    };

    logger.debug('=== SYNTHESIZE_TEXT_INTERNAL DEBUG ===');
    logger.debug(`Resolved options:`);
    logger.debug(
      `  chunkMode: ${resolved.chunkMode} (from: ${options.chunkMode ? 'options' : 'config.audio.splitMode fallback'})`
    );
    logger.debug(`  config.audio.splitMode: ${this.config.audio?.splitMode || 'undefined'}`);
    logger.debug(`  bufferSize: ${resolved.bufferSize}`);
    logger.debug(`  allowFallback: ${resolved.allowFallback}`);

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
    voiceConfig: VoiceConfig,
    speed: number,
    chunkMode: any,
    outputFile: string
  ): Promise<SynthesizeResult> {
    logger.info(`ファイル出力モード: ${outputFile}`);

    // Step 1: 音声合成（データ生成のみ）
    logger.info('音声データ生成開始...');
    logger.debug(`合成パラメータ - chunkMode: ${chunkMode}, speed: ${speed}`);
    const generator = this.audioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode);

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
    voiceConfig: VoiceConfig,
    speed: number,
    chunkMode: any,
    bufferSize: number
  ): Promise<SynthesizeResult> {
    logger.info('ストリーミング再生モード');

    // Step 1: 音声合成（データ生成のみ）
    logger.info('音声合成開始...');
    logger.debug(`合成パラメータ - chunkMode: ${chunkMode}, speed: ${speed}`);
    const synthesisResult = {
      generator: this.audioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode),
      bufferSize
    };

    // Step 2: 音声再生（再生のみ） - フラットな呼び出し
    logger.info('音声再生開始...');
    await this.playOnly(synthesisResult.generator, synthesisResult.bufferSize);

    logger.info('音声ストリーミング再生完了');
    return { success: true, mode: 'streaming' };
  }
}