/**
 * src/say/index.ts: COEIROINK音声合成ライブラリ
 * MCPサーバから直接呼び出し可能なモジュール
 */
interface Config {
    host: string;
    port: string;
    rate: number;
}
interface Chunk {
    text: string;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    overlap: number;
}
interface AudioResult {
    chunk: Chunk;
    audioBuffer: ArrayBuffer;
    latency: number;
}
interface OperatorVoice {
    voice_id: string;
    character?: {
        available_styles?: Record<string, {
            enabled: boolean;
            style_id: number;
            name: string;
        }>;
        style_selection: string;
        default_style: string;
    };
}
interface SynthesizeOptions {
    voice?: string | OperatorVoice | null;
    rate?: number;
    outputFile?: string | null;
    streamMode?: boolean;
    style?: string;
}
interface SynthesizeResult {
    success: boolean;
    taskId?: number;
    queueLength?: number;
    outputFile?: string;
    latency?: number;
    mode?: string;
}
/**
 * 設定ファイルを読み込み
 */
export declare function loadConfig(configFile?: string | null): Promise<Config>;
export declare class SayCoeiroink {
    private config;
    private audioPlayer;
    private audioQueue;
    private isPlaying;
    private synthesisQueue;
    private activeSynthesis;
    private speechQueue;
    private isProcessing;
    constructor(config?: Config | null);
    initializeAudioPlayer(): Promise<boolean>;
    splitTextIntoChunks(text: string): Chunk[];
    getCurrentOperatorVoice(): Promise<OperatorVoice | null>;
    synthesizeChunk(chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number): Promise<AudioResult>;
    extractPCMFromWAV(wavBuffer: ArrayBuffer): Uint8Array;
    playAudioStream(audioResult: AudioResult): Promise<void>;
    playAudioFile(audioFile: string): Promise<void>;
    detectAudioPlayerSync(): string;
    applyCrossfade(pcmData: Uint8Array, overlapSamples: number): void;
    convertRateToSpeed(rate: number): number;
    streamSynthesizeAndPlay(text: string, voiceId: string | OperatorVoice, speed: number): Promise<void>;
    listVoices(): Promise<void>;
    saveAudio(audioBuffer: ArrayBuffer, outputFile: string): Promise<void>;
    checkServerConnection(): Promise<boolean>;
    enqueueSpeech(text: string, options?: SynthesizeOptions): SynthesizeResult;
    processSpeechQueue(): Promise<void>;
    synthesizeText(text: string, options?: SynthesizeOptions): Promise<SynthesizeResult>;
    synthesizeTextInternal(text: string, options?: SynthesizeOptions): Promise<SynthesizeResult>;
}
export default SayCoeiroink;
//# sourceMappingURL=index.d.ts.map