/**
 * src/say/audio-synthesizer.ts: 音声合成処理
 * COEIROINK APIを使用した音声合成機能を担当
 */

import type {
  Config,
  StreamConfig,
  Chunk,
  AudioResult,
  AudioConfig,
  VoiceConfig,
} from './types.js';
import { logger } from '@coeiro-operator/common';
import { SAMPLE_RATES, SPLIT_SETTINGS, PADDING_SETTINGS, SYNTHESIS_SETTINGS } from './constants.js';
import { getSpeakerProvider } from '@coeiro-operator/core';
import { AudioStreamController, StreamControllerOptions } from './audio-stream-controller.js';

// ストリーミング設定
const STREAM_CONFIG: StreamConfig = {
  chunkSizeChars: 50, // 文字単位でのチャンク分割
  overlapChars: 5, // チャンク間のオーバーラップ（音切れ防止）
  bufferSize: 3, // 音声バッファサイズ（並列処理数）
  audioBufferMs: 100, // 音声出力バッファ時間
  silencePaddingMs: 50, // 音切れ防止用の無音パディング
  preloadChunks: 2, // 先読みチャンク数
};

export class AudioSynthesizer {
  private audioConfig: AudioConfig;
  private speakerProvider = getSpeakerProvider();
  private streamController: AudioStreamController;

  constructor(private config: Config) {
    this.audioConfig = this.getAudioConfig();
    // 接続設定を更新
    this.speakerProvider.updateConnection({
      host: this.config.connection.host,
      port: this.config.connection.port,
    });

    // AudioStreamControllerを初期化（設定ファイルベース）
    const parallelConfig = this.config.audio?.parallelGeneration || {};
    const punctuationPauseConfig = this.config.audio?.punctuationPause || {};

    // arrow function を使って this のコンテキストを保持し、bind を避ける
    this.streamController = new AudioStreamController(
      (chunk, voiceConfig, speed) => this.synthesizeChunk(chunk, voiceConfig, speed),
      {
        maxConcurrency: parallelConfig.maxConcurrency || 2,
        delayBetweenRequests: parallelConfig.delayBetweenRequests || 50,
        bufferAheadCount: parallelConfig.bufferAheadCount || 1,
        pauseUntilFirstComplete: parallelConfig.pauseUntilFirstComplete || true,
        punctuationPause: punctuationPauseConfig,
      }
    );
  }

  /**
   * スピーカー一覧を取得
   */
  async getSpeakers() {
    return await this.speakerProvider.getSpeakers();
  }

  /**
   * オーディオ設定を取得
   */
  private getAudioConfig(): AudioConfig {
    const latencyMode = this.config.audio?.latencyMode || 'balanced';

    const presets = {
      'ultra-low': {
        splitSettings: SPLIT_SETTINGS.PRESETS.ULTRA_LOW,
        paddingSettings: PADDING_SETTINGS.PRESETS.ULTRA_LOW,
      },
      balanced: {
        splitSettings: SPLIT_SETTINGS.PRESETS.BALANCED,
        paddingSettings: PADDING_SETTINGS.PRESETS.BALANCED,
      },
      quality: {
        splitSettings: SPLIT_SETTINGS.PRESETS.QUALITY,
        paddingSettings: PADDING_SETTINGS.PRESETS.QUALITY,
      },
    };

    const preset = presets[latencyMode];
    return {
      latencyMode,
      splitSettings: { ...preset.splitSettings, ...this.config.audio?.splitSettings },
      paddingSettings: { ...preset.paddingSettings, ...this.config.audio?.paddingSettings },
    };
  }

  /**
   * 設定から音声生成時のサンプルレートを取得
   */
  private getSynthesisRate(): number {
    return this.config.audio.processing?.synthesisRate || SAMPLE_RATES.SYNTHESIS;
  }

