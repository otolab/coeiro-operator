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
} from './types.js';

export class SynthesisProcessor {
  constructor(
    private config: Config,
    private audioPlayer: AudioPlayer,
    private audioSynthesizer: AudioSynthesizer,
    private voiceResolver: VoiceResolver
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

    // ストリーミング合成してファイルに保存
    const audioChunks: ArrayBuffer[] = [];
    for await (const audioResult of this.audioSynthesizer.synthesizeStream(
      text,
      voiceConfig,
      speed,
      chunkMode
    )) {
      audioChunks.push(audioResult.audioBuffer);
    }

    // 全チャンクを結合
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combinedBuffer = new ArrayBuffer(totalLength);
    const view = new Uint8Array(combinedBuffer);
    let offset = 0;

    for (const chunk of audioChunks) {
      view.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    await this.audioPlayer.saveAudio(combinedBuffer, outputFile);
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

    // 統一されたストリーミング再生
    if (!(await this.initializeAudioPlayer())) {
      logger.error('音声プレーヤーの初期化に失敗');
      throw new Error('音声プレーヤーの初期化に失敗しました');
    }

    logger.info('音声ストリーミング再生開始...');
    logger.debug(`About to call streamSynthesizeAndPlay with chunkMode: ${chunkMode}`);

    // 真のストリーミング再生：ジェネレータを直接AudioPlayerに渡す
    await this.audioPlayer.playStreamingAudio(
      this.audioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode),
      bufferSize
    );

    logger.info('音声ストリーミング再生完了');
    return { success: true, mode: 'streaming' };
  }
}