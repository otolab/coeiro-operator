/**
 * src/say/types.ts: 音声合成システムの型定義
 */

export interface Config {
    connection: ConnectionConfig;
    voice: VoiceConfig;
    audio: AudioConfig;
}

export interface ConnectionConfig {
    host: string;
    port: string;
}

export interface VoiceConfig {
    default_voice_id?: string;
    default_style_id?: number;
    rate: number;  // 話速（WPM）
}

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
        smallSize?: number;     // smallモード時の分割サイズ
        mediumSize?: number;    // mediumモード時の分割サイズ
        largeSize?: number;     // largeモード時の分割サイズ
        overlapRatio?: number;  // オーバーラップ比率（0.0-1.0）
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
        maxConcurrency?: number;    // 最大並行生成数（1=逐次、2以上=並行）
        delayBetweenRequests?: number; // リクエスト間隔（ms）
        bufferAheadCount?: number;  // 先読みチャンク数
        pauseUntilFirstComplete?: boolean; // 初回チャンク完了まで並行生成をポーズ
    };
}

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

export interface OperatorVoice {
    voice_id: string;
    character?: {
        name: string;
        available_styles?: Record<string, {
            disabled?: boolean;
            style_id: number;
            name: string;
        }>;
        style_selection: string;
        default_style: string;
    };
}

export type SpeechTaskType = 'speech' | 'warmup' | 'completion_wait';

export interface SpeechTask {
    id: number;
    type: SpeechTaskType;
    text: string;
    options: SynthesizeOptions;
    timestamp: number;
    // 完了通知用（CLI同期実行時）
    resolve?: () => void;
    reject?: (error: Error) => void;
}

export interface SynthesizeOptions {
    voice?: string | OperatorVoice | null;
    rate?: number;
    outputFile?: string | null;
    style?: string;
    chunkMode?: 'none' | 'small' | 'medium' | 'large' | 'punctuation';  // テキスト分割モード
    bufferSize?: number;  // スピーカーバッファサイズ制御（バイト単位）
    allowFallback?: boolean;  // デフォルトフォールバックを許可するかどうか
}

export interface SynthesizeResult {
    success: boolean;
    taskId?: number;
    queueLength?: number;
    outputFile?: string;
    latency?: number;
    mode?: string;
}