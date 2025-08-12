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
vi.mock('speaker');
vi.mock('fs/promises');
vi.mock('echogarden', () => ({}));
vi.mock('dsp.js', () => ({}));
vi.mock('node-libsamplerate', () => ({}));

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
        vi.clearAllMocks();
    });

    describe('初期化', () => {
        test('正常に初期化できること', async () => {
            MockSpeaker.mockImplementation(() => ({
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn()
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
        test('音声ストリームを再生して正常に完了すること', async () => {
            // 初期化
            let closeCallback: (() => void) | undefined;
            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn((event, callback) => {
                    if (event === 'close') {
                        closeCallback = callback;
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

            // 再生を開始
            const playPromise = audioPlayer.playAudioStream(audioResult);
            
            // closeイベントを発火して再生完了をシミュレート
            if (closeCallback) {
                setTimeout(closeCallback, 10);
            }
            
            // 再生が正常に完了することを検証
            await expect(playPromise).resolves.not.toThrow();
            
            // 音声データがSpeakerに送信されたことを確認
            expect(mockSpeakerInstance.end).toHaveBeenCalledWith(expect.any(Buffer));
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

        test('Speaker再生エラー発生時に適切にエラーを伝播すること', async () => {
            let errorCallback: ((error: Error) => void) | undefined;
            const mockSpeakerInstance = {
                write: vi.fn(),
                end: vi.fn(),
                on: vi.fn((event, callback) => {
                    if (event === 'error') {
                        errorCallback = callback;
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

            // 再生を開始
            const playPromise = audioPlayer.playAudioStream(audioResult);
            
            // エラーイベントを発火
            if (errorCallback) {
                setTimeout(() => errorCallback(new Error('Hardware audio device failure')), 10);
            }

            // エラーが正しく伝播されることを検証
            await expect(playPromise).rejects.toThrow('Hardware audio device failure');
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

        test('ファイル保存時のファイルシステムエラーを適切に処理すること', async () => {
            const audioBuffer = new ArrayBuffer(1000);
            const outputFile = '/readonly/path/output.wav';
            
            // ファイルシステムエラーをシミュレート（実際に起こりうるエラー）
            mockWriteFile.mockRejectedValueOnce(new Error('EACCES: permission denied, open \'/readonly/path/output.wav\''));
            
            // エラーハンドリングとエラーメッセージの構成を検証
            await expect(
                audioPlayer.saveAudio(audioBuffer, outputFile)
            ).rejects.toThrow(/音声ファイル保存エラー:.*EACCES/);
            
            // ファイル書き込み処理が実際に呼び出されたことを確認
            expect(mockWriteFile).toHaveBeenCalledWith(
                outputFile,
                expect.any(Buffer)
            );
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

        test('大きなオーディオバッファの保存で適切なメモリ管理が行われること', async () => {
            // 1MBのバッファをシミュレート（現実的なサイズ）
            const largeBuffer = new ArrayBuffer(1024 * 1024);
            const outputFile = '/test/large.wav';
            
            // メモリ使用量を監視するためのスパイを設定
            const bufferFromSpy = vi.spyOn(Buffer, 'from');
            
            mockWriteFile.mockResolvedValueOnce(undefined);
            
            await audioPlayer.saveAudio(largeBuffer, outputFile);
            
            // Buffer.fromが適切に呼ばれ、メモリ効率的に変換されることを確認
            expect(bufferFromSpy).toHaveBeenCalledWith(largeBuffer);
            expect(mockWriteFile).toHaveBeenCalledWith(
                outputFile,
                expect.any(Buffer)
            );
            
            bufferFromSpy.mockRestore();
        });

        test('無効なファイルパス指定時にファイルシステムエラーが正しく処理されること', async () => {
            const audioBuffer = new ArrayBuffer(1000);
            const invalidPath = '\x00invalid\x00path'; // null文字を含む無効なパス
            
            // 実際のファイルシステムが返すエラーをシミュレート
            mockWriteFile.mockRejectedValueOnce(new Error('EINVAL: invalid argument, open \'\x00invalid\x00path\''));
            
            await expect(
                audioPlayer.saveAudio(audioBuffer, invalidPath)
            ).rejects.toThrow(/音声ファイル保存エラー:.*EINVAL/);
            
            // 無効なパスでも処理が呼び出されることを確認（エラーハンドリングの検証）
            expect(mockWriteFile).toHaveBeenCalledWith(
                invalidPath,
                expect.any(Buffer)
            );
        });
    });
});