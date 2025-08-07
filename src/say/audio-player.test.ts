/**
 * src/say/audio-player.test.ts: AudioPlayerクラステスト
 */

import { AudioPlayer } from './audio-player.js';
import type { AudioResult, Chunk, Config } from './types.js';
import Speaker from 'speaker';
import { readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// モックの設定
jest.mock('speaker');
jest.mock('fs/promises');
jest.mock('echogarden', () => ({}));
jest.mock('dsp.js', () => ({}));
jest.mock('node-libsamplerate', () => ({}));

const MockSpeaker = Speaker as jest.MockedClass<typeof Speaker>;
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;

describe('AudioPlayer', () => {
    let audioPlayer: AudioPlayer;
    let defaultConfig: Config;

    beforeEach(() => {
        defaultConfig = {
            connection: { host: 'localhost', port: '50032' },
            voice: { rate: 200 },
            audio: { latencyMode: 'balanced' }
        };
        audioPlayer = new AudioPlayer(defaultConfig);
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('正常に初期化できること', async () => {
            MockSpeaker.mockImplementation(() => ({
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn()
            } as any));

            const result = await audioPlayer.initialize();
            
            expect(result).toBe(true);
            expect(MockSpeaker).toHaveBeenCalledWith({
                channels: 1,
                bitDepth: 16,
                sampleRate: 48000,
                highWaterMark: 256
            });
        });

        test('初期化エラー時にfalseを返すこと', async () => {
            MockSpeaker.mockImplementation(() => {
                throw new Error('Speaker initialization failed');
            });

            const result = await audioPlayer.initialize();
            
            expect(result).toBe(false);
        });
    });

    describe('extractPCMFromWAV', () => {
        test('有効なWAVファイルからPCMデータを抽出できること', () => {
            // RIFFヘッダーとdataチャンクを含む最小WAVファイルをシミュレート
            const buffer = new ArrayBuffer(44 + 1000); // ヘッダー44バイト + データ1000バイト
            const view = new DataView(buffer);
            
            // RIFFヘッダー
            view.setUint32(0, 0x52494646, false); // "RIFF"
            view.setUint32(4, buffer.byteLength - 8, true); // ファイルサイズ
            view.setUint32(8, 0x57415645, false); // "WAVE"
            
            // fmtチャンク
            view.setUint32(12, 0x666d7420, false); // "fmt "
            view.setUint32(16, 16, true); // chunkサイズ
            
            // dataチャンク
            view.setUint32(36, 0x64617461, false); // "data"
            view.setUint32(40, 1000, true); // dataサイズ
            
            const pcmData = audioPlayer.extractPCMFromWAV(buffer);
            
            expect(pcmData).toBeInstanceOf(Uint8Array);
            expect(pcmData.length).toBe(1000);
        });

        test('無効なWAVファイルでエラーがスローされること', () => {
            const invalidBuffer = new ArrayBuffer(100);
            
            expect(() => {
                audioPlayer.extractPCMFromWAV(invalidBuffer);
            }).toThrow('Invalid WAV file');
        });

        test('dataチャンクが見つからない場合エラーがスローされること', () => {
            const buffer = new ArrayBuffer(44);
            const view = new DataView(buffer);
            
            // RIFFヘッダーのみ設定（dataチャンクなし）
            view.setUint32(0, 0x52494646, false); // "RIFF"
            view.setUint32(8, 0x57415645, false); // "WAVE"
            
            expect(() => {
                audioPlayer.extractPCMFromWAV(buffer);
            }).toThrow('WAV data chunk not found');
        });
    });

    describe('playAudioStream', () => {
        test('正常に音声ストリームを再生できること', async () => {
            // 初期化
            const mockSpeakerInstance = {
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn((event, callback) => {
                    if (event === 'close') {
                        // close イベントをすぐに発火
                        setTimeout(callback, 0);
                    }
                })
            };

            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);
            await audioPlayer.initialize();

            // テスト用のAudioResultを作成
            const buffer = new ArrayBuffer(44 + 1000);
            const view = new DataView(buffer);
            
            // RIFFヘッダー
            view.setUint32(0, 0x52494646, false); // "RIFF"
            view.setUint32(4, buffer.byteLength - 8, true);
            view.setUint32(8, 0x57415645, false); // "WAVE"
            
            // dataチャンク
            view.setUint32(36, 0x64617461, false); // "data"
            view.setUint32(40, 1000, true);

            const audioResult: AudioResult = {
                chunk: { text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: buffer,
                latency: 100
            };

            await audioPlayer.playAudioStream(audioResult);

            expect(mockSpeakerInstance.write).toHaveBeenCalled();
            expect(mockSpeakerInstance.end).toHaveBeenCalled();
        });

        test('初期化されていない場合エラーを投げること', async () => {
            const audioResult: AudioResult = {
                chunk: { text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(100),
                latency: 100
            };

            await expect(audioPlayer.playAudioStream(audioResult)).rejects.toThrow(
                '音声プレーヤーが初期化されていません'
            );
        });

        test('Speakerエラー時に適切なエラーを投げること', async () => {
            const mockSpeakerInstance = {
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn((event, callback) => {
                    if (event === 'error') {
                        setTimeout(() => callback(new Error('Speaker error')), 0);
                    }
                })
            };

            MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);
            await audioPlayer.initialize();

            const buffer = new ArrayBuffer(44 + 1000);
            const view = new DataView(buffer);
            view.setUint32(0, 0x52494646, false); // "RIFF"
            view.setUint32(36, 0x64617461, false); // "data"
            view.setUint32(40, 1000, true);

            const audioResult: AudioResult = {
                chunk: { text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: buffer,
                latency: 100
            };

            await expect(audioPlayer.playAudioStream(audioResult)).rejects.toThrow(
                '音声再生エラー: Speaker error'
            );
        });
    });

    describe('applyCrossfade', () => {
        test('オーバーラップなしの場合、元のデータがそのまま返されること', () => {
            const originalData = new Uint8Array([100, 150, 200, 250]);
            const result = audioPlayer.applyCrossfade(originalData, 0, false);
            
            expect(result).toEqual(originalData);
            expect(result).not.toBe(originalData); // 新しい配列であることを確認
        });

        test('オーバーラップありの場合（非先頭チャンク）、フェードが適用されること', () => {
            const originalData = new Uint8Array([100, 150, 200, 250, 100, 150]);
            const result = audioPlayer.applyCrossfade(originalData, 1, false);
            
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(originalData.length);
            // 最初のサンプルがフェードされているか確認
            expect(result[0]).toBeLessThan(originalData[0]);
        });

        test('先頭チャンクの場合、フェードがスキップされること', () => {
            const originalData = new Uint8Array([100, 150, 200, 250]);
            const result = audioPlayer.applyCrossfade(originalData, 1, true);
            
            expect(result).toEqual(originalData);
        });

        test('オーバーラップが大きすぎる場合、処理がスキップされること', () => {
            const originalData = new Uint8Array([100, 150]);
            const result = audioPlayer.applyCrossfade(originalData, 10, false); // データサイズより大きい
            
            expect(result).toEqual(originalData);
        });
    });

    describe('saveAudio', () => {
        test('音声データを正常にファイルに保存できること', async () => {
            const audioBuffer = new ArrayBuffer(1000);
            const outputFile = '/test/path/output.wav';
            
            mockWriteFile.mockResolvedValueOnce(undefined);
            
            await audioPlayer.saveAudio(audioBuffer, outputFile);
            
            expect(mockWriteFile).toHaveBeenCalledWith(
                outputFile,
                Buffer.from(audioBuffer)
            );
        });

        test('ファイル保存エラー時に適切なエラーがスローされること', async () => {
            const audioBuffer = new ArrayBuffer(1000);
            const outputFile = '/invalid/path/output.wav';
            
            mockWriteFile.mockRejectedValueOnce(new Error('Permission denied'));
            
            await expect(
                audioPlayer.saveAudio(audioBuffer, outputFile)
            ).rejects.toThrow('音声ファイル保存エラー: Permission denied');
        });
    });

    describe('エッジケース', () => {
        test('空のオーディオバッファでも正常に処理されること', async () => {
            const emptyBuffer = new ArrayBuffer(0);
            const outputFile = '/test/empty.wav';
            
            mockWriteFile.mockResolvedValueOnce(undefined);
            
            await expect(
                audioPlayer.saveAudio(emptyBuffer, outputFile)
            ).resolves.not.toThrow();
            
            expect(mockWriteFile).toHaveBeenCalledWith(
                outputFile,
                Buffer.from(emptyBuffer)
            );
        });

        test('非常に大きなオーディオバッファでも処理されること', async () => {
            // 1MBのバッファをシミュレート（メモリ効率のため100MBから削減）
            const largeBuffer = new ArrayBuffer(1024 * 1024);
            const outputFile = '/test/large.wav';
            
            mockWriteFile.mockResolvedValueOnce(undefined);
            
            await expect(
                audioPlayer.saveAudio(largeBuffer, outputFile)
            ).resolves.not.toThrow();
        });

        test('無効なファイルパスでも適切にエラーハンドリングされること', async () => {
            const audioBuffer = new ArrayBuffer(1000);
            const invalidPath = '';
            
            mockWriteFile.mockRejectedValueOnce(new Error('Invalid path'));
            
            await expect(
                audioPlayer.saveAudio(audioBuffer, invalidPath)
            ).rejects.toThrow('音声ファイル保存エラー: Invalid path');
        });
    });
});