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
