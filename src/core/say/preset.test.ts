/**
 * src/say/preset.test.ts: latencyModeプリセット機能のテスト
 */

import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import type { Config, AudioConfig } from './types.js';
import Speaker from 'speaker';

// モックの設定
jest.mock('speaker');
jest.mock('echogarden', () => ({}));
jest.mock('dsp.js', () => ({}));
jest.mock('node-libsamplerate', () => ({}));

const MockSpeaker = Speaker as jest.MockedClass<typeof Speaker>;

describe('latencyModeプリセット機能', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('AudioPlayer プリセット設定', () => {
        test('ultra-lowプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const audioPlayer = new AudioPlayer(config);
            
            // プリベートメソッドにアクセスするため、any型でキャスト
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('ultra-low');
            expect(audioConfig.bufferSettings).toEqual({
                highWaterMark: 64,
                lowWaterMark: 32,
                dynamicAdjustment: true
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: false,
                prePhonemeLength: 0,
                postPhonemeLength: 0,
                firstChunkOnly: true
            });
            expect(audioConfig.crossfadeSettings).toEqual({
                enabled: false,
                skipFirstChunk: true,
                overlapSamples: 0
            });
        });

        test('balancedプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'balanced' }
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('balanced');
            expect(audioConfig.bufferSettings).toEqual({
                highWaterMark: 256,
                lowWaterMark: 128,
                dynamicAdjustment: true
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: true,
                prePhonemeLength: 0.01,
                postPhonemeLength: 0.01,
                firstChunkOnly: true
            });
            expect(audioConfig.crossfadeSettings).toEqual({
                enabled: true,
                skipFirstChunk: true,
                overlapSamples: 24
            });
        });

        test('qualityプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'quality' }
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('quality');
            expect(audioConfig.bufferSettings).toEqual({
                highWaterMark: 512,
                lowWaterMark: 256,
                dynamicAdjustment: false
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: true,
                prePhonemeLength: 0.02,
                postPhonemeLength: 0.02,
                firstChunkOnly: false
            });
            expect(audioConfig.crossfadeSettings).toEqual({
                enabled: true,
                skipFirstChunk: false,
                overlapSamples: 48
            });
        });

        test('デフォルト（latencyMode未指定）でbalancedが適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { splitMode: 'punctuation' }
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('balanced');
        });

        test('個別設定でプリセットが上書きされること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'ultra-low',
                    bufferSettings: {
                        highWaterMark: 128, // プリセットの64を上書き
                        dynamicAdjustment: false // プリセットのtrueを上書き
                    },
                    paddingSettings: {
                        enabled: true, // プリセットのfalseを上書き
                        prePhonemeLength: 0.005
                    }
                }
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('ultra-low');
            expect(audioConfig.bufferSettings).toEqual({
                highWaterMark: 128, // 上書きされた値
                lowWaterMark: 32,   // プリセット値
                dynamicAdjustment: false // 上書きされた値
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: true, // 上書きされた値
                prePhonemeLength: 0.005, // 上書きされた値
                postPhonemeLength: 0, // プリセット値
                firstChunkOnly: true // プリセット値
            });
        });
    });

    describe('AudioSynthesizer プリセット設定', () => {
        test('ultra-lowプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            const audioConfig = (audioSynthesizer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('ultra-low');
            expect(audioConfig.splitSettings).toEqual({
                smallSize: 20,
                mediumSize: 30,
                largeSize: 50,
                overlapRatio: 0.05
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: false,
                prePhonemeLength: 0,
                postPhonemeLength: 0,
                firstChunkOnly: true
            });
        });

        test('balancedプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'balanced' }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            const audioConfig = (audioSynthesizer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('balanced');
            expect(audioConfig.splitSettings).toEqual({
                smallSize: 30,
                mediumSize: 50,
                largeSize: 100,
                overlapRatio: 0.1
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: true,
                prePhonemeLength: 0.01,
                postPhonemeLength: 0.01,
                firstChunkOnly: true
            });
        });

        test('qualityプリセットが正しく適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'quality' }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            const audioConfig = (audioSynthesizer as any).audioConfig as AudioConfig;

            expect(audioConfig.latencyMode).toBe('quality');
            expect(audioConfig.splitSettings).toEqual({
                smallSize: 40,
                mediumSize: 70,
                largeSize: 150,
                overlapRatio: 0.15
            });
            expect(audioConfig.paddingSettings).toEqual({
                enabled: true,
                prePhonemeLength: 0.02,
                postPhonemeLength: 0.02,
                firstChunkOnly: false
            });
        });

        test('splitModeConfigでプリセット値が使用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            
            // splitTextIntoChunksメソッドを呼び出してプリセット設定が反映されることを確認
            const chunks = audioSynthesizer.splitTextIntoChunks('これはテストテキストです。', 'small');
            
            // ultra-lowプリセットのsmallSizeは20文字なので、この文字列（13文字）は1チャンクになる
            expect(chunks).toHaveLength(1);
            expect(chunks[0].text).toBe('これはテストテキストです。');
        });

        test('個別設定でプリセットが上書きされること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'balanced',
                    splitSettings: {
                        mediumSize: 80, // プリセットの50を上書き
                        overlapRatio: 0.2 // プリセットの0.1を上書き
                    }
                }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            const audioConfig = (audioSynthesizer as any).audioConfig as AudioConfig;

            expect(audioConfig.splitSettings).toEqual({
                smallSize: 30,    // プリセット値
                mediumSize: 80,   // 上書きされた値
                largeSize: 100,   // プリセット値
                overlapRatio: 0.2 // 上書きされた値
            });
        });
    });

    describe('設定の階層化された適用', () => {
        test('プリセット → 個別設定 → デフォルト値の順で適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'quality',
                    bufferSettings: {
                        highWaterMark: 1024 // 個別設定でプリセット値（512）を上書き
                        // lowWaterMark は未指定なのでプリセット値（256）が使用される
                        // dynamicAdjustment も未指定なのでプリセット値（false）が使用される
                    }
                }
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            expect(audioConfig.bufferSettings).toEqual({
                highWaterMark: 1024,        // 個別設定で上書き
                lowWaterMark: 256,          // プリセット値
                dynamicAdjustment: false    // プリセット値
            });
        });

        test('audio設定が未指定の場合もデフォルトプリセットが適用されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {} // latencyMode未指定
            };

            const audioPlayer = new AudioPlayer(config);
            const audioConfig = (audioPlayer as any).audioConfig as AudioConfig;

            // デフォルトの'balanced'プリセットが適用される
            expect(audioConfig.latencyMode).toBe('balanced');
            expect(audioConfig.bufferSettings?.highWaterMark).toBe(256);
        });
    });

    describe('プリセット機能の統合テスト', () => {
        test('AudioPlayerの初期化でプリセットが正しく反映されること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const mockSpeakerInstance = {
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn()
            };

            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();

            // ultra-lowプリセットのhighWaterMark（64）が初期化で使用されているか確認
            expect(MockSpeaker).toHaveBeenCalledWith({
                channels: 1,
                bitDepth: 16,
                sampleRate: 48000,
                highWaterMark: 64
            });
        });

        test('異なるプリセットで異なるバッファサイズが設定されること', async () => {
            const configs = [
                { latencyMode: 'ultra-low', expectedBuffer: 64 },
                { latencyMode: 'balanced', expectedBuffer: 256 },
                { latencyMode: 'quality', expectedBuffer: 512 }
            ] as const;

            for (const { latencyMode, expectedBuffer } of configs) {
                jest.clearAllMocks();

                const config: Config = {
                    connection: { host: 'localhost', port: '50032' },
                    voice: { rate: 200 },
                    audio: { latencyMode }
                };

                const mockSpeakerInstance = {
                    write: jest.fn(),
                    end: jest.fn(),
                    on: jest.fn()
                };

                MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

                const audioPlayer = new AudioPlayer(config);
                await audioPlayer.initialize();

                expect(MockSpeaker).toHaveBeenCalledWith(
                    expect.objectContaining({
                        highWaterMark: expectedBuffer
                    })
                );
            }
        });
    });
});