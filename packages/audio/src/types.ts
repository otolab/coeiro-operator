/**
 * src/say/types.ts: 音声合成システムの型定義
 */

import { FullConfig, AudioConfig, ConnectionConfig } from '@coeiro-operator/core';

// Config型はFullConfig型のエイリアス
export type Config = FullConfig;

// 再エクスポート
export type { AudioConfig, ConnectionConfig };

export interface StreamConfig {
  chunkSizeChars: number;
  overlapChars: number;
  bufferSize: number;
  audioBufferMs: number;
  silencePaddingMs: number;
  preloadChunks: number;
}

export interface Chunk {
  text: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  overlap: number;
}

export interface AudioResult {
  chunk: Chunk;
  audioBuffer: ArrayBuffer;
  latency: number;
}

// CharacterInfoServiceのCharacter型を使用
import type { Character } from '@coeiro-operator/core';

/**
 * PunctuationPauseSettings: 句読点ポーズ設定
 * 日本語発話に特化したモーラベースのポーズ制御
 *
 * ポーズの長さをモーラ数で指定します。
 * 日本語は等間隔のモーラリズムなので、話速が変わっても自然な比率を保てます。
 * 各値を0に設定することでそのポーズを無効化できます。
 *
 * 実際のポーズ時間は VoiceConfig.styleMorasPerSecond から計算された話速に基づいて決定されます。
 */
export interface PunctuationPauseSettings {
  period?: number;      // 。の後（モーラ数、0で無効）
  exclamation?: number; // ！の後（モーラ数、0で無効）
  question?: number;    // ？の後（モーラ数、0で無効）
  comma?: number;       // 、の後（モーラ数、0で無効）
}

/**
 * SpeakSettings: チャンク生成時の音声合成パラメータ
 * 並行生成のために必要な最小限の情報のみを保持
 */
export interface SpeakSettings {
  characterId: string; // キャラクターID（ログ出力用）
  speakerId: string; // speakerUuid（音声合成API用）
  styleId: number; // スタイルID
  speed: number; // 話速（0.5 ~ 2.0）
  styleMorasPerSecond?: number; // 選択されたスタイルの基準話速（ポーズ計算用）

  // 将来的に可変にする場合（現在は未使用、デフォルト値を使用）
  volume?: number; // 音量（デフォルト: 1.0）
  pitch?: number; // 音高（デフォルト: 0.0）
  intonation?: number; // イントネーション（デフォルト: 1.0）
}

/**
 * GenerationResult: チャンク生成結果（成功 or 失敗）
 */
export type GenerationResult =
  | { success: true; data: AudioResult }
  | { success: false; error: Error; chunkIndex: number };

// SpeechTaskはqueue/speech-queue.tsに移動
export type { SpeechTask } from './queue/speech-queue.js';

/**
 * CLISynthesizeOptions: CLI/MCP用の音声合成オプション（文字列ベース）
 * SayCoeiroink.synthesize()が受け取るオプション
 */
export interface CLISynthesizeOptions {
  voice?: string | null; // 音声ID or名前（省略時はアサイン）
  style?: string; // スタイル名（省略時はデフォルトスタイル）
  rate?: number | string; // 数値（WPM）または文字列（"150%"）形式
  factor?: number; // 相対速度（倍率、1.0 = 等速）
  outputFile?: string | null;
  chunkMode?: 'none' | 'small' | 'medium' | 'large' | 'punctuation'; // テキスト分割モード
  bufferSize?: number; // スピーカーバッファサイズ制御（バイト単位）
  allowFallback?: boolean; // voice解決時のフォールバック許可（デフォルト: true）
}

/**
 * ProcessingOptions: 音声処理制御オプション
 * ファイル出力、チャンク分割、バッファサイズ等の制御
 */
export interface ProcessingOptions {
  outputFile?: string | null;
  chunkMode?: 'none' | 'small' | 'medium' | 'large' | 'punctuation';
  bufferSize?: number;
}

/**
 * SynthesizeOptions: 後方互換性のためのエイリアス（CLISynthesizeOptions）
 */
export type SynthesizeOptions = CLISynthesizeOptions;

export interface SynthesizeResult {
  success: boolean;
  taskId?: number;
  promise?: Promise<void>;  // タスク完了を待つためのPromise
  queueLength?: number;
  outputFile?: string;
  latency?: number;
  mode?: string;
}
