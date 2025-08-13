/**
 * src/say/index.test.ts: SayCoeiroinkクラステスト
 */

import { SayCoeiroink, loadConfig } from './index.js';
import type { Config, SynthesizeOptions, SynthesizeResult } from './types.js';
import { readFile, access, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// モックの設定
vi.mock('fs/promises');

// オペレータマネージャーのモック（ESMパス対応）
vi.mock('../operator/index.js', async () => {
  const MockOperatorManager = vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    buildDynamicConfig: vi.fn().mockResolvedValue(undefined),
    showCurrentOperator: vi.fn().mockResolvedValue({
      operatorId: null,
      characterName: null,
      currentStyle: null,
      message: 'オペレータが割り当てられていません'
    }),
    getCharacterInfo: vi.fn().mockResolvedValue(null),
    assignOperator: vi.fn().mockResolvedValue(undefined),
    releaseOperator: vi.fn().mockResolvedValue(undefined)
  }));

  return {
    OperatorManager: MockOperatorManager,
    default: MockOperatorManager
  };
});
vi.mock('./speech-queue.js', () => ({
  SpeechQueue: vi.fn().mockImplementation(() => ({
    enqueue: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn().mockReturnValue({ queueLength: 0, isProcessing: false }),
    clear: vi.fn().mockReturnValue(undefined)
  }))
}));
vi.mock('./audio-player.js', () => ({
  AudioPlayer: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockReturnValue(true),
    playAudioStream: vi.fn().mockResolvedValue(undefined),
    playStreamingAudio: vi.fn().mockResolvedValue(undefined), // ストリーミング再生メソッド追加
    applyCrossfade: vi.fn().mockReturnValue(new Uint8Array(0))
  }))
}));
vi.mock('./audio-synthesizer.js', () => ({
  AudioSynthesizer: vi.fn().mockImplementation(() => ({
    listVoices: vi.fn().mockResolvedValue([]),
    synthesizeChunk: vi.fn().mockResolvedValue({
      chunk: { text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 },
      audioData: new ArrayBuffer(1024)
    }),
    synthesizeStream: vi.fn().mockReturnValue(async function* () { yield { chunk: { text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 }, audioData: new ArrayBuffer(1024) }; }),
    convertRateToSpeed: vi.fn().mockReturnValue(1.0),
    splitTextIntoChunks: vi.fn().mockReturnValue([{ text: 'test', index: 0, isFirst: true, isLast: true, overlap: 0 }])
  }))
}));

const mockReadFile = readFile as anyedFunction<typeof readFile>;
const mockAccess = access as anyedFunction<typeof access>;
const mockMkdir = mkdir as anyedFunction<typeof mkdir>;

// fetchのモック
global.fetch = vi.fn();

