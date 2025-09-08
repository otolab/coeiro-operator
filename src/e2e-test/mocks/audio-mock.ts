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
export class AudioPlayerMock extends EventEmitter implements MockAudioPlayer {
  private playing: boolean = false;
  private playCount: number = 0;
  private lastBuffer: Buffer | null = null;
  private playDuration: number = 100; // デフォルト再生時間（ms）

  constructor(options?: { playDuration?: number }) {
    super();
    if (options?.playDuration) {
      this.playDuration = options.playDuration;
    }
  }

  async play(buffer: Buffer): Promise<void> {
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

  stop(): void {
    if (this.playing) {
      this.playing = false;
      this.emit('stop');
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getPlayCount(): number {
    return this.playCount;
  }

  getLastPlayedBuffer(): Buffer | null {
    return this.lastBuffer;
  }

  reset(): void {
    this.playing = false;
    this.playCount = 0;
    this.lastBuffer = null;
    this.removeAllListeners();
  }

  // テスト用ヘルパー
  setPlayDuration(duration: number): void {
    this.playDuration = duration;
  }
}

/**
 * Speaker モジュールのモック
 */
export class SpeakerMock extends EventEmitter {
  private written: Buffer[] = [];
  private closed: boolean = false;
  private sampleRate: number;
  private channels: number;
  private bitDepth: number;

  constructor(options?: { sampleRate?: number; channels?: number; bitDepth?: number }) {
    super();
    this.sampleRate = options?.sampleRate || 48000;
    this.channels = options?.channels || 2;
    this.bitDepth = options?.bitDepth || 16;

    // 初期化完了を非同期で通知
    process.nextTick(() => {
      this.emit('open');
    });
  }

  write(buffer: Buffer): boolean {
    if (this.closed) {
      throw new Error('Speaker is closed');
    }

    this.written.push(buffer);
    this.emit('write', buffer);

    // バックプレッシャーのシミュレート
    return this.written.length < 10;
  }

  end(): void {
    this.closed = true;
    this.emit('close');
  }

  close(): void {
    this.end();
  }

  // テスト用メソッド
  getWrittenData(): Buffer[] {
    return this.written;
  }

  getTotalBytesWritten(): number {
    return this.written.reduce((sum, buf) => sum + buf.length, 0);
  }

  reset(): void {
    this.written = [];
    this.closed = false;
    this.removeAllListeners();
  }
}
