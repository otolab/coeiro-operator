/**
 * Audio Playback Mock
 * 音声再生機能のモック実装
 */
import { EventEmitter } from 'events';
export interface MockAudioPlayer {
    play(buffer: Buffer): Promise<void>;
    stop(): void;
    isPlaying(): boolean;
    getPlayCount(): number;
    getLastPlayedBuffer(): Buffer | null;
    reset(): void;
}
/**
 * 音声再生のモック実装
 */
export declare class AudioPlayerMock extends EventEmitter implements MockAudioPlayer {
    private playing;
    private playCount;
    private lastBuffer;
    private playDuration;
    constructor(options?: {
        playDuration?: number;
    });
    play(buffer: Buffer): Promise<void>;
    stop(): void;
    isPlaying(): boolean;
    getPlayCount(): number;
    getLastPlayedBuffer(): Buffer | null;
    reset(): void;
    setPlayDuration(duration: number): void;
}
/**
 * Speaker モジュールのモック
 */
export declare class SpeakerMock extends EventEmitter {
    private written;
    private closed;
    private sampleRate;
    private channels;
    private bitDepth;
    constructor(options?: {
        sampleRate?: number;
        channels?: number;
        bitDepth?: number;
    });
    write(buffer: Buffer): boolean;
    end(): void;
    close(): void;
    getWrittenData(): Buffer[];
    getTotalBytesWritten(): number;
    reset(): void;
}
//# sourceMappingURL=audio-mock.d.ts.map