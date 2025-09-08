/**
 * Audio Playback Mock
 * 音声再生機能のモック実装
 */
import { EventEmitter } from 'events';
/**
 * 音声再生のモック実装
 */
export class AudioPlayerMock extends EventEmitter {
    playing = false;
    playCount = 0;
    lastBuffer = null;
    playDuration = 100; // デフォルト再生時間（ms）
    constructor(options) {
        super();
        if (options?.playDuration) {
            this.playDuration = options.playDuration;
        }
    }
    async play(buffer) {
        if (this.playing) {
            throw new Error('Already playing');
        }
        this.playing = true;
        this.playCount++;
        this.lastBuffer = buffer;
        this.emit('play-start', buffer);
        // 再生時間をシミュレート
        await new Promise(resolve => setTimeout(resolve, this.playDuration));
        this.playing = false;
        this.emit('play-end', buffer);
    }
    stop() {
        if (this.playing) {
            this.playing = false;
            this.emit('stop');
        }
    }
    isPlaying() {
        return this.playing;
    }
    getPlayCount() {
        return this.playCount;
    }
    getLastPlayedBuffer() {
        return this.lastBuffer;
    }
    reset() {
        this.playing = false;
        this.playCount = 0;
        this.lastBuffer = null;
        this.removeAllListeners();
    }
    // テスト用ヘルパー
    setPlayDuration(duration) {
        this.playDuration = duration;
    }
}
/**
 * Speaker モジュールのモック
 */
export class SpeakerMock extends EventEmitter {
    written = [];
    closed = false;
    sampleRate;
    channels;
    bitDepth;
    constructor(options) {
        super();
        this.sampleRate = options?.sampleRate || 48000;
        this.channels = options?.channels || 2;
        this.bitDepth = options?.bitDepth || 16;
        // 初期化完了を非同期で通知
        process.nextTick(() => {
            this.emit('open');
        });
    }
    write(buffer) {
        if (this.closed) {
            throw new Error('Speaker is closed');
        }
        this.written.push(buffer);
        this.emit('write', buffer);
        // バックプレッシャーのシミュレート
        return this.written.length < 10;
    }
    end() {
        this.closed = true;
        this.emit('close');
    }
    close() {
        this.end();
    }
    // テスト用メソッド
    getWrittenData() {
        return this.written;
    }
    getTotalBytesWritten() {
        return this.written.reduce((sum, buf) => sum + buf.length, 0);
    }
    reset() {
        this.written = [];
        this.closed = false;
        this.removeAllListeners();
    }
}
//# sourceMappingURL=audio-mock.js.map