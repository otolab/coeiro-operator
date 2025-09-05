/**
 * src/say/index.ts: COEIROINK音声合成ライブラリ
 * MCPサーバから直接呼び出し可能なモジュール
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { getConfigDir, getConfigPath } from '../common/config-paths.js';
import { OperatorManager } from '../operator/index.js';
import type { Character, Speaker } from '../operator/character-info-service.js';
import { SpeechQueue } from './speech-queue.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { logger } from '../../utils/logger.js';
import {
  CONNECTION_SETTINGS,
  SAMPLE_RATES,
  BUFFER_SIZES,
  FILTER_SETTINGS,
  SYNTHESIS_SETTINGS,
  STREAM_SETTINGS,
} from './constants.js';
import type {
  Config,
  ConnectionConfig,
  VoiceConfig,
  AudioConfig,
  StreamConfig,
  Chunk,
  AudioResult,
  SpeechTask,
  SynthesizeOptions,
  SynthesizeResult,
} from './types.js';
import type { StreamControllerOptions } from './audio-stream-controller.js';

// デフォルト設定
const DEFAULT_CONFIG: Config = {
  connection: {
    host: CONNECTION_SETTINGS.DEFAULT_HOST,
    port: CONNECTION_SETTINGS.DEFAULT_PORT,
  },
  operator: {
    rate: SYNTHESIS_SETTINGS.DEFAULT_RATE,
    timeout: 14400000, // 4時間
    assignmentStrategy: 'random' as const,
  },
  audio: {
    latencyMode: 'balanced',
    splitMode: 'punctuation',
    bufferSize: BUFFER_SIZES.DEFAULT,
    parallelGeneration: {
      maxConcurrency: 2, // 最大並行生成数（1=逐次、2以上=並行、デフォルト: 2）
      delayBetweenRequests: 50, // リクエスト間隔（ms）
      bufferAheadCount: 1, // 先読みチャンク数
      pauseUntilFirstComplete: true, // 初回チャンク完了まで並行生成をポーズ（レイテンシ改善、デフォルト有効）
    },
  },
  characters: {},
};

// ストリーミング設定
const STREAM_CONFIG: StreamConfig = {
  chunkSizeChars: STREAM_SETTINGS.CHUNK_SIZE_CHARS,
  overlapChars: STREAM_SETTINGS.OVERLAP_CHARS,
  bufferSize: STREAM_SETTINGS.BUFFER_SIZE,
  audioBufferMs: STREAM_SETTINGS.AUDIO_BUFFER_MS,
  silencePaddingMs: STREAM_SETTINGS.SILENCE_PADDING_MS,
  preloadChunks: STREAM_SETTINGS.PRELOAD_CHUNKS,
};

/**
 * 設定ファイルを読み込み
 */
export async function loadConfig(configFile: string | null = null): Promise<Config> {
  if (!configFile) {
    configFile = await getConfigPath('config.json');
  }

  try {
    await access(configFile, constants.F_OK);
  } catch {
    return DEFAULT_CONFIG;
  }

  try {
    const configData = await readFile(configFile, 'utf8');
    const rawConfig = JSON.parse(configData);
    return { ...DEFAULT_CONFIG, ...rawConfig };
  } catch (error) {
    logger.error(`設定ファイル読み込みエラー: ${(error as Error).message}`);
    return DEFAULT_CONFIG;
  }
}

export class SayCoeiroink {
  private config: Config;
  private operatorManager: OperatorManager;
  private speechQueue: SpeechQueue;
  private audioPlayer: AudioPlayer;
  private audioSynthesizer: AudioSynthesizer;

  constructor(config: Config | null = null) {
    // configがnullまたは部分的な場合はDEFAULT_CONFIGとマージ
    this.config = config ? { ...DEFAULT_CONFIG, ...config } : DEFAULT_CONFIG;
    // operatorプロパティも同様にマージ
    if (config && config.operator) {
      this.config.operator = { ...DEFAULT_CONFIG.operator, ...config.operator };
    }
    this.operatorManager = new OperatorManager();
    this.audioPlayer = new AudioPlayer(this.config);
    this.audioSynthesizer = new AudioSynthesizer(this.config);

    // SpeechQueueを初期化（処理コールバックとウォームアップコールバックを渡す）
    this.speechQueue = new SpeechQueue(
      async (task: SpeechTask) => {
        await this.synthesizeTextInternal(task.text, task.options);
      },
      async () => {
        await this.audioPlayer.warmupAudioDriver();
      }
    );
  }

