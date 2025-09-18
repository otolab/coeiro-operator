/**
 * synthesis-processor.test.ts: SynthesisProcessorのテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SynthesisProcessor } from './synthesis-processor.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { VoiceResolver } from './voice-resolver.js';
import type { Config, VoiceConfig, SynthesizeOptions } from './types.js';
import { BUFFER_SIZES } from './constants.js';

describe('SynthesisProcessor', () => {
  let synthesisProcessor: SynthesisProcessor;
  let mockConfig: Config;
  let mockAudioPlayer: AudioPlayer;
  let mockAudioSynthesizer: AudioSynthesizer;
  let mockVoiceResolver: VoiceResolver;

  const mockVoiceConfig: VoiceConfig = {
    speaker: {
      speakerId: 'test-speaker',
      speakerName: 'テストスピーカー',
      styles: [{ styleId: 0, styleName: 'ノーマル' }],
    },
    selectedStyleId: 0,
  };

  const mockAudioResult = {
    chunk: {
      text: 'テスト',
      index: 0,
      isFirst: true,
      isLast: true,
      overlap: 0,
    },
    audioBuffer: new ArrayBuffer(1024),
    latency: 100,
  };

  beforeEach(() => {
    // Configのモック
    mockConfig = {
      connection: { host: 'localhost', port: '50032' },
      operator: { rate: 200 },
      audio: {
        splitMode: 'punctuation',
        bufferSize: BUFFER_SIZES.DEFAULT,
        processing: {
          synthesisRate: 24000,
          playbackRate: 48000,
          noiseReduction: false,
          lowpassFilter: true,
          lowpassCutoff: 24000,
        },
      },
    } as Config;

    // AudioPlayerのモック
    mockAudioPlayer = {
      initialize: vi.fn().mockResolvedValue(true),
      setSynthesisRate: vi.fn(),
      setPlaybackRate: vi.fn(),
      setNoiseReduction: vi.fn(),
      setLowpassFilter: vi.fn(),
      saveAudio: vi.fn().mockResolvedValue(undefined),
      playStreamingAudio: vi.fn().mockResolvedValue(undefined),
    } as any;

    // AudioSynthesizerのモック
    mockAudioSynthesizer = {
      checkServerConnection: vi.fn().mockResolvedValue(true),
      convertRateToSpeed: vi.fn().mockReturnValue(1.0),
      synthesizeStream: vi.fn().mockImplementation(async function* () {
        yield mockAudioResult;
      }),
    } as any;

    // VoiceResolverのモック
    mockVoiceResolver = {
      resolveVoiceConfig: vi.fn().mockResolvedValue(mockVoiceConfig),
    } as any;

    synthesisProcessor = new SynthesisProcessor(
      mockConfig,
      mockAudioPlayer,
      mockAudioSynthesizer,
      mockVoiceResolver
    );
  });

  describe('process', () => {
    it('音声合成処理を実行できる', async () => {
      const result = await synthesisProcessor.process('テストテキスト');

      expect(result.success).toBe(true);
      expect(result.mode).toBe('streaming');
      expect(mockVoiceResolver.resolveVoiceConfig).toHaveBeenCalled();
      expect(mockAudioSynthesizer.checkServerConnection).toHaveBeenCalled();
    });

    it('ファイル出力モードで処理できる', async () => {
      const options: SynthesizeOptions = {
        outputFile: '/tmp/test.wav',
      };

      const result = await synthesisProcessor.process('テストテキスト', options);

      expect(result.success).toBe(true);
      expect(result.mode).toBe('file');
      expect(result.outputFile).toBe('/tmp/test.wav');
      expect(mockAudioPlayer.saveAudio).toHaveBeenCalled();
    });

    it('オプションが正しく解析される', async () => {
      const options: SynthesizeOptions = {
        voice: 'test-character',
        rate: 150,
        style: 'ハッピー',
        chunkMode: 'small',
        bufferSize: 512,
        allowFallback: false,
      };

      await synthesisProcessor.process('テストテキスト', options);

      expect(mockVoiceResolver.resolveVoiceConfig).toHaveBeenCalledWith(
        'test-character',
        'ハッピー',
        false
      );
      expect(mockAudioSynthesizer.convertRateToSpeed).toHaveBeenCalledWith(150);
    });

    it('サーバー接続エラーの場合は例外を投げる', async () => {
      mockAudioSynthesizer.checkServerConnection = vi.fn().mockResolvedValue(false);

      await expect(
        synthesisProcessor.process('テストテキスト')
      ).rejects.toThrow('Cannot connect to COEIROINK server');
    });

    it('AudioPlayer初期化エラーの場合は例外を投げる', async () => {
      mockAudioPlayer.initialize = vi.fn().mockResolvedValue(false);

      await expect(
        synthesisProcessor.process('テストテキスト')
      ).rejects.toThrow('音声プレーヤーの初期化に失敗しました');
    });
  });

  describe('initializeAudioPlayer', () => {
    it('AudioPlayerの設定を適用する', async () => {
      const initMethod = (synthesisProcessor as any).initializeAudioPlayer.bind(synthesisProcessor);
      await initMethod();

      expect(mockAudioPlayer.setSynthesisRate).toHaveBeenCalledWith(24000);
      expect(mockAudioPlayer.setPlaybackRate).toHaveBeenCalledWith(48000);
      expect(mockAudioPlayer.setNoiseReduction).toHaveBeenCalledWith(false);
      expect(mockAudioPlayer.setLowpassFilter).toHaveBeenCalledWith(true, 24000);
      expect(mockAudioPlayer.initialize).toHaveBeenCalled();
    });

    it('設定がない場合はデフォルト値を使用する', async () => {
      mockConfig.audio = undefined;
      synthesisProcessor = new SynthesisProcessor(
        mockConfig,
        mockAudioPlayer,
        mockAudioSynthesizer,
        mockVoiceResolver
      );

      const initMethod = (synthesisProcessor as any).initializeAudioPlayer.bind(synthesisProcessor);
      await initMethod();

      expect(mockAudioPlayer.initialize).toHaveBeenCalled();
      expect(mockAudioPlayer.setSynthesisRate).not.toHaveBeenCalled();
    });
  });

  describe('processFileOutput', () => {
    it('ファイル出力処理を実行できる', async () => {
      const processFileOutput = (synthesisProcessor as any).processFileOutput.bind(synthesisProcessor);
      const result = await processFileOutput(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'punctuation',
        '/tmp/output.wav'
      );

      expect(result.success).toBe(true);
      expect(result.outputFile).toBe('/tmp/output.wav');
      expect(result.mode).toBe('file');
      expect(mockAudioPlayer.saveAudio).toHaveBeenCalled();
    });

    it('複数チャンクを結合してファイル保存する', async () => {
      const chunks = [
        new ArrayBuffer(100),
        new ArrayBuffer(200),
        new ArrayBuffer(150),
      ];

      mockAudioSynthesizer.synthesizeStream = vi.fn().mockImplementation(async function* () {
        for (const audioBuffer of chunks) {
          yield {
            chunk: { text: 'chunk', index: 0, isFirst: false, isLast: false, overlap: 0 },
            audioBuffer,
            latency: 100,
          };
        }
      });

      const processFileOutput = (synthesisProcessor as any).processFileOutput.bind(synthesisProcessor);
      await processFileOutput(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'punctuation',
        '/tmp/output.wav'
      );

      // 結合されたバッファサイズを確認
      const savedBuffer = mockAudioPlayer.saveAudio.mock.calls[0][0];
      expect(savedBuffer.byteLength).toBe(450); // 100 + 200 + 150
    });
  });

  describe('processStreamingOutput', () => {
    it('ストリーミング再生処理を実行できる', async () => {
      const processStreamingOutput = (synthesisProcessor as any).processStreamingOutput.bind(synthesisProcessor);
      const result = await processStreamingOutput(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'punctuation',
        BUFFER_SIZES.DEFAULT
      );

      expect(result.success).toBe(true);
      expect(result.mode).toBe('streaming');
      expect(mockAudioPlayer.playStreamingAudio).toHaveBeenCalled();
    });

    it('指定されたバッファサイズを使用する', async () => {
      const bufferSize = 512;
      const processStreamingOutput = (synthesisProcessor as any).processStreamingOutput.bind(synthesisProcessor);
      await processStreamingOutput(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'punctuation',
        bufferSize
      );

      expect(mockAudioPlayer.playStreamingAudio).toHaveBeenCalledWith(
        expect.anything(),
        bufferSize
      );
    });

    it('チャンクモードが正しく渡される', async () => {
      const processStreamingOutput = (synthesisProcessor as any).processStreamingOutput.bind(synthesisProcessor);
      await processStreamingOutput(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'small',
        BUFFER_SIZES.DEFAULT
      );

      expect(mockAudioSynthesizer.synthesizeStream).toHaveBeenCalledWith(
        'テストテキスト',
        mockVoiceConfig,
        1.0,
        'small'
      );
    });
  });
});