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
import type { Character, Speaker } from '@coeiro-operator/core';

/**
 * VoiceConfig: 音声合成に必要な最小限の情報
 * Speaker情報と選択されたスタイルIDを含む
 */
export interface VoiceConfig {
  speaker: Speaker; // COEIROINKのSpeaker情報
  selectedStyleId: number; // 選択されたスタイルID
}

/**
 * SpeakSettings: 音声合成タスク全体の設定
 * VoiceConfig + speed + 将来的な拡張パラメータを統合
 */
export interface SpeakSettings {
  speaker: Speaker; // どの声で喋るか
  styleId: number; // どのスタイルで喋るか（ノーマル、裏声など）
  speed: number; // 話速（0.5 ~ 2.0）

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

export interface SynthesizeOptions {
  voice?: string | VoiceConfig | null;
  rate?: number;
  outputFile?: string | null;
  style?: string;
  chunkMode?: 'none' | 'small' | 'medium' | 'large' | 'punctuation'; // テキスト分割モード
  bufferSize?: number; // スピーカーバッファサイズ制御（バイト単位）
  allowFallback?: boolean; // デフォルトフォールバックを許可するかどうか
}

export interface SynthesizeResult {
  success: boolean;
  taskId?: number;
  promise?: Promise<void>;  // タスク完了を待つためのPromise
  queueLength?: number;
  outputFile?: string;
  latency?: number;
  mode?: string;
}