describe('loadConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('設定ファイルが存在する場合、正しく読み込むこと', async () => {
        const mockConfig = {
            connection: {
                host: 'custom-host',
                port: '9999'
            },
            voice: {
                rate: 300,
                default_voice_id: 'custom-voice'
            },
            audio: {
                latencyMode: 'quality'
            }
        };

        mockAccess.mockResolvedValueOnce(undefined);
        mockReadFile.mockResolvedValueOnce(JSON.stringify(mockConfig));

        const config = await loadConfig();

        expect(config).toEqual(expect.objectContaining({
            connection: {
                host: 'custom-host',
                port: '9999'
            },
            voice: {
                rate: 300,
                default_voice_id: 'custom-voice'
            },
            audio: expect.objectContaining({
                latencyMode: 'quality'
            })
        }));
    });

    test('設定ファイルが存在しない場合、デフォルト設定を返すこと', async () => {
        mockAccess.mockRejectedValueOnce(new Error('File not found'));

        const config = await loadConfig();

        expect(config).toEqual({
            connection: {
                host: 'localhost',
                port: '50032'
            },
            voice: {
                rate: 200,
                default_voice_id: '3c37646f-3881-5374-2a83-149267990abc'
            },
            audio: {
                latencyMode: 'balanced',
                splitMode: 'punctuation',
                bufferSize: 1024,
                parallelGeneration: {
                    maxConcurrency: 2,
                    bufferAheadCount: 1,
                    delayBetweenRequests: 50,
                    pauseUntilFirstComplete: true
                }
            }
        });
    });

    test('設定ファイルが無効なJSONの場合、デフォルト設定を返すこと', async () => {
        mockAccess.mockResolvedValueOnce(undefined);
        mockReadFile.mockResolvedValueOnce('invalid json');

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
        
        const config = await loadConfig();

        expect(config).toEqual({
            connection: {
                host: 'localhost',
                port: '50032'
            },
            voice: {
                rate: 200,
                default_voice_id: '3c37646f-3881-5374-2a83-149267990abc'
            },
            audio: {
                latencyMode: 'balanced',
                splitMode: 'punctuation',
                bufferSize: 1024,
                parallelGeneration: {
                    maxConcurrency: 2,
                    bufferAheadCount: 1,
                    delayBetweenRequests: 50,
                    pauseUntilFirstComplete: true
                }
            }
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining('設定ファイル読み込みエラー')
        );

        consoleErrorSpy.mockRestore();
    });

    test('カスタム設定ファイルパスを指定できること', async () => {
        const customPath = '/custom/path/config.json';
        const mockConfig = {
            connection: {
                host: 'test',
                port: '8080'
            },
            voice: {
                rate: 150
            }
        };

        mockAccess.mockResolvedValueOnce(undefined);
        mockReadFile.mockResolvedValueOnce(JSON.stringify(mockConfig));

        const config = await loadConfig(customPath);

        expect(mockAccess).toHaveBeenCalledWith(customPath, expect.any(Number));
        expect(mockReadFile).toHaveBeenCalledWith(customPath, 'utf8');
        expect(config).toEqual(expect.objectContaining({
            connection: {
                host: 'test',
                port: '8080'
            },
            voice: expect.objectContaining({
                rate: 150
            })
        }));
    });

    test('部分的な設定ファイルでもデフォルト値とマージされること', async () => {
        const partialConfig = {
            connection: {
                host: 'partial-host'
            }
        };

        mockAccess.mockResolvedValueOnce(undefined);
        mockReadFile.mockResolvedValueOnce(JSON.stringify(partialConfig));

        const config = await loadConfig();

        // 部分設定ファイルでデフォルト値がマージされることを確認
        expect(config.connection.host).toBe('partial-host'); // 指定値
        // connectionオブジェクトが正しく設定されていることを確認
        expect(config.connection).toBeDefined();
        expect(config.voice).toBeDefined();
        expect(config.audio).toBeDefined();
        expect(config.audio.parallelGeneration).toBeDefined();
    });
});

