/**
 * 共通の型定義
 */

// オーディオ設定の型定義
export interface AudioConfig {
  defaultRate?: number; // デフォルトの絶対速度（WPM） - 未指定時は話者固有速度
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
    period?: number;      // 。の後（モーラ数、0で無効）
    exclamation?: number; // ！の後（モーラ数、0で無効）
    question?: number;    // ？の後（モーラ数、0で無効）
    comma?: number;       // 、の後（モーラ数、0で無効）
  };
}

// 接続設定の型定義
export interface ConnectionConfig {
  host: string;
  port: string;
}

// オペレータ設定の型定義（速度設定を含まない）
export interface OperatorConfig {
  timeout: number;
  assignmentStrategy: 'random';
}

// 完全な設定型
export interface FullConfig {
  connection: ConnectionConfig;
  audio: AudioConfig;
  operator: OperatorConfig;
  characters: Record<string, any>;
}