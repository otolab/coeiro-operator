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
        enabled?: boolean;          // 並行生成の有効/無効
        maxConcurrency?: number;    // 最大並行生成数
        delayBetweenRequests?: number; // リクエスト間隔（ms）
        bufferAheadCount?: number;  // 先読みチャンク数
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

export interface SpeechTask {
    id: number;
    text: string;
    options: SynthesizeOptions;
    timestamp: number;
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