  async initialize(): Promise<void> {
    try {
      await this.operatorManager.initialize();
    } catch (err) {
      throw new Error(`SayCoeiroink initialization failed: ${(err as Error).message}`);
    }
  }

  async buildDynamicConfig(): Promise<void> {
    try {
      await this.operatorManager.buildDynamicConfig();
    } catch (err) {
      throw new Error(`buildDynamicConfig failed: ${(err as Error).message}`);
    }
  }

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
   * ウォームアップタスクをキューに追加
   */
  async enqueueWarmup(): Promise<SynthesizeResult> {
    return await this.speechQueue.enqueueWarmup();
  }

  async getCurrentVoiceConfig(styleName?: string | null): Promise<VoiceConfig | null> {
    try {
      const currentStatus = await this.operatorManager.showCurrentOperator();

      if (!currentStatus.characterId) {
        return null;
      }

      const character = await this.operatorManager.getCharacterInfo(currentStatus.characterId);

      if (character && character.speaker && character.speaker.speakerId) {
        // 保存されたセッション情報からスタイルを取得
        const session = await this.operatorManager.getCurrentOperatorSession();
        let selectedStyle: any;

        if (styleName) {
          // 明示的にスタイルが指定された場合はそれを使用
          selectedStyle = this.operatorManager.selectStyle(character, styleName);
        } else if (session?.styleId !== undefined) {
          // セッションに保存されたスタイルIDがある場合はそれを使用
          const savedStyle = character.speaker.styles.find(s => s.styleId === session.styleId);
          if (savedStyle) {
            selectedStyle = savedStyle;
            logger.debug(
              `保存されたスタイルを使用: ${savedStyle.styleName} (ID:${savedStyle.styleId})`
            );
          } else {
            // 保存されたスタイルが見つからない場合はデフォルトを使用
            selectedStyle = this.operatorManager.selectStyle(character, null);
          }
        } else {
          // セッション情報がない場合はデフォルトスタイルを使用
          selectedStyle = this.operatorManager.selectStyle(character, null);
        }

        return {
          speaker: character.speaker,
          selectedStyleId: selectedStyle.styleId,
        };
      }

      return null;
    } catch (error) {
      logger.error(`オペレータ音声取得エラー: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * CharacterIdからVoiceConfigを生成
   * CharacterのdefaultStyleを使用してVoiceConfigを作成
   */
  private async resolveCharacterToConfig(
    characterId: string,
    styleName?: string | null
  ): Promise<VoiceConfig> {
    try {
      // CharacterInfoServiceからCharacter情報を取得
      const character = await this.operatorManager.getCharacterInfo(characterId);

      if (!character) {
        throw new Error(`Character not found: ${characterId}`);
      }

      if (!character.speaker) {
        throw new Error(`Character '${characterId}' has no speaker information`);
      }

      // スタイル選択（styleNameが指定されていればそれを使用、そうでなければdefaultStyle）
      const selectedStyle = this.operatorManager.selectStyle(character, styleName);

      return {
        speaker: character.speaker,
        selectedStyleId: selectedStyle.styleId,
      };
    } catch (error) {
      logger.error(`Character解決エラー: ${(error as Error).message}`);
      throw new Error(`Failed to resolve character '${characterId}': ${(error as Error).message}`);
    }
  }

  // AudioPlayer の playAudioStream メソッドを使用
  async playAudioStream(audioResult: AudioResult): Promise<void> {
    return await this.audioPlayer.playAudioStream(audioResult);
  }

  // AudioSynthesizer の convertRateToSpeed メソッドを使用
  convertRateToSpeed(rate: number): number {
    return this.audioSynthesizer.convertRateToSpeed(rate);
  }

  async streamSynthesizeAndPlay(
    text: string,
    voiceConfig: VoiceConfig,
    speed: number,
    chunkMode: 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation',
    bufferSize?: number
  ): Promise<void> {
    // 真のストリーミング再生：ジェネレータを直接AudioPlayerに渡す
    await this.audioPlayer.playStreamingAudio(
      this.audioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode),
      bufferSize
    );
  }

  // AudioSynthesizer の listVoices メソッドを使用
  async listVoices(): Promise<void> {
    return await this.audioSynthesizer.listVoices();
  }

  // AudioPlayer の saveAudio メソッドを使用
  async saveAudio(audioBuffer: ArrayBuffer, outputFile: string): Promise<void> {
    return await this.audioPlayer.saveAudio(audioBuffer, outputFile);
  }

  // AudioSynthesizer の checkServerConnection メソッドを使用
  async checkServerConnection(): Promise<boolean> {
    return await this.audioSynthesizer.checkServerConnection();
  }

  // SpeechQueue の enqueue メソッドを使用
  async enqueueSpeech(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    return await this.speechQueue.enqueue(text, options);
  }

  // SpeechQueue のステータスを取得
  getSpeechQueueStatus() {
    return this.speechQueue.getStatus();
  }

  // SpeechQueue をクリア
  clearSpeechQueue(): void {
    this.speechQueue.clear();
  }

  // ========================================================================
  // CLI/MCP 実行モード別メソッド
  // ========================================================================

  /**
   * CLIからの完全同期実行用メソッド
   * - ウォームアップ → 音声合成 → 完了待機を全てqueueで処理
   * - 同期的な動作でユーザーが完了を確認できる
   */
  async synthesizeText(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
    // ファイル出力時はウォームアップと完了待機をスキップ
    if (options.outputFile) {
      return await this.speechQueue.enqueueAndWait(text, options);
    }

    // 音声再生時：ウォームアップ → 音声合成 → 完了待機
    await this.speechQueue.enqueueWarmupAndWait();
    const result = await this.speechQueue.enqueueAndWait(text, options);
    await this.speechQueue.enqueueCompletionWaitAndWait();

    return result;
  }

  /**
   * MCPサーバから呼び出される非同期キューイング版メソッド
   * - SpeechQueueにタスクを投稿のみ（即座にレスポンス）
   * - 実際の音声合成・再生は背景で非同期実行
   * - Claude Codeの応答性を重視した設計
   * - ウォームアップや完了待機は実行しない
   */
  async synthesizeTextAsync(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    return await this.enqueueSpeech(text, options);
  }

  /**
   * デバッグ用：キュー処理完了を待つ版メソッド
   * - テスト環境などで音声合成の完了確認が必要な場合に使用
   * - 通常のMCP動作では使用しない
   */
  async synthesizeTextAsyncAndWait(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    return await this.speechQueue.enqueueAndWait(text, options);
  }

  // オプション解析とデバッグログ出力
  private resolveAndLogOptions(options: SynthesizeOptions): {
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

  // サーバー接続確認
  private async validateServerConnection(): Promise<void> {
    if (!(await this.checkServerConnection())) {
      const host = this.config.connection?.host || 'localhost';
      const port = this.config.connection?.port || '50032';
      logger.error(`COEIROINKサーバーに接続できません: http://${host}:${port}`);
      throw new Error(`Cannot connect to COEIROINK server (http://${host}:${port})`);
    }
  }

  // ファイル出力処理
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

    await this.saveAudio(combinedBuffer, outputFile);
    return { success: true, outputFile, mode: 'file' };
  }

