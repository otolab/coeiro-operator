/**
 * src/say/preset.test.ts: latencyModeプリセット機能のテスト
 */

import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import type { Config, AudioConfig } from './types.js';
import Speaker from 'speaker';

// モックの設定
vi.mock('speaker', () => ({
    default: vi.fn()
}));
vi.mock('echogarden', () => ({
    default: {}
}));
vi.mock('dsp.js', () => ({
    default: {}
}));
vi.mock('node-libsamplerate', () => ({
    default: {}
}));

const MockSpeaker = Speaker as any;

describe('latencyModeプリセット機能', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('AudioPlayer プリセット設定', () => {
        test('ultra-lowプリセットでバッファサイズが最小限に設定されること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // ultra-lowプリセットの動作を検証：最小バッファサイズ(64)でSpeakerが初期化される
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 64  // ultra-lowプリセットの特徴：最小レイテンシのための小さなバッファ
            }));
        });

        test('balancedプリセットでバランスの取れたバッファサイズが設定されること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'balanced' }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // balancedプリセットの動作を検証：中程度のバッファサイズ(256)でSpeakerが初期化される
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 256  // balancedプリセットの特徴：レイテンシと品質のバランス
            }));
        });

        test('qualityプリセットで高品質のための大きなバッファサイズが設定されること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'quality' }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // qualityプリセットの動作を検証：大きなバッファサイズ(512)でSpeakerが初期化される
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 512  // qualityプリセットの特徴：高品質のための大きなバッファ
            }));
        });

        test('デフォルト（latencyMode未指定）でbalancedプリセットの動作となること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { splitMode: 'punctuation' }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // デフォルトでbalancedプリセットの動作を検証
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 256  // デフォルトbalancedプリセットのバッファサイズ
            }));
        });

        test('個別設定でプリセットが上書きされた動作となること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'ultra-low',
                    bufferSettings: {
                        highWaterMark: 128 // プリセットの64を上書き
                    }
                }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // 個別設定が反映された動作を検証：上書きされたバッファサイズ(128)が使用される
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 128  // 個別設定でプリセット値(64)が上書きされた結果
            }));
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

        test('ultra-lowプリセットでテキストが小さなチャンクに分割されること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: { latencyMode: 'ultra-low' }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            
            // ultra-lowプリセットの動作を検証：短いテキストは1チャンク、長いテキストは小さなサイズで分割
            const shortText = '短いテキスト'; // 6文字
            const longText = 'これは非常に長いテキストで、ultra-lowプリセットのsmallSize(20文字)を超えるため分割されるはずです。'; // 40+文字
            
            const shortChunks = audioSynthesizer.splitTextIntoChunks(shortText, 'small');
            const longChunks = audioSynthesizer.splitTextIntoChunks(longText, 'small');
            
            // 短いテキストは1チャンク
            expect(shortChunks).toHaveLength(1);
            expect(shortChunks[0].text).toBe(shortText);
            
            // 長いテキストはultra-lowプリセットの小さなサイズで分割される
            expect(longChunks.length).toBeGreaterThan(1);
            // 各チャンクの文字数がプリセットの小サイズ(20文字)以下であることを確認
            longChunks.forEach(chunk => {
                expect(chunk.text.length).toBeLessThanOrEqual(20); // ultra-lowプリセットのsmallSize
            });
        });

        test('個別設定でプリセットが上書きされた分割動作となること', () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'balanced',
                    splitSettings: {
                        mediumSize: 15 // プリセットの50を小さな値に上書き
                    }
                }
            };

            const audioSynthesizer = new AudioSynthesizer(config);
            
            // 上書きされた設定での分割動作を検証
            const testText = 'これはテストテキストです。個別設定でmediumSizeが15文字に設定されています。'; // 30+文字
            const chunks = audioSynthesizer.splitTextIntoChunks(testText, 'medium');
            
            // 上書きされたmediumSize(15文字)で分割されることを検証
            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach(chunk => {
                expect(chunk.text.length).toBeLessThanOrEqual(15); // 上書きされた値
            });
        });
    });

    describe('設定の階層化された適用', () => {
        test('設定の階層化が正しい動作を生むこと', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {
                    latencyMode: 'quality',
                    bufferSettings: {
                        highWaterMark: 1024 // qualityプリセットの512を上書き
                    }
                }
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();
            
            // 設定の階層化での動作を検証：個別設定(1024)がプリセット値(512)を上書き
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 1024 // 個別設定が優先された結果
            }));
        });

        test('設定未指定でもデフォルトプリセットの動作となること', async () => {
            const config: Config = {
                connection: { host: 'localhost', port: '50032' },
                voice: { rate: 200 },
                audio: {} // latencyMode未指定
            };

            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
            };
            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);

            const audioPlayer = new AudioPlayer(config);
            await audioPlayer.initialize();

            // 設定未指定でもデフォルトbalancedプリセットの動作を検証
            expect(MockSpeaker).toHaveBeenCalledWith(expect.objectContaining({
                highWaterMark: 256 // デフォルトbalancedプリセットのバッファサイズ
            }));
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
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
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
                vi.clearAllMocks();

                const config: Config = {
                    connection: { host: 'localhost', port: '50032' },
                    voice: { rate: 200 },
                    audio: { latencyMode }
                };

                const mockSpeakerInstance = {
                    write: vi.fn(),
                    end: vi.fn(),
                    on: vi.fn()
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