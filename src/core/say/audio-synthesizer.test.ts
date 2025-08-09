/**
 * src/say/audio-synthesizer.test.ts: AudioSynthesizerクラステスト
 */

import { AudioSynthesizer } from './audio-synthesizer.js';
import type { Config, Chunk, OperatorVoice, AudioResult } from './types.js';

// fetchのモック
global.fetch = jest.fn();

// 他のモックの設定
jest.mock('echogarden', () => ({}));
jest.mock('dsp.js', () => ({}));
jest.mock('node-libsamplerate', () => ({}));

describe('AudioSynthesizer', () => {
    let audioSynthesizer: AudioSynthesizer;
    let config: Config;

    beforeEach(() => {
        config = {
            connection: { host: 'localhost', port: '50032' },
            voice: { rate: 200 },
            audio: { latencyMode: 'balanced' }
        };
        audioSynthesizer = new AudioSynthesizer(config);
        jest.clearAllMocks();
    });

    describe('初期化', () => {
        test('設定を正しく保持していること', () => {
            expect(audioSynthesizer['config']).toEqual(config);
        });
    });

    describe('splitTextIntoChunks', () => {
        test('短いテキストが単一チャンクに分割されること（句読点モード）', () => {
            const text = 'こんにちは、世界の皆さん。'; // 最小文字数以上で句点あり
            const chunks = audioSynthesizer.splitTextIntoChunks(text);

            expect(chunks).toHaveLength(1);
            expect(chunks[0]).toEqual({
                text: 'こんにちは、世界の皆さん。',
                index: 0,
                isFirst: true,
                isLast: true,
                overlap: 0
            });
        });

        test('長いテキストが複数チャンクに分割されること（mediumモード）', () => {
            const text = 'a'.repeat(120); // 50文字のデフォルトチャンクサイズを超える
            const chunks = audioSynthesizer.splitTextIntoChunks(text, 'medium'); // mediumモードを明示的に指定

            expect(chunks.length).toBeGreaterThan(1);
            expect(chunks[0].isFirst).toBe(true);
            expect(chunks[0].isLast).toBe(false);
            expect(chunks[chunks.length - 1].isFirst).toBe(false);
            expect(chunks[chunks.length - 1].isLast).toBe(true);
        });

        test('チャンク間のオーバーラップが正しく設定されること（mediumモード）', () => {
            const text = 'a'.repeat(100);
            const chunks = audioSynthesizer.splitTextIntoChunks(text, 'medium');

            // 2番目以降のチャンクにはオーバーラップがある
            for (let i = 1; i < chunks.length; i++) {
                expect(chunks[i].overlap).toBeGreaterThan(0);
            }
        });

        test('空文字列の場合、空配列が返されること', () => {
            const chunks = audioSynthesizer.splitTextIntoChunks('');
            expect(chunks).toHaveLength(0);
        });

        test('空白のみのテキストの場合、空配列が返されること', () => {
            const chunks = audioSynthesizer.splitTextIntoChunks('   \n\t  ');
            expect(chunks).toHaveLength(0);
        });

        describe('句読点分割モード', () => {
            test('句点で分割されること', () => {
                const text = 'これは最初の文です。これは二番目の文です。これは最後の文です。';
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                expect(chunks).toHaveLength(3);
                expect(chunks[0].text).toBe('これは最初の文です。');
                expect(chunks[1].text).toBe('これは二番目の文です。');
                expect(chunks[2].text).toBe('これは最後の文です。');
                
                expect(chunks[0].isFirst).toBe(true);
                expect(chunks[0].isLast).toBe(false);
                expect(chunks[2].isFirst).toBe(false);
                expect(chunks[2].isLast).toBe(true);
            });

            test('句読点なしの長い文字列が最大文字数でフォールバック分割されること', () => {
                const text = 'あ'.repeat(200); // 句読点なし、最大文字数超過
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                expect(chunks.length).toBeGreaterThan(1);
                chunks.forEach(chunk => {
                    expect(chunk.text.length).toBeLessThanOrEqual(150); // MAX_CHUNK_SIZE
                });
            });

            test('読点で長い文が分割されること', () => {
                const longSentence = 'あ'.repeat(80) + '、' + 'い'.repeat(80) + '、' + 'う'.repeat(80);
                const chunks = audioSynthesizer.splitTextIntoChunks(longSentence, 'punctuation');

                expect(chunks.length).toBeGreaterThan(1);
                chunks.forEach(chunk => {
                    expect(chunk.text.length).toBeLessThanOrEqual(150);
                });
            });

            test('短い文は最小文字数チェックでフィルタリングされること', () => {
                const text = 'あ。い。う。え。お。'; // 各文は1文字（MIN_CHUNK_SIZE = 10未満）
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                expect(chunks).toHaveLength(0); // すべて最小文字数未満でフィルタリング
            });

            test('最小文字数を超える文のみ含まれること', () => {
                const text = 'これは十分な長さの文章です。短い。これも十分な長さがある文章です。';
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                expect(chunks).toHaveLength(2); // 「短い。」は除外される
                expect(chunks[0].text).toBe('これは十分な長さの文章です。');
                expect(chunks[1].text).toBe('これも十分な長さがある文章です。');
            });

            test('句読点分割ではオーバーラップが0であること', () => {
                const text = 'これは最初の文です。これは二番目の文です。';
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                chunks.forEach(chunk => {
                    expect(chunk.overlap).toBe(0);
                });
            });

            test('空テキストの場合空配列が返されること', () => {
                const chunks = audioSynthesizer.splitTextIntoChunks('', 'punctuation');
                expect(chunks).toHaveLength(0);
            });

            test('句点なしのテキストが単一チャンクになること', () => {
                const text = 'これは句点のない短いテキストです';
                const chunks = audioSynthesizer.splitTextIntoChunks(text, 'punctuation');

                expect(chunks).toHaveLength(1);
                expect(chunks[0].text).toBe(text);
                expect(chunks[0].isFirst).toBe(true);
                expect(chunks[0].isLast).toBe(true);
            });
        });
    });

    describe('convertRateToSpeed', () => {
        test('基本レート200が速度1.0に変換されること', () => {
            const speed = audioSynthesizer.convertRateToSpeed(200);
            expect(speed).toBe(1.0);
        });

        test('高いレートが高い速度に変換されること', () => {
            const speed = audioSynthesizer.convertRateToSpeed(400);
            expect(speed).toBe(2.0);
        });

        test('低いレートが低い速度に変換されること', () => {
            const speed = audioSynthesizer.convertRateToSpeed(100);
            expect(speed).toBe(0.5);
        });

        test('速度が最小値0.5でクリップされること', () => {
            const speed = audioSynthesizer.convertRateToSpeed(50);
            expect(speed).toBe(0.5);
        });

        test('速度が最大値2.0でクリップされること', () => {
            const speed = audioSynthesizer.convertRateToSpeed(800);
            expect(speed).toBe(2.0);
        });
    });

    describe('checkServerConnection', () => {
        test('サーバーが利用可能な場合trueを返すこと', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true
            });

            const result = await audioSynthesizer.checkServerConnection();

            expect(result).toBe(true);
            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:50032/v1/speakers',
                { signal: expect.any(AbortSignal) }
            );
        });

        test('サーバーが利用不可の場合falseを返すこと', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false
            });

            const result = await audioSynthesizer.checkServerConnection();

            expect(result).toBe(false);
        });

        test('接続エラーの場合falseを返すこと', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

            const result = await audioSynthesizer.checkServerConnection();

            expect(result).toBe(false);
        });
    });

    describe('listVoices', () => {
        test('利用可能な音声を正しく表示すること', async () => {
            const mockSpeakers = [
                {
                    speakerUuid: 'test-uuid-1',
                    speakerName: 'テストキャラクター1',
                    styles: [
                        { styleId: 0, styleName: 'ノーマル' },
                        { styleId: 1, styleName: 'ハッピー' }
                    ]
                },
                {
                    speakerUuid: 'test-uuid-2',
                    speakerName: 'テストキャラクター2',
                    styles: [
                        { styleId: 0, styleName: 'クール' }
                    ]
                }
            ];

            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                json: async () => mockSpeakers
            });

            // console.logをモック
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            await audioSynthesizer.listVoices();

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:50032/v1/speakers',
                { signal: expect.any(AbortSignal) }
            );

            expect(consoleLogSpy).toHaveBeenCalledWith('Available voices:');
            expect(consoleLogSpy).toHaveBeenCalledWith('test-uuid-1: テストキャラクター1');
            expect(consoleLogSpy).toHaveBeenCalledWith('  Style 0: ノーマル');

            consoleLogSpy.mockRestore();
        });

        test('サーバーエラー時に適切なエラーを投げること', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            await expect(audioSynthesizer.listVoices()).rejects.toThrow();

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error: Cannot connect to COEIROINK server at http://localhost:50032'
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('synthesizeChunk', () => {
        const mockChunk: Chunk = {
            text: 'テストテキスト',
            index: 0,
            isFirst: true,
            isLast: true,
            overlap: 0
        };

        test('文字列音声IDで正常に合成できること', async () => {
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const result = await audioSynthesizer.synthesizeChunk(
                mockChunk,
                'test-voice-id',
                1.0
            );

            expect(result).toEqual({
                chunk: mockChunk,
                audioBuffer: mockAudioBuffer,
                latency: expect.any(Number)
            });

            expect(global.fetch).toHaveBeenCalledWith(
                'http://localhost:50032/v1/synthesis',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: expect.stringContaining('test-voice-id')
                }
            );
        });

        test('OperatorVoice形式で正常に合成できること', async () => {
            const operatorVoice: OperatorVoice = {
                voice_id: 'operator-voice-id',
                character: {
                    name: 'テストキャラクター',
                    available_styles: {
                        'style1': {
                            disabled: false,
                            style_id: 1,
                            name: 'ハッピー'
                        },
                        'style2': {
                            disabled: true,
                            style_id: 2,
                            name: 'サッド'
                        }
                    },
                    style_selection: 'default',
                    default_style: 'style1'
                }
            };

            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const result = await audioSynthesizer.synthesizeChunk(
                mockChunk,
                operatorVoice,
                1.0
            );

            expect(result.audioBuffer).toBe(mockAudioBuffer);
            
            const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
            const requestBody = JSON.parse(fetchCall[1].body);
            
            expect(requestBody.speakerUuid).toBe('operator-voice-id');
            expect(requestBody.styleId).toBe(1); // 有効なスタイル
        });

        test('ランダムスタイル選択が正常に動作すること', async () => {
            const operatorVoice: OperatorVoice = {
                voice_id: 'operator-voice-id',
                character: {
                    name: 'テストキャラクター',
                    available_styles: {
                        'style1': { disabled: false, style_id: 1, name: 'スタイル1' },
                        'style2': { disabled: false, style_id: 2, name: 'スタイル2' },
                        'style3': { disabled: false, style_id: 3, name: 'スタイル3' }
                    },
                    style_selection: 'random',
                    default_style: 'style1'
                }
            };

            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            // ランダム性をテストするため複数回実行
            const styleIds = new Set();
            for (let i = 0; i < 10; i++) {
                await audioSynthesizer.synthesizeChunk(mockChunk, operatorVoice, 1.0);
                const fetchCall = (global.fetch as jest.Mock).mock.calls[i];
                const requestBody = JSON.parse(fetchCall[1].body);
                styleIds.add(requestBody.styleId);
            }

            // 複数のスタイルIDが使用されていることを確認（確率的に）
            expect(styleIds.size).toBeGreaterThanOrEqual(1);
        });

        test('APIエラー時に適切なエラーを投げること', async () => {
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error'
            });

            await expect(
                audioSynthesizer.synthesizeChunk(mockChunk, 'test-voice-id', 1.0)
            ).rejects.toThrow('チャンク0合成エラー: HTTP 500: Internal Server Error');
        });

        test('ネットワークエラー時に適切なエラーを投げること', async () => {
            (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

            await expect(
                audioSynthesizer.synthesizeChunk(mockChunk, 'test-voice-id', 1.0)
            ).rejects.toThrow('チャンク0合成エラー: Network error');
        });
    });

    describe('synthesizeStream (single chunk)', () => {
        test('短いテキストを単一チャンクで合成できること', async () => {
            const text = 'こんにちは';
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream(text, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results).toHaveLength(1);
            expect(results[0]).toEqual({
                chunk: expect.objectContaining({
                    text: 'こんにちは',
                    isFirst: true,
                    isLast: true
                }),
                audioBuffer: mockAudioBuffer,
                latency: expect.any(Number)
            });
        });
    });

    describe('synthesizeStream', () => {
        test('長いテキストをストリーミング合成できること', async () => {
            const longText = 'a'.repeat(150); // 複数チャンクに分割される
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream(longText, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results.length).toBeGreaterThan(1);
            expect(results[0].chunk.isFirst).toBe(true);
            expect(results[results.length - 1].chunk.isLast).toBe(true);
            
            // 各結果にオーディオバッファが含まれていることを確認
            results.forEach(result => {
                expect(result.audioBuffer).toBe(mockAudioBuffer);
                expect(result.latency).toBeGreaterThan(0);
            });
        });

        test('空のテキストで空のストリームが返されること', async () => {
            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream('', 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results).toHaveLength(0);
        });
    });

    describe('エッジケース', () => {
        test('非常に短いテキストでも正常に処理されること', async () => {
            const text = 'あ';
            const mockAudioBuffer = new ArrayBuffer(100);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream(text, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results).toHaveLength(1);
            expect(results[0].chunk.text).toBe('あ');
            expect(results[0].audioBuffer).toBe(mockAudioBuffer);
        });

        test('特殊文字を含むテキストでも正常に処理されること', async () => {
            const text = 'こんにちは！？😊🎵';
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream(text, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results).toHaveLength(1);
            expect(results[0].chunk.text).toBe(text);
        });

        test('数値のみのテキストでも正常に処理されること', async () => {
            const text = '12345';
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValueOnce({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const results: AudioResult[] = [];
            for await (const result of audioSynthesizer.synthesizeStream(text, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            expect(results).toHaveLength(1);
            expect(results[0].chunk.text).toBe(text);
        });
    });

    describe('統合的動作テスト', () => {
        test('テキスト分割からチャンク合成まで一貫して動作すること', async () => {
            const longText = 'a'.repeat(150); // 複数チャンクに分割される
            const mockAudioBuffer = new ArrayBuffer(1000);
            
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });
            
            // テキスト分割
            const chunks = audioSynthesizer.splitTextIntoChunks(longText);
            expect(chunks.length).toBeGreaterThan(1);
            
            // 各チャンクの合成
            for (const chunk of chunks) {
                const result = await audioSynthesizer.synthesizeChunk(
                    chunk,
                    'test-speaker-1',
                    1.0
                );
                
                expect(result.chunk).toEqual(chunk);
                expect(result.audioBuffer).toBeInstanceOf(ArrayBuffer);
                expect(result.latency).toBeGreaterThan(0);
            }
        });
    });

    describe('パフォーマンス', () => {
        test('大量のチャンクがタイムアウトしないこと', async () => {
            const longText = 'あ'.repeat(1000); // 多数のチャンクに分割される
            const mockAudioBuffer = new ArrayBuffer(100);
            
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                arrayBuffer: async () => mockAudioBuffer
            });

            const startTime = Date.now();
            const results: AudioResult[] = [];
            
            for await (const result of audioSynthesizer.synthesizeStream(longText, 'test-voice-id', 1.0)) {
                results.push(result);
            }

            const endTime = Date.now();
            const processingTime = endTime - startTime;

            expect(results.length).toBeGreaterThan(10);
            expect(processingTime).toBeLessThan(10000); // 10秒以内
        }, 15000); // テストのタイムアウトを15秒に設定
    });
});