  // ストリーミング再生処理
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
    await this.streamSynthesizeAndPlay(text, voiceConfig, speed, chunkMode, bufferSize);
    logger.info('音声ストリーミング再生完了');
    return { success: true, mode: 'streaming' };
  }

  // 内部用の実際の音声合成処理（分割後のメインメソッド）
  async synthesizeTextInternal(
    text: string,
    options: SynthesizeOptions = {}
  ): Promise<SynthesizeResult> {
    logger.info(
      `音声合成開始: テキスト="${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`
    );

    // オプション解析とデバッグログ出力
    const resolvedOptions = this.resolveAndLogOptions(options);

    // 音声設定の決定（VoiceConfigに統一）
    let voiceConfig: VoiceConfig;

    if (!resolvedOptions.voice) {
      // オペレータから音声を取得（スタイル指定も渡す）
      const operatorVoice = await this.getCurrentVoiceConfig(resolvedOptions.style);
      if (operatorVoice) {
        // スタイル情報を取得して詳細ログ出力
        const selectedStyle = operatorVoice.speaker.styles.find(
          s => s.styleId === operatorVoice.selectedStyleId
        );
        const styleName = selectedStyle?.styleName || `ID:${operatorVoice.selectedStyleId}`;
        logger.info(
          `オペレータ音声を使用: ${operatorVoice.speaker.speakerName} (スタイル: ${styleName})`
        );
        voiceConfig = operatorVoice;
      } else if (resolvedOptions.allowFallback) {
        // CLIのみ: デフォルトキャラクターを使用（つくよみちゃん）
        const defaultCharacterId = 'tsukuyomi';
        logger.info(`デフォルトキャラクターを使用: ${defaultCharacterId}`);
        voiceConfig = await this.resolveCharacterToConfig(
          defaultCharacterId,
          resolvedOptions.style
        );
      } else {
        // MCP: オペレータが必須
        throw new Error(
          'オペレータが割り当てられていません。まず operator_assign を実行してください。'
        );
      }
    } else if (typeof resolvedOptions.voice === 'string') {
      // string型の場合はCharacterIdとして解決
      logger.info(`キャラクター解決: ${resolvedOptions.voice}`);
      voiceConfig = await this.resolveCharacterToConfig(
        resolvedOptions.voice,
        resolvedOptions.style
      );
      const selectedStyle = voiceConfig.speaker.styles.find(
        s => s.styleId === voiceConfig.selectedStyleId
      );
      const styleName = selectedStyle?.styleName || `ID:${voiceConfig.selectedStyleId}`;
      logger.info(`  → ${voiceConfig.speaker.speakerName} (スタイル: ${styleName})`);
    } else {
      // すでにVoiceConfig型の場合はそのまま使用
      voiceConfig = resolvedOptions.voice;
      const selectedStyle = voiceConfig.speaker.styles.find(
        s => s.styleId === voiceConfig.selectedStyleId
      );
      const styleName = selectedStyle?.styleName || `ID:${voiceConfig.selectedStyleId}`;
      logger.info(`VoiceConfig使用: ${voiceConfig.speaker.speakerName} (スタイル: ${styleName})`);
    }

    // サーバー接続確認
    await this.validateServerConnection();

    const speed = this.convertRateToSpeed(resolvedOptions.rate);

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
   * 並行生成の有効/無効を設定
   */
  setParallelGenerationEnabled(enabled: boolean): void {
    this.audioSynthesizer.setParallelGenerationEnabled(enabled);
    logger.info(`並行生成設定変更: ${enabled ? '有効' : '無効'}`);
  }

  /**
   * AudioStreamControllerのオプションを更新
   */
  updateStreamControllerOptions(options: Partial<StreamControllerOptions>): void {
    this.audioSynthesizer.updateStreamControllerOptions(options);
    logger.info('AudioStreamController設定更新', options);
  }

  /**
   * 並行生成の統計情報を取得
   */
  getGenerationStats() {
    return this.audioSynthesizer.getGenerationStats();
  }

  /**
   * 現在の並行生成設定を取得
   */
  getParallelGenerationConfig() {
    return this.audioSynthesizer.getStreamControllerOptions();
  }

  /**
   * ストリーム制御オプションを取得
   */
  getStreamControllerOptions() {
    return this.audioSynthesizer.getStreamControllerOptions();
  }

  /**
   * SayCoeiroinkインスタンスのクリーンアップ（リソース解放）
   * 長時間運用やシャットダウン時に呼び出し
   */
  async cleanup(): Promise<void> {
    logger.debug('SayCoeiroink cleanup開始');

    try {
      // SpeechQueueのクリア
      this.speechQueue.clear();

      // AudioPlayerのクリーンアップ
      await this.audioPlayer.cleanup();

      // AudioSynthesizerには特別なクリーンアップは不要（HTTPクライアントベース）

      logger.info('SayCoeiroink cleanup完了');
    } catch (error) {
      logger.warn(`SayCoeiroink cleanup warning: ${(error as Error).message}`);
    }
  }
}

// デフォルトエクスポート
export default SayCoeiroink;