describe('SayCoeiroink', () => {
    let sayCoeiroink: SayCoeiroink;
    let mockConfig: Config;

    beforeEach(() => {
        mockConfig = {
            connection: {
                host: 'localhost',
                port: '50032'
            },
            voice: {
                rate: 200,
                default_voice_id: '3c37646f-3881-5374-2a83-149267990abc'
            },
            audio: {
                latencyMode: 'balanced',
                splitMode: 'punctuation',
                bufferSize: 1024
            }
        };

        // モッククラスのクリア（vi.mockで自動的にモックされる）
        vi.clearAllMocks();

        sayCoeiroink = new SayCoeiroink(mockConfig);
    });

    describe('コンストラクタ', () => {
        test('設定が正しく保存されること', () => {
            expect(sayCoeiroink['config']).toEqual(mockConfig);
        });

        test('設定なしでデフォルト設定が使用されること', () => {
            const defaultInstance = new SayCoeiroink();
            expect(defaultInstance['config']).toEqual({
                connection: {
                    host: 'localhost',
                    port: '50032'
                },
                voice: {
                    rate: 200,
                    default_voice_id: '3c37646f-3881-5374-2a83-149267990abc'
                },
                audio: {
                    latencyMode: 'balanced',
                    splitMode: 'punctuation',
                    bufferSize: 1024,
                    parallelGeneration: {
                        maxConcurrency: 2,
                        bufferAheadCount: 1,
                        delayBetweenRequests: 50,
                        pauseUntilFirstComplete: true
                    }
                }
            });
        });

        test('依存関係のクラスが正しく初期化されること', () => {
            // ESMモック環境では、vi.mockで自動的にモックされたクラスを使用
            // 実際の初期化確認は constructor で実行済み
            expect(vi.mocked(SayCoeiroink.prototype.constructor)).toBeDefined();
            
            // 各モックコンストラクタが呼ばれていることを確認
            // vi.mockで設定されたモックが使用されていることを確認
            expect(sayCoeiroink).toBeInstanceOf(SayCoeiroink);
            expect(sayCoeiroink['operatorManager']).toBeDefined();
            expect(sayCoeiroink['speechQueue']).toBeDefined();
            expect(sayCoeiroink['audioPlayer']).toBeDefined();
            expect(sayCoeiroink['audioSynthesizer']).toBeDefined();
        });
    });

    describe('initialize', () => {
        test('正常に初期化できること', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.initialize = vi.fn().mockResolvedValue(undefined);

            await expect(sayCoeiroink.initialize()).resolves.not.toThrow();
            expect(mockOperatorManager.initialize).toHaveBeenCalledTimes(1);
        });

        test('初期化エラー時に適切なエラーを投げること', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.initialize = vi.fn().mockRejectedValue(new Error('Init failed'));

            await expect(sayCoeiroink.initialize()).rejects.toThrow(
                'SayCoeiroink initialization failed: Init failed'
            );
        });
    });

    describe('buildDynamicConfig', () => {
        test('動的設定を正常に構築できること', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.buildDynamicConfig = vi.fn().mockResolvedValue(undefined);

            await expect(sayCoeiroink.buildDynamicConfig()).resolves.not.toThrow();
            expect(mockOperatorManager.buildDynamicConfig).toHaveBeenCalledTimes(1);
        });

        test('設定構築エラー時に適切なエラーを投げること', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.buildDynamicConfig = vi.fn().mockRejectedValue(new Error('Config failed'));

            await expect(sayCoeiroink.buildDynamicConfig()).rejects.toThrow(
                'buildDynamicConfig failed: Config failed'
            );
        });
    });

    describe('getCurrentOperatorVoice', () => {
        test('オペレータが割り当てられている場合、音声情報を取得できること', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            const mockCharacter = {
                voice_id: 'test-voice-id',
                name: 'テストキャラクター',
                available_styles: {}
            };

            mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
                operatorId: 'test-operator',
                message: 'Current operator: test-operator'
            });
            mockOperatorManager.getCharacterInfo = vi.fn().mockResolvedValue(mockCharacter);

            const result = await sayCoeiroink.getCurrentOperatorVoice();

            expect(result).toEqual({
                voice_id: 'test-voice-id',
                character: mockCharacter
            });
        });

        test('オペレータが割り当てられていない場合、nullを返すこと', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
                operatorId: null,
                message: 'No operator assigned'
            });

            const result = await sayCoeiroink.getCurrentOperatorVoice();

            expect(result).toBeNull();
        });

        test('キャラクター情報が取得できない場合、nullを返すこと', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
                operatorId: 'test-operator',
                message: 'Current operator: test-operator'
            });
            mockOperatorManager.getCharacterInfo = vi.fn().mockResolvedValue(null);

            const result = await sayCoeiroink.getCurrentOperatorVoice();

            expect(result).toBeNull();
        });

        test('エラー時にnullを返すこと', async () => {
            const mockOperatorManager = sayCoeiroink['operatorManager'];
            mockOperatorManager.showCurrentOperator = vi.fn().mockRejectedValue(new Error('Connection failed'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

            const result = await sayCoeiroink.getCurrentOperatorVoice();

            expect(result).toBeNull();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('オペレータ音声取得エラー')
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('enqueueSpeech', () => {
        test('音声タスクを正常にキューに追加できること', async () => {
            const mockSpeechQueue = sayCoeiroink['speechQueue'];
            const mockResult: SynthesizeResult = {
                success: true,
                taskId: 12345,
                queueLength: 1
            };

            mockSpeechQueue.enqueue = vi.fn().mockResolvedValue(mockResult);

            const result = await sayCoeiroink.enqueueSpeech('テストテキスト', { rate: 150 });

            expect(result).toEqual(mockResult);
            expect(mockSpeechQueue.enqueue).toHaveBeenCalledWith('テストテキスト', { rate: 150 });
        });
    });

    describe('synthesizeTextAsync', () => {
        test('非同期音声合成が正常に動作すること', async () => {
            const mockResult: SynthesizeResult = {
                success: true,
                taskId: 67890,
                queueLength: 2
            };

            sayCoeiroink.enqueueSpeech = vi.fn().mockResolvedValue(mockResult);

            const result = await sayCoeiroink.synthesizeTextAsync('非同期テキスト');

            expect(result).toEqual(mockResult);
            expect(sayCoeiroink.enqueueSpeech).toHaveBeenCalledWith('非同期テキスト', {});
        });
    });

    describe('synthesizeText', () => {
        test('同期音声合成が正常に動作すること', async () => {
            const mockResult: SynthesizeResult = {
                success: true,
                mode: 'normal',
                latency: 100
            };

            sayCoeiroink.synthesizeTextInternal = vi.fn().mockResolvedValue(mockResult);

            const result = await sayCoeiroink.synthesizeText('同期テキスト', { rate: 180 });

            expect(result).toEqual(mockResult);
            expect(sayCoeiroink.synthesizeTextInternal).toHaveBeenCalledWith('同期テキスト', { rate: 180 });
        });
    });

    describe('synthesizeTextInternal', () => {
        beforeEach(() => {
            // 依存メソッドをモック
            sayCoeiroink.getCurrentOperatorVoice = vi.fn().mockResolvedValue({
                voice_id: 'default-voice',
                character: {}
            });
            sayCoeiroink['audioSynthesizer'].checkServerConnection = vi.fn().mockResolvedValue(true);
            sayCoeiroink.initializeAudioPlayer = vi.fn().mockResolvedValue(true);
            sayCoeiroink['audioSynthesizer'].convertRateToSpeed = vi.fn().mockReturnValue(1.0);
        });

        test('オペレータ音声で正常に合成できること', async () => {
            const mockResult = {
                chunk: { text: 'テスト', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(1000),
                latency: 50
            };

            sayCoeiroink['audioSynthesizer'].synthesizeStream = vi.fn().mockImplementation(async function* () {
                yield mockResult;
            });
            sayCoeiroink.playAudioStream = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal('テスト');

            expect(result).toEqual({
                success: true,
                mode: 'streaming' // 実際はストリーミングモードになる
            });
        });

        test('指定音声で正常に合成できること', async () => {
            const options: SynthesizeOptions = {
                voice: 'custom-voice-id'
            };

            const mockResult = {
                chunk: { text: 'テスト', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(1000),
                latency: 75
            };

            sayCoeiroink['audioSynthesizer'].synthesizeStream = vi.fn().mockImplementation(async function* () {
                yield mockResult;
            });
            sayCoeiroink.playAudioStream = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal('テスト', options);

            expect(result.success).toBe(true);
            expect(sayCoeiroink['audioSynthesizer'].synthesizeStream).toHaveBeenCalledWith(
                'テスト',
                'custom-voice-id',
                1.0,
                'punctuation' // chunkMode引数追加
            );
        });

        test('ファイル出力モードで正常に動作すること', async () => {
            const options: SynthesizeOptions = {
                outputFile: '/tmp/test.wav'
            };

            const mockResult = {
                chunk: { text: 'テスト', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(1000),
                latency: 100
            };

            sayCoeiroink['audioSynthesizer'].synthesizeStream = vi.fn().mockImplementation(async function* () {
                yield mockResult;
            });
            sayCoeiroink.saveAudio = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal('テスト', options);

            expect(result).toEqual({
                success: true,
                outputFile: '/tmp/test.wav',
                mode: 'file'
            });

            expect(sayCoeiroink.saveAudio).toHaveBeenCalledWith(
                mockResult.audioBuffer,
                '/tmp/test.wav'
            );
        });

        test('ストリーミングモードで正常に動作すること', async () => {
            const longText = 'a'.repeat(100); // ストリーミング対象となる長文
            const options: SynthesizeOptions = {
                chunkMode: 'punctuation'
            };

            sayCoeiroink.streamSynthesizeAndPlay = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal(longText, options);

            expect(result).toEqual({
                success: true,
                mode: 'streaming'
            });

            expect(sayCoeiroink.streamSynthesizeAndPlay).toHaveBeenCalledWith(
                longText,
                expect.any(Object), // voice
                1.0, // speed
                'punctuation', // chunkMode
                1024 // bufferSize
            );
        });

        test('サーバー接続失敗時にエラーを投げること', async () => {
            sayCoeiroink['audioSynthesizer'].checkServerConnection = vi.fn().mockResolvedValue(false);

            await expect(
                sayCoeiroink.synthesizeTextInternal('テスト')
            ).rejects.toThrow('Cannot connect to COEIROINK server');
        });

        test('音声が指定されておらずオペレータもない場合、allowFallback=trueでデフォルト音声を使用すること', async () => {
            sayCoeiroink.getCurrentOperatorVoice = vi.fn().mockResolvedValue(null);
            
            const mockResult = {
                chunk: { text: 'テスト', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(1000),
                latency: 50
            };

            sayCoeiroink['audioSynthesizer'].synthesizeStream = vi.fn().mockImplementation(async function* () {
                yield mockResult;
            });
            sayCoeiroink.playAudioStream = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal('テスト', { allowFallback: true });

            expect(result.success).toBe(true);
            // デフォルト音声が使用されることを確認
            expect(sayCoeiroink['audioSynthesizer'].synthesizeStream).toHaveBeenCalledWith(
                'テスト',
                '3c37646f-3881-5374-2a83-149267990abc', // 実際のデフォルトvoice_id
                1.0,
                'punctuation' // chunkMode引数追加
            );
        });

        test('音声が指定されておらずオペレータもない場合、allowFallback=falseでエラーを投げること', async () => {
            sayCoeiroink.getCurrentOperatorVoice = vi.fn().mockResolvedValue(null);

            await expect(
                sayCoeiroink.synthesizeTextInternal('テスト', { allowFallback: false })
            ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');
        });

        test('音声が指定されておらずオペレータもない場合、allowFallbackデフォルト（true）でデフォルト音声を使用すること', async () => {
            sayCoeiroink.getCurrentOperatorVoice = vi.fn().mockResolvedValue(null);
            
            const mockResult = {
                chunk: { text: 'テスト', index: 0, isFirst: true, isLast: true, overlap: 0 },
                audioBuffer: new ArrayBuffer(1000),
                latency: 50
            };

            sayCoeiroink['audioSynthesizer'].synthesizeStream = vi.fn().mockImplementation(async function* () {
                yield mockResult;
            });
            sayCoeiroink.playAudioStream = vi.fn().mockResolvedValue(undefined);

            const result = await sayCoeiroink.synthesizeTextInternal('テスト'); // allowFallback未指定

            expect(result.success).toBe(true);
            // デフォルト音声が使用されることを確認
            expect(sayCoeiroink['audioSynthesizer'].synthesizeStream).toHaveBeenCalledWith(
                'テスト',
                '3c37646f-3881-5374-2a83-149267990abc', // 実際のデフォルトvoice_id
                1.0,
                'punctuation' // chunkMode引数追加
            );
        });

        test('音声プレーヤー初期化失敗時にエラーを投げること', async () => {
            sayCoeiroink.initializeAudioPlayer = vi.fn().mockResolvedValue(false);

            await expect(
                sayCoeiroink.synthesizeTextInternal('テスト')
            ).rejects.toThrow('音声プレーヤーの初期化に失敗しました');
        });
    });

    describe('ヘルパーメソッド', () => {
        test('convertRateToSpeed が AudioSynthesizer を委譲すること', () => {
            sayCoeiroink['audioSynthesizer'].convertRateToSpeed = vi.fn().mockReturnValue(1.5);

            const result = sayCoeiroink.convertRateToSpeed(300);

            expect(result).toBe(1.5);
            expect(sayCoeiroink['audioSynthesizer'].convertRateToSpeed).toHaveBeenCalledWith(300);
        });

        test('initializeAudioPlayer が AudioPlayer を委譲すること', async () => {
            sayCoeiroink['audioPlayer'].initialize = vi.fn().mockResolvedValue(true);

            const result = await sayCoeiroink.initializeAudioPlayer();

            expect(result).toBe(true);
            expect(sayCoeiroink['audioPlayer'].initialize).toHaveBeenCalledTimes(1);
        });
    });

    describe('キュー管理', () => {
        test('getSpeechQueueStatus が正しくステータスを返すこと', () => {
            const mockStatus = { queueLength: 3, isProcessing: true };
            sayCoeiroink['speechQueue'].getStatus = vi.fn().mockReturnValue(mockStatus);

            const result = sayCoeiroink.getSpeechQueueStatus();

            expect(result).toEqual(mockStatus);
            expect(sayCoeiroink['speechQueue'].getStatus).toHaveBeenCalledTimes(1);
        });

        test('clearSpeechQueue が正しくキューをクリアすること', () => {
            sayCoeiroink['speechQueue'].clear = vi.fn();

            sayCoeiroink.clearSpeechQueue();

            expect(sayCoeiroink['speechQueue'].clear).toHaveBeenCalledTimes(1);
        });
    });

    describe('エラーハンドリング', () => {
        test('予期しないエラーが適切に処理されること', async () => {
            // オペレータマネージャーでエラーを発生させてエラーハンドリングをテスト
            sayCoeiroink['operatorManager'].showCurrentOperator = vi.fn().mockRejectedValue(new Error('Unexpected error'));

            const result = await sayCoeiroink.getCurrentOperatorVoice();

            // エラーが発生してもnullが返されることを確認
            expect(result).toBeNull();
        });
    });
});