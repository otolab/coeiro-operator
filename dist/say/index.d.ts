/**
 * 設定ファイルを読み込み
 */
export function loadConfig(configFile?: null): Promise<any>;
export class SayCoeiroink {
    constructor(config?: null);
    config: {
        host: string;
        port: string;
        rate: number;
    };
    audioPlayer: string | null;
    audioQueue: any[];
    isPlaying: boolean;
    synthesisQueue: any[];
    activeSynthesis: Map<any, any>;
    speechQueue: any[];
    isProcessing: boolean;
    initializeAudioPlayer(): Promise<boolean>;
    splitTextIntoChunks(text: any): {
        text: any;
        index: number;
        isFirst: boolean;
        isLast: boolean;
        overlap: number;
    }[];
    getCurrentOperatorVoice(): Promise<{
        voice_id: any;
        character: any;
    } | null>;
    synthesizeChunk(chunk: any, voiceInfo: any, speed: any): Promise<{
        chunk: any;
        audioBuffer: ArrayBuffer;
        latency: number;
    }>;
    extractPCMFromWAV(wavBuffer: any): Uint8Array<any>;
    playAudioStream(audioResult: any): Promise<any>;
    playAudioFile(audioFile: any): Promise<any>;
    detectAudioPlayerSync(): string;
    applyCrossfade(pcmData: any, overlapSamples: any): void;
    convertRateToSpeed(rate: any): number;
    streamSynthesizeAndPlay(text: any, voiceId: any, speed: any): Promise<void>;
    listVoices(): Promise<void>;
    saveAudio(audioBuffer: any, outputFile: any): Promise<void>;
    checkServerConnection(): Promise<boolean>;
    enqueueSpeech(text: any, options?: {}): {
        success: boolean;
        taskId: number;
        queueLength: number;
    };
    processSpeechQueue(): Promise<void>;
    synthesizeText(text: any, options?: {}): Promise<{
        success: boolean;
        taskId: number;
        queueLength: number;
    }>;
    synthesizeTextInternal(text: any, options?: {}): Promise<{
        success: boolean;
        outputFile: any;
        latency: number;
        mode?: undefined;
    } | {
        success: boolean;
        mode: string;
        outputFile?: undefined;
        latency?: undefined;
    } | {
        success: boolean;
        mode: string;
        latency: number;
        outputFile?: undefined;
    }>;
}
export default SayCoeiroink;
//# sourceMappingURL=index.d.ts.map