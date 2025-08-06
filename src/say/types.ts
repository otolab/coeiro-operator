/**
 * src/say/types.ts: 音声合成システムの型定義
 */

export interface Config {
    host: string;
    port: string;
    rate: number;
    voice_id?: string;
    style_id?: number;
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
    streamMode?: boolean;
    style?: string;
}

export interface SynthesizeResult {
    success: boolean;
    taskId?: number;
    queueLength?: number;
    outputFile?: string;
    latency?: number;
    mode?: string;
}