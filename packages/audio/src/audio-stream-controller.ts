/**
 * src/core/say/audio-stream-controller.ts: 音声ストリーム制御
 * 並行生成と順序再生の協調制御を担当
 */

import { logger } from '@coeiro-operator/common';
import { ChunkGenerationManager, GenerationOptions, toSpeakSettings } from './chunk-generation-manager.js';
import type { Chunk, AudioResult, VoiceConfig, PunctuationPauseSettings } from './types.js';
import { AudioPlayer } from './audio-player.js';
import { SAMPLE_RATES } from './constants.js';

export interface StreamControllerOptions extends GenerationOptions {
  bufferAheadCount: number; // 先読みチャンク数（デフォルト: 1）
  punctuationPause?: PunctuationPauseSettings; // 句読点ポーズ設定
}

// デフォルトの句読点ポーズ設定（モーラ数で指定）
const DEFAULT_PUNCTUATION_MORAS = {
  period: 2.0,      // 。の後（2.0モーラ分）
  exclamation: 1.5, // ！の後（1.5モーラ分）
  question: 1.8,    // ？の後（1.8モーラ分）
  comma: 0.8,       // 、の後（0.8モーラ分）
};

/**
 * 音声ストリーム制御クラス
 * 生成と再生の協調制御を行い、並行生成とシリアル再生を実現
 */
export class AudioStreamController {
  private generationManager: ChunkGenerationManager;
  private options: StreamControllerOptions;
  private audioPlayer: AudioPlayer;
  private synthesizeFunction: (
    chunk: Chunk,
    voiceConfig: VoiceConfig,
    speed: number
  ) => Promise<AudioResult>;

  constructor(
    synthesizeFunction: (
      chunk: Chunk,
      voiceConfig: VoiceConfig,
      speed: number
    ) => Promise<AudioResult>,
    options: Partial<StreamControllerOptions> = {},
    audioPlayer?: AudioPlayer
  ) {
    this.synthesizeFunction = synthesizeFunction;
    this.options = {
      maxConcurrency: 2, // 1=逐次、2以上=並行、デフォルト: 2
      delayBetweenRequests: 50,
      bufferAheadCount: 1,
      pauseUntilFirstComplete: true, // デフォルトで初回ポーズを有効化
      ...options,
    };

    this.generationManager = new ChunkGenerationManager(synthesizeFunction, {
      maxConcurrency: this.options.maxConcurrency,
      delayBetweenRequests: this.options.delayBetweenRequests,
      pauseUntilFirstComplete: this.options.pauseUntilFirstComplete,
    });

    // AudioPlayerが提供されない場合は、ダミーを作成（後方互換性のため）
    this.audioPlayer = audioPlayer || ({} as AudioPlayer);
  }

  /**
   * 句読点ポーズ時間を計算（モーラベース）
   */
  private calculatePauseDuration(
    punctuation: string,
    speedScale: number,
    voiceConfig: VoiceConfig,
    settings?: PunctuationPauseSettings
  ): number {
    if (!settings?.enabled) return 0;

    const punctuationMap: Record<string, keyof typeof DEFAULT_PUNCTUATION_MORAS> = {
      '。': 'period',
      '！': 'exclamation',
      '？': 'question',
      '、': 'comma',
    };

    const type = punctuationMap[punctuation];
    if (!type) return 0;

    // デフォルト値と設定値をマージ
    const pauseMoras = {
      ...DEFAULT_PUNCTUATION_MORAS,
      ...settings.pauseMoras,
    };

    // 基準話速を取得（スタイル別設定 > デフォルト）
    let baseMorasPerSecond = 7.5; // デフォルトは7.5モーラ/秒

    // スタイル別の話速が定義されていればそれを使用
    if (voiceConfig.styleMorasPerSecond && voiceConfig.styleId) {
      baseMorasPerSecond = voiceConfig.styleMorasPerSecond[voiceConfig.styleId] || 7.5;
    }

    logger.debug(
      `${voiceConfig.speaker.speakerName}(${voiceConfig.styleId || 'default'})の基準話速: ${baseMorasPerSecond}モーラ/秒`
    );

    // speedScale = rate / 200 (sayコマンド互換)
    const morasPerSecond = baseMorasPerSecond * speedScale;

    // ポーズ時間を計算（モーラ数 → ミリ秒）
    const pauseInMoras = pauseMoras[type];
    const pauseDuration = (pauseInMoras / morasPerSecond) * 1000;

    logger.debug(
      `句読点「${punctuation}」のポーズ: ${pauseInMoras}モーラ → ${Math.round(pauseDuration)}ms`
    );

    return Math.round(pauseDuration);
  }

  /**
   * チャンクの最後の文字が句読点かチェック
   */
  private getLastPunctuation(text: string): string | null {
    const lastChar = text[text.length - 1];
    if (['。', '！', '？', '、'].includes(lastChar)) {
      return lastChar;
    }
    return null;
  }

  /**
   * 無音WAVデータを生成（句読点ポーズ用）
   * @param durationMs 無音の長さ（ミリ秒）
   * @param sampleRate サンプルレート（デフォルト：24000Hz）
   * @returns WAVフォーマットの無音データ
   */
  private generateSilenceWAV(
    durationMs: number,
    sampleRate: number = SAMPLE_RATES.SYNTHESIS
  ): ArrayBuffer {
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const numBytes = numSamples * 2; // 16bit = 2bytes per sample
    const arrayBuffer = new ArrayBuffer(44 + numBytes); // WAVヘッダー(44bytes) + データ
    const view = new DataView(arrayBuffer);

    // WAVヘッダーを書き込み
    // "RIFF"
    view.setUint32(0, 0x52494646, false);
    // ファイルサイズ - 8
    view.setUint32(4, 36 + numBytes, true);
    // "WAVE"
    view.setUint32(8, 0x57415645, false);
    // "fmt "
    view.setUint32(12, 0x666d7420, false);
    // fmt チャンクサイズ
    view.setUint32(16, 16, true);
    // フォーマットタイプ (1 = PCM)
    view.setUint16(20, 1, true);
    // チャンネル数 (1 = モノラル)
    view.setUint16(22, 1, true);
    // サンプルレート
    view.setUint32(24, sampleRate, true);
    // バイトレート
    view.setUint32(28, sampleRate * 2, true);
    // ブロックアライン
    view.setUint16(32, 2, true);
    // ビット深度
    view.setUint16(34, 16, true);
    // "data"
    view.setUint32(36, 0x64617461, false);
    // データチャンクサイズ
    view.setUint32(40, numBytes, true);

    // 無音データ（すべて0）
    // ArrayBufferは初期化時に0で埋められるので追加の処理は不要

    return arrayBuffer;
  }

  /**
   * 並行生成対応の音声合成ジェネレータ（句読点ポーズ対応）
   */
  async *synthesizeStream(
    chunks: Chunk[],
    voiceConfig: VoiceConfig,
    speed: number
  ): AsyncGenerator<AudioResult> {
    const mode = this.options.maxConcurrency === 1 ? '逐次' : '並行';
    logger.debug(`${mode}生成モードで音声合成開始 (maxConcurrency=${this.options.maxConcurrency})`);

    if (chunks.length === 0) {
      return;
    }

    // SpeakSettings変換
    const speakSettings = toSpeakSettings(voiceConfig, speed);

    let chunkIndex = 0;
    // 新しいgenerate()メソッドを使用（シンプル）
    for await (const result of this.generationManager.generate(chunks, speakSettings)) {
      if (result.success) {
        logger.debug(`${mode}生成: チャンク${result.data.chunk.index}結果取得`);
        yield result.data;

        // 句読点ポーズの挿入（最後のチャンク以外）
        if (this.options.punctuationPause?.enabled &&
            chunkIndex < chunks.length - 1) {
          const lastPunctuation = this.getLastPunctuation(result.data.chunk.text);
          if (lastPunctuation) {
            const pauseDuration = this.calculatePauseDuration(
              lastPunctuation,
              speed,
              voiceConfig,
              this.options.punctuationPause
            );

            if (pauseDuration > 0) {
              // 無音WAVデータを生成（AudioPlayerインスタンスなしで動作）
              const silenceWAV = this.generateSilenceWAV(pauseDuration);

              // ポーズ用のAudioResultを作成
              const pauseResult: AudioResult = {
                chunk: {
                  text: '',
                  index: result.data.chunk.index + 0.5, // 中間のインデックス
                  isFirst: false,
                  isLast: false,
                  overlap: 0,
                },
                audioBuffer: silenceWAV,
                latency: 0,
              };

              logger.debug(`句読点「${lastPunctuation}」の後に${pauseDuration}msのポーズを挿入`);
              yield pauseResult;
            }
          }
        }
        chunkIndex++;
      } else {
        // エラー発生：ログ出力して再throw
        logger.error(`${mode}生成エラー: チャンク${result.chunkIndex} - ${result.error.message}`);
        throw result.error;
      }
    }

    logger.debug(`${mode}生成モード完了`);
  }

  /**
   * 並行生成の有効/無効を切り替え（maxConcurrencyで制御）
   */
  setParallelGenerationEnabled(enabled: boolean): void {
    this.options.maxConcurrency = enabled ? 2 : 1;
    logger.info(
      `並行生成モード: ${enabled ? '有効 (maxConcurrency=2)' : '無効 (maxConcurrency=1)'}`
    );
  }

  /**
   * 並行生成オプションを更新
   */
  updateOptions(options: Partial<StreamControllerOptions>): void {
    this.options = { ...this.options, ...options };

    // GenerationManagerのオプションも更新
    this.generationManager = new ChunkGenerationManager(this.synthesizeFunction, {
      maxConcurrency: this.options.maxConcurrency,
      delayBetweenRequests: this.options.delayBetweenRequests,
      pauseUntilFirstComplete: this.options.pauseUntilFirstComplete,
    });

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
  async clear(): Promise<void> {
    await this.generationManager.clear();
  }
}