  /**
   * 設定ファイルに基づいて分割モード設定を生成
   */
  private getSplitModeConfig() {
    // latencyModeプリセットの値を優先し、個別設定で上書き
    const splitSettings = {
      smallSize: this.audioConfig.splitSettings?.smallSize || SPLIT_SETTINGS.DEFAULTS.SMALL_SIZE,
      mediumSize: this.audioConfig.splitSettings?.mediumSize || SPLIT_SETTINGS.DEFAULTS.MEDIUM_SIZE,
      largeSize: this.audioConfig.splitSettings?.largeSize || SPLIT_SETTINGS.DEFAULTS.LARGE_SIZE,
      overlapRatio:
        this.audioConfig.splitSettings?.overlapRatio || SPLIT_SETTINGS.DEFAULTS.OVERLAP_RATIO,
    };

    return {
      none: { chunkSize: Infinity, overlap: 0 },
      small: {
        chunkSize: splitSettings.smallSize,
        overlap: Math.round(splitSettings.smallSize * splitSettings.overlapRatio),
      },
      medium: {
        chunkSize: splitSettings.mediumSize,
        overlap: Math.round(splitSettings.mediumSize * splitSettings.overlapRatio),
      },
      large: {
        chunkSize: splitSettings.largeSize,
        overlap: Math.round(splitSettings.largeSize * splitSettings.overlapRatio),
      },
      punctuation: {
        chunkSize: SPLIT_SETTINGS.PUNCTUATION.MAX_CHUNK_SIZE,
        overlap: SPLIT_SETTINGS.PUNCTUATION.OVERLAP_CHARS,
      },
    } as const;
  }

  /**
   * サーバー接続確認
   */
  async checkServerConnection(): Promise<boolean> {
    return await this.speakerProvider.checkConnection();
  }

  /**
   * 利用可能な音声一覧を取得
   */
  async listVoices(): Promise<void> {
    await this.speakerProvider.logAvailableVoices();
  }

  /**
   * 句読点に基づくテキスト分割
   */
  private splitByPunctuation(text: string): Chunk[] {
    const chunks: Chunk[] = [];
    const config = SPLIT_SETTINGS.PUNCTUATION;

    // 複数の句読点で分割（。！？）
    // 複合句読点も考慮（？！、！？等）
    const punctuationPattern = /([。！？]+)/;
    const parts = text.split(punctuationPattern);
    logger.debug(`Parts after punctuation split: ${JSON.stringify(parts)}`);

    const sentences: string[] = [];

    for (let i = 0; i < parts.length; i += 2) {
      const sentence = parts[i] ? parts[i].trim() : '';
      const punctuation = parts[i + 1] || '';

      if (sentence.length > 0) {
        sentences.push(sentence + punctuation);
      }
    }

    logger.debug(`Processed sentences: ${JSON.stringify(sentences)}`);

    // 短いテキストの場合は全体を1つのチャンクとして扱う
    if (text.trim().length > 0 && sentences.length === 0) {
      chunks.push({
        text: text.trim(),
        index: 0,
        isFirst: true,
        isLast: true,
        overlap: 0,
      });
      return chunks;
    }

    // 句読点分割：適切な長さのチャンクを作成し、短いチャンクは結合する
    let currentChunk = '';

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // 文が最大文字数を超える場合は個別のチャンクとして処理
      if (sentence.length > config.MAX_CHUNK_SIZE) {
        // 現在のチャンクがあれば先に追加
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk,
            index: chunks.length,
            isFirst: chunks.length === 0,
            isLast: false,
            overlap: 0,
          });
          currentChunk = '';
        }

        // 長い文は個別処理（読点分割など）
        if (config.ALLOW_COMMA_SPLIT && sentence.includes('、')) {
          const subChunks = this.splitLongSentenceByComma(sentence, config.MAX_CHUNK_SIZE);
          subChunks.forEach(subChunk => {
            chunks.push({
              text: subChunk,
              index: chunks.length,
              isFirst: chunks.length === 0,
              isLast: false,
              overlap: 0,
            });
          });
        } else {
          // 長い文をそのままチャンクとして追加
          chunks.push({
            text: sentence,
            index: chunks.length,
            isFirst: chunks.length === 0,
            isLast: false,
            overlap: 0,
          });
        }
      } else {
        // 短い文の結合処理
        const combinedLength = currentChunk.length + sentence.length;

        if (currentChunk.length === 0) {
          // 最初の文
          currentChunk = sentence;
        } else if (
          combinedLength <= config.MAX_CHUNK_SIZE &&
          (currentChunk.length < config.MIN_CHUNK_SIZE || sentence.length < config.MIN_CHUNK_SIZE)
        ) {
          // 結合条件: 最大サイズ以下 かつ どちらかが最小サイズ未満
          currentChunk += sentence;
        } else {
          // 現在のチャンクを確定し、新しいチャンクを開始
          chunks.push({
            text: currentChunk,
            index: chunks.length,
            isFirst: chunks.length === 0,
            isLast: false,
            overlap: 0,
          });
          currentChunk = sentence;
        }
      }
    }

    // 残ったチャンクを追加
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk,
        index: chunks.length,
        isFirst: chunks.length === 0,
        isLast: false,
        overlap: 0,
      });
    }

    // 最後のチャンクのisLastフラグを設定
    if (chunks.length > 0) {
      chunks[chunks.length - 1].isLast = true;
    } else {
      // 全てのチャンクが最小サイズ未満の場合、元のテキストを1つのチャンクとして作成
      chunks.push({
        text: text.trim(),
        index: 0,
        isFirst: true,
        isLast: true,
        overlap: 0,
      });
    }

    return chunks;
  }

  /**
   * 文字数で強制分割
   */
  private forceSplitByLength(text: string, maxSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += maxSize) {
      chunks.push(text.slice(i, i + maxSize));
    }
    return chunks;
  }

  /**
   * 長い文を読点で分割
   */
  private splitLongSentenceByComma(sentence: string, maxSize: number): string[] {
    const parts: string[] = [];
    const commaParts = sentence.split('、');

    let currentChunk = '';
    for (let i = 0; i < commaParts.length; i++) {
      const part = commaParts[i] + (i < commaParts.length - 1 ? '、' : '');

      if (currentChunk.length + part.length <= maxSize) {
        currentChunk += part;
      } else {
        if (currentChunk.length > 0) {
          parts.push(currentChunk);
          currentChunk = part;
        } else {
          // 単一パートが最大サイズを超える場合は強制的に文字数分割
          parts.push(part);
        }
      }
    }

    if (currentChunk.length > 0) {
      parts.push(currentChunk);
    }

    return parts;
  }

  /**
   * テキストを音切れ防止のためのオーバーラップ付きチャンクに分割
   */
  splitTextIntoChunks(
    text: string,
    splitMode: 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation'
  ): Chunk[] {
    logger.debug('=== SPLIT_TEXT_INTO_CHUNKS DEBUG ===');
    logger.debug(`Input splitMode: ${splitMode}`);
    logger.debug(`Text length: ${text.length}`);
    logger.debug(`Text preview: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);

    // 句読点分割の場合は専用処理
    if (splitMode === 'punctuation') {
      logger.debug('Using punctuation-based splitting');
      const chunks = this.splitByPunctuation(text);
      logger.debug(`Punctuation splitting result: ${chunks.length} chunks`);
      chunks.forEach((chunk, index) => {
        logger.debug(
          `  Chunk ${index}: "${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}"`
        );
      });
      return chunks;
    }

    logger.debug(`Using ${splitMode} splitting mode`);
    const chunks: Chunk[] = [];
    const config = this.getSplitModeConfig()[splitMode];
    const chunkSize = config.chunkSize;
    const overlap = config.overlap;
    logger.debug(`Split config - chunkSize: ${chunkSize}, overlap: ${overlap}`);

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const end = Math.min(i + chunkSize, text.length);
      const chunk = text.slice(i, end);

      if (chunk.trim().length > 0) {
        chunks.push({
          text: chunk,
          index: chunks.length,
          isFirst: i === 0,
          isLast: end >= text.length,
          overlap: i > 0 ? overlap : 0,
        });
      }
    }

    logger.debug(`Non-punctuation splitting result: ${chunks.length} chunks`);
    chunks.forEach((chunk, index) => {
      logger.debug(
        `  Chunk ${index}: "${chunk.text.substring(0, 50)}${chunk.text.length > 50 ? '...' : ''}"`
      );
    });

    return chunks;
  }

  /**
   * 単一チャンクの音声合成
   * 注意: エラーを throw せず、ChunkGenerationManager がエラーを処理する
   */
  async synthesizeChunk(
    chunk: Chunk,
    voiceConfig: VoiceConfig,
    speed: number
  ): Promise<AudioResult> {
    logger.debug(`[AudioSynth] チャンク${chunk.index}: synthesizeChunk開始`);
    logger.log(
      `音声合成: チャンク${chunk.index} "${chunk.text.substring(0, 30)}${chunk.text.length > 30 ? '...' : ''}"`
    );

    const url = `http://${this.config.connection.host}:${this.config.connection.port}/v1/synthesis`;

    // VoiceConfigから音声IDとスタイルIDを取得
    const voiceId = voiceConfig.speaker.speakerId;
    const styleId = voiceConfig.selectedStyleId;

    // 音切れ防止: 前後に無音パディングを追加（設定に基づく）
    let paddingMs = 0;
    let postPaddingMs = 0;

    if (this.audioConfig.paddingSettings?.enabled) {
      const basePrePadding =
        this.audioConfig.paddingSettings.prePhonemeLength ||
        PADDING_SETTINGS.DEFAULTS.PRE_PHONEME_LENGTH;
      const basePostPadding =
        this.audioConfig.paddingSettings.postPhonemeLength ||
        PADDING_SETTINGS.DEFAULTS.POST_PHONEME_LENGTH;
      const firstChunkOnly = this.audioConfig.paddingSettings.firstChunkOnly;

      if (!firstChunkOnly || chunk.isFirst) {
        paddingMs = (chunk.isFirst ? basePrePadding : basePrePadding / 2) * 1000;
        postPaddingMs = (chunk.isLast ? basePostPadding : basePostPadding / 2) * 1000;
      }
    }

    const synthesisParam = {
      text: chunk.text,
      speakerUuid: voiceId,
      styleId: styleId,
      speedScale: speed,
      volumeScale: SYNTHESIS_SETTINGS.DEFAULT_VOLUME,
      pitchScale: SYNTHESIS_SETTINGS.DEFAULT_PITCH,
      intonationScale: SYNTHESIS_SETTINGS.DEFAULT_INTONATION,
      prePhonemeLength: paddingMs / 1000,
      postPhonemeLength: postPaddingMs / 1000,
      outputSamplingRate: this.getSynthesisRate(),
    };

    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(synthesisParam),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'レスポンス読み取り失敗');
        const errorMessage = `COEIROINK APIエラー: ${response.status} ${response.statusText}, body: ${errorText}`;
        logger.error(errorMessage);

        // エラーを throw
        logger.debug(`[AudioSynth] チャンク${chunk.index}: エラーをthrowします`);
        throw new Error(`チャンク${chunk.index}合成エラー: HTTP ${response.status}: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const latency = Date.now() - startTime;

      return {
        chunk,
        audioBuffer,
        latency,
      };
    } catch (error) {
      logger.error(`チャンク${chunk.index}合成エラー詳細:`, error);
      // エラーを再 throw
      throw error;
    }
  }

  /**
   * レート値をスピード値に変換
   */
  convertRateToSpeed(rate: number): number {
    const baseRate = 200;
    let speed = rate / baseRate;
    if (speed < 0.5) speed = 0.5;
    if (speed > 2.0) speed = 2.0;
    return speed;
  }

  /**
   * ストリーミング音声合成（リファクタリング版）
   */
  async *synthesizeStream(
    text: string,
    voiceConfig: VoiceConfig,
    speed: number,
    chunkMode: 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation'
  ): AsyncGenerator<AudioResult> {
    logger.debug('=== SYNTHESIZE_STREAM DEBUG ===');
    logger.debug(`chunkMode parameter: ${chunkMode}`);
    logger.debug(`text length: ${text.length}`);

    const chunks = this.splitTextIntoChunks(text, chunkMode);
    logger.debug(`Total chunks generated: ${chunks.length}`);

    // AudioStreamControllerを使用してストリーミング生成
    yield* this.streamController.synthesizeStream(chunks, voiceConfig, speed);

    logger.debug('=== SYNTHESIZE_STREAM COMPLETE ===');
  }

  /**
   * 並行生成モードの切り替え
   */
  setParallelGenerationEnabled(enabled: boolean): void {
    this.streamController.setParallelGenerationEnabled(enabled);
  }

  /**
   * ストリーム制御オプションの更新
   */
  updateStreamControllerOptions(options: Partial<StreamControllerOptions>): void {
    this.streamController.updateOptions(options);
  }

  /**
   * 現在のストリーム制御設定を取得
   */
  getStreamControllerOptions(): StreamControllerOptions {
    return this.streamController.getOptions();
  }

  /**
   * 生成統計情報を取得
   */
  getGenerationStats() {
    return this.streamController.getGenerationStats();
  }
}
