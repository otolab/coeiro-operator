/**
 * 句読点ポーズ機能のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioStreamController } from './audio-stream-controller.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import type { PunctuationPauseSettings, VoiceConfig } from './types.js';

// モックの作成
vi.mock('./audio-player.js', () => ({
  AudioPlayer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn(),
    play: vi.fn(),
    stop: vi.fn(),
    cleanup: vi.fn(),
    generateSilenceWAV: vi.fn((duration: number) => {
      // 簡単なWAVヘッダーとサイレンスデータを返す
      const sampleRate = 44100;
      const channels = 1;
      const bitsPerSample = 16;
      const samples = Math.floor((duration * sampleRate) / 1000);
      const dataSize = samples * channels * (bitsPerSample / 8);
      const fileSize = dataSize + 36;

      const buffer = new ArrayBuffer(fileSize + 8);
      const view = new DataView(buffer);

      // WAVヘッダー
      const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, fileSize, true);
      writeString(8, 'WAVE');
      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, channels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
      view.setUint16(32, channels * (bitsPerSample / 8), true);
      view.setUint16(34, bitsPerSample, true);
      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      return new Uint8Array(buffer);
    }),
  })),
}));

vi.mock('./audio-synthesizer.js', () => ({
  AudioSynthesizer: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue(new ArrayBuffer(1000)),
  })),
}));

describe('句読点ポーズ機能', () => {
  let controller: AudioStreamController;
  let player: AudioPlayer;
  let synthesizer: AudioSynthesizer;

  beforeEach(() => {
    player = new AudioPlayer();
    synthesizer = new AudioSynthesizer({} as any);
    controller = new AudioStreamController(player, synthesizer);
  });

  describe('calculatePauseDuration', () => {
    it('句点（。）のポーズ時間を正しく計算する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 8.0,
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          period: 2.0, // 2モーラ分のポーズ
        },
      };

      // speedScale=1.0の場合: 2.0モーラ ÷ 8.0モーラ/秒 = 0.25秒 = 250ms
      const duration = (controller as any).calculatePauseDuration(
        '。',
        1.0,
        voiceConfig,
        settings
      );
      expect(duration).toBe(250);

      // speedScale=2.0の場合: 2.0モーラ ÷ (8.0 × 2.0)モーラ/秒 = 0.125秒 = 125ms
      const durationFast = (controller as any).calculatePauseDuration(
        '。',
        2.0,
        voiceConfig,
        settings
      );
      expect(durationFast).toBe(125);
    });

    it('読点（、）のポーズ時間を正しく計算する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 7.5,
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          comma: 1.0, // 1モーラ分のポーズ
        },
      };

      // speedScale=1.0の場合: 1.0モーラ ÷ 7.5モーラ/秒 = 0.133...秒 = 133ms
      const duration = (controller as any).calculatePauseDuration(
        '、',
        1.0,
        voiceConfig,
        settings
      );
      expect(duration).toBe(133);
    });

    it('疑問符（？）のポーズ時間を正しく計算する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 6.0,
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          question: 2.5, // 2.5モーラ分のポーズ
        },
      };

      // speedScale=1.5の場合: 2.5モーラ ÷ (6.0 × 1.5)モーラ/秒 = 0.278秒 = 278ms
      const duration = (controller as any).calculatePauseDuration(
        '？',
        1.5,
        voiceConfig,
        settings
      );
      expect(duration).toBe(278);
    });

    it('感嘆符（！）のポーズ時間を正しく計算する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 8.0,
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          exclamation: 2.0, // 2モーラ分のポーズ
        },
      };

      // speedScale=0.5の場合: 2.0モーラ ÷ (8.0 × 0.5)モーラ/秒 = 0.5秒 = 500ms
      const duration = (controller as any).calculatePauseDuration(
        '！',
        0.5,
        voiceConfig,
        settings
      );
      expect(duration).toBe(500);
    });

    it('設定がない場合はデフォルト値を使用する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        // baseMorasPerSecondが未定義
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        // pauseMorasが未定義
      };

      // デフォルト値: baseMorasPerSecond=7.5, period=2.0
      // 2.0モーラ ÷ 7.5モーラ/秒 = 0.267秒 = 267ms
      const duration = (controller as any).calculatePauseDuration(
        '。',
        1.0,
        voiceConfig,
        settings
      );
      expect(duration).toBe(267);
    });

    it('設定が無効な場合は0を返す', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: false, // 無効化
      };

      const duration = (controller as any).calculatePauseDuration(
        '。',
        1.0,
        voiceConfig,
        settings
      );
      expect(duration).toBe(0);
    });

    it('未定義の設定の場合は0を返す', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const duration = (controller as any).calculatePauseDuration(
        '。',
        1.0,
        voiceConfig,
        undefined
      );
      expect(duration).toBe(0);
    });

    it('スタイル毎の話速設定を使用する', () => {
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        styleId: 'ねむねむ',
        baseMorasPerSecond: 8.0, // デフォルト値
        styleMorasPerSecond: {
          'のーまる': 8.0,
          'ねむねむ': 4.8, // ねむねむスタイルは遅い
        },
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          period: 2.0,
        },
      };

      // ねむねむスタイル: 2.0モーラ ÷ 4.8モーラ/秒 = 0.417秒 = 417ms
      const duration = (controller as any).calculatePauseDuration(
        '。',
        1.0,
        voiceConfig,
        settings
      );
      expect(duration).toBe(417);
    });
  });

  // processSpeechWithPunctuationは実装中のため、一旦コメントアウト
  describe.skip('processSpeechWithPunctuation', () => {
    it('句読点でテキストを分割してポーズを挿入する', async () => {
      const text = 'こんにちは。今日はいい天気ですね。';
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 8.0,
        speaker: {
          speakerName: 'テストスピーカー',
          speakerUuid: 'test-uuid',
          styles: [],
        },
        selectedStyleId: 0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          period: 2.0,
        },
      };

      const chunks = await (controller as any).processSpeechWithPunctuation(
        text,
        voiceConfig,
        1.0,
        settings
      );

      // チャンクが正しく生成されていることを確認
      expect(chunks).toHaveLength(3);
      expect(chunks[0].text).toBe('こんにちは');
      expect(chunks[0].isPause).toBe(false);
      expect(chunks[1].isPause).toBe(true);
      expect(chunks[1].duration).toBe(250); // 2.0 / 8.0 * 1000
      expect(chunks[2].text).toBe('今日はいい天気ですね');
    });

    it('複数の句読点タイプを処理する', async () => {
      const text = 'おはよう！元気ですか？今日は、頑張りましょう。';
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
        baseMorasPerSecond: 8.0,
      };

      const settings: PunctuationPauseSettings = {
        enabled: true,
        pauseMoras: {
          period: 2.0,
          exclamation: 2.0,
          question: 2.5,
          comma: 1.0,
        },
      };

      const chunks = await (controller as any).processSpeechWithPunctuation(
        text,
        voiceConfig,
        1.0,
        settings
      );

      // チャンクが正しく生成されていることを確認
      expect(chunks).toHaveLength(7);

      // 「おはよう」
      expect(chunks[0].text).toBe('おはよう');
      expect(chunks[0].isPause).toBe(false);

      // ！のポーズ（2.0モーラ）
      expect(chunks[1].isPause).toBe(true);
      expect(chunks[1].duration).toBe(250);

      // 「元気ですか」
      expect(chunks[2].text).toBe('元気ですか');
      expect(chunks[2].isPause).toBe(false);

      // ？のポーズ（2.5モーラ）
      expect(chunks[3].isPause).toBe(true);
      expect(chunks[3].duration).toBe(312);

      // 「今日は」
      expect(chunks[4].text).toBe('今日は');
      expect(chunks[4].isPause).toBe(false);

      // 、のポーズ（1.0モーラ）
      expect(chunks[5].isPause).toBe(true);
      expect(chunks[5].duration).toBe(125);

      // 「頑張りましょう」
      expect(chunks[6].text).toBe('頑張りましょう');
      expect(chunks[6].isPause).toBe(false);
    });

    it('ポーズが無効な場合は分割しない', async () => {
      const text = 'こんにちは。今日はいい天気ですね。';
      const voiceConfig: VoiceConfig = {
        speakerId: 'test',
      };

      const settings: PunctuationPauseSettings = {
        enabled: false,
      };

      const chunks = await (controller as any).processSpeechWithPunctuation(
        text,
        voiceConfig,
        1.0,
        settings
      );

      // 分割されず、1つのチャンクとして処理される
      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(text);
      expect(chunks[0].isPause).toBe(false);
    });
  });
});