/**
 * 共通の型定義
 */

// オーディオ設定の型定義
export interface AudioConfig {
  latencyMode?: 'ultra-low' | 'balanced' | 'quality';
  splitMode?: 'none' | 'small' | 'medium' | 'large' | 'punctuation';
  bufferSize?: number;
  processing?: {
    synthesisRate?: number;
    playbackRate?: number;
    noiseReduction?: boolean;
    lowpassFilter?: boolean;
    lowpassCutoff?: number;
  };
  splitSettings?: {
    smallSize?: number;
    mediumSize?: number;
    largeSize?: number;
    overlapRatio?: number;
  };
  bufferSettings?: {
    highWaterMark?: number;
    lowWaterMark?: number;
    dynamicAdjustment?: boolean;
  };
  paddingSettings?: {
    enabled?: boolean;
    prePhonemeLength?: number;
    postPhonemeLength?: number;
    firstChunkOnly?: boolean;
  };
  crossfadeSettings?: {
    enabled?: boolean;
    skipFirstChunk?: boolean;
    overlapSamples?: number;
  };
  parallelGeneration?: {
    maxConcurrency?: number;
    delayBetweenRequests?: number;
    bufferAheadCount?: number;
    pauseUntilFirstComplete?: boolean;
  };
  punctuationPause?: {
    enabled?: boolean;
    pauseMoras?: {
      period?: number;      // 。の後（モーラ数）
      exclamation?: number; // ！の後（モーラ数）
      question?: number;    // ？の後（モーラ数）
      comma?: number;       // 、の後（モーラ数）
    };
    baseMorasPerSecond?: number; // デフォルトの基準話速（モーラ/秒）
  };
}

// 接続設定の型定義
export interface ConnectionConfig {
  host: string;
  port: string;
}

// 完全な設定型
export interface FullConfig {
  connection: ConnectionConfig;
  audio: AudioConfig;
  operator: {
    rate: number;
    timeout: number;
    assignmentStrategy: 'random';
  };
  characters: Record<string, any>;
}