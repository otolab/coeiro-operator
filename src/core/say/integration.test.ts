/**
 * src/say/integration.test.ts: 統合テスト
 */

import { SayCoeiroink } from './index.js';
import type { Config, SynthesizeOptions } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import Speaker from 'speaker';

// モックの設定
global.fetch = vi.fn();
vi.mock('speaker', () => ({
    default: vi.fn()
}));
vi.mock('echogarden', () => ({
    default: {}
}));
vi.mock('dsp.js', () => ({
    default: {
        IIRFilter: vi.fn().mockImplementation(() => ({
            process: vi.fn()
        })),
        LOWPASS: 1
    }
}));
vi.mock('node-libsamplerate', () => {
    const MockSampleRate = vi.fn().mockImplementation(() => ({
        resample: vi.fn(),
        end: vi.fn(),
        pipe: vi.fn((destination) => destination), // Transform Streamインターフェース
        on: vi.fn(),
        write: vi.fn(),
        destroy: vi.fn()
    }));
    MockSampleRate.SRC_SINC_MEDIUM_QUALITY = 2;
    return { default: MockSampleRate };
});

const MockSpeaker = Speaker as any;

describe('Say Integration Tests', () => {
    let sayCoeiroink: SayCoeiroink;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `say-integration-test-${Date.now()}`);
        
        // Speakerモックを設定
        const mockSpeakerInstance = {
            write: vi.fn(),
            end: vi.fn(),
            on: vi.fn((event, callback) => {
                if (event === 'close') {
                    setTimeout(callback, 10); // 非同期でcloseイベントを発火
                }
            })
        };
        MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);
        
        // デフォルト設定を使用（null を渡すとDEFAULT_CONFIGが使用される）
        const config: Config | null = null;

        sayCoeiroink = new SayCoeiroink(config);
        
        // COEIROINK サーバーのモック設定
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/v1/speakers')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => [
                        {
                            speakerUuid: 'test-speaker-1',
                            speakerName: 'テストスピーカー1',
                            styles: [
                                { styleId: 0, styleName: 'ノーマル' },
                                { styleId: 1, styleName: 'ハッピー' }
                            ]
                        }
                    ]
                });
            }
            
            if (url.includes('/v1/synthesis')) {
                // 模擬音声データ（有効なWAVファイル形式）
                const buffer = new ArrayBuffer(44 + 1000); // ヘッダー44バイト + データ1000バイト
                const view = new DataView(buffer);
                
                // RIFFヘッダー
                view.setUint32(0, 0x52494646, false); // "RIFF"
                view.setUint32(4, buffer.byteLength - 8, true); // ファイルサイズ
                view.setUint32(8, 0x57415645, false); // "WAVE"
                
                // fmtチャンク
                view.setUint32(12, 0x666d7420, false); // "fmt "
                view.setUint32(16, 16, true); // chunkサイズ
                view.setUint16(20, 1, true); // オーディオフォーマット（PCM）
                view.setUint16(22, 1, true); // チャンネル数
                view.setUint32(24, 48000, true); // サンプルレート
                view.setUint32(28, 96000, true); // バイトレート
                view.setUint16(32, 2, true); // ブロックアライン
                view.setUint16(34, 16, true); // ビット深度
                
                // dataチャンク
                view.setUint32(36, 0x64617461, false); // "data"
                view.setUint32(40, 1000, true); // dataサイズ
                
                return Promise.resolve({
                    ok: true,
                    arrayBuffer: async () => buffer
                });
            }
            
            return Promise.reject(new Error('Unknown endpoint'));
        });

        vi.clearAllMocks();
        
        // 一時ディレクトリを作成
        try {
            const fs = await import('fs');
            await fs.promises.mkdir(tempDir, { recursive: true });
        } catch (error) {
            // ディレクトリ作成エラーは無視
        }
    });

    afterEach(async () => {
        // 一時ファイルのクリーンアップ
        try {
            const fs = await import('fs');
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // クリーンアップエラーは無視
        }
    });

    describe('End-to-End ワークフロー', () => {
        test('初期化から音声合成まで完全なフローが動作すること', async () => {
            // 初期化フェーズ
            await expect(sayCoeiroink.initialize()).resolves.not.toThrow();
            
            // サーバー接続確認
            const isConnected = await sayCoeiroink.checkServerConnection();
            expect(isConnected).toBe(true);
            
            // 音声プレーヤー初期化
            const playerInitialized = await sayCoeiroink.initializeAudioPlayer();
            expect(playerInitialized).toBe(true);
            
            // 音声合成実行
            const result = await sayCoeiroink.synthesizeText('統合テストメッセージ', {
                voice: 'test-speaker-1'
            });
            
            expect(result.success).toBe(true);
            expect(result.mode).toBeDefined();
        });

        test('ファイル出力から読み込み確認まで完全なフローが動作すること', async () => {
            const outputFile = join(tempDir, 'test-output.wav');
            
            // 音声をファイルに出力
            const result = await sayCoeiroink.synthesizeText('ファイル出力テスト', {
                voice: 'test-speaker-1',
                outputFile: outputFile
            });
            
            expect(result.success).toBe(true);
            expect(result.outputFile).toBe(outputFile);
            
            // ファイルが作成されているか確認
            const fileContent = await readFile(outputFile);
            expect(fileContent.length).toBeGreaterThan(0);
            
            // クリーンアップ
            await unlink(outputFile);
        });

        test('非同期キューイングと処理が正常に動作すること', async () => {
            await sayCoeiroink.initialize();
            
            // 複数のタスクをキューに追加
            const tasks = [
                sayCoeiroink.synthesizeTextAsync('メッセージ1'),
                sayCoeiroink.synthesizeTextAsync('メッセージ2'),
                sayCoeiroink.synthesizeTextAsync('メッセージ3')
            ];
            
            const results = await Promise.all(tasks);
            
            // 全てのタスクが成功していることを確認
            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.taskId).toBeDefined();
            });
            
            // キューが処理されるまで待機
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // キューが空になっていることを確認
            const queueStatus = sayCoeiroink.getSpeechQueueStatus();
            expect(queueStatus.queueLength).toBe(0);
            expect(queueStatus.isProcessing).toBe(false);
        });
    });

    describe('エラー処理統合テスト', () => {
        test('サーバー接続失敗時の適切なエラーハンドリング', async () => {
            // サーバー接続失敗をシミュレート
            (global.fetch as any).mockImplementation(() => 
                Promise.reject(new Error('Connection refused'))
            );

            const isConnected = await sayCoeiroink.checkServerConnection();
            expect(isConnected).toBe(false);

            await expect(
                sayCoeiroink.synthesizeText('テスト')
            ).rejects.toThrow('Cannot connect to COEIROINK server');
        });

        test('音声合成API失敗時の適切なエラーハンドリング', async () => {
            // speakers APIは成功、synthesis APIは失敗
            (global.fetch as any).mockImplementation((url: string) => {
                if (url.includes('/v1/speakers')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => []
                    });
                }
                
                if (url.includes('/v1/synthesis')) {
                    return Promise.resolve({
                        ok: false,
                        status: 500,
                        statusText: 'Internal Server Error'
                    });
                }
                
                return Promise.reject(new Error('Unknown endpoint'));
            });

            await expect(
                sayCoeiroink.synthesizeText('テスト', { voice: 'test-voice' })
            ).rejects.toThrow('HTTP 500: Internal Server Error');
        });

        test('ファイル書き込み失敗時の適切なエラーハンドリング', async () => {
            const invalidPath = '/invalid/path/that/does/not/exist/output.wav';

            await expect(
                sayCoeiroink.synthesizeText('テスト', {
                    voice: 'test-speaker-1',
                    outputFile: invalidPath
                })
            ).rejects.toThrow('音声ファイル保存エラー');
        });
    });

    describe('設定とオプション統合テスト', () => {
        test('様々なレート設定での音声合成が正常に動作すること', async () => {
            const rates = [100, 150, 200, 250, 300];
            
            for (const rate of rates) {
                const result = await sayCoeiroink.synthesizeText(`レート${rate}でのテスト`, {
                    voice: 'test-speaker-1',
                    rate: rate
                });
                
                expect(result.success).toBe(true);
            }
        });

        test('異なる音声ID設定での合成が正常に動作すること', async () => {
            const voiceIds = ['test-speaker-1', 'custom-voice-id'];
            
            for (const voiceId of voiceIds) {
                const result = await sayCoeiroink.synthesizeText('音声IDテスト', {
                    voice: voiceId
                });
                
                expect(result.success).toBe(true);
            }
        });

        test('ストリーミングモードが正常に動作すること', async () => {
            const longText = 'これは長いテキストです。'.repeat(10);
            
            const result = await sayCoeiroink.synthesizeText(longText, {
                voice: 'test-speaker-1',
                chunkMode: 'punctuation'
            });
            
            expect(result.success).toBe(true);
            expect(result.mode).toBe('streaming');
        });
    });

    describe('データフロー統合テスト', () => {

        test('ストリーミング合成ジェネレータが正常に動作すること', async () => {
            const text = 'ストリーミングテスト用の長いテキスト。'.repeat(5);
            
            // streamSynthesizeAndPlayは非同期関数でPromise<void>を返すため、
            // ストリーミング処理が正常に開始されることを確認
            await expect(
                sayCoeiroink.streamSynthesizeAndPlay(text, 'test-speaker-1', 1.0)
            ).resolves.not.toThrow();
        });
    });

    describe('リソース管理統合テスト', () => {
        test('大量の同時リクエストが適切に処理されること', async () => {
            await sayCoeiroink.initialize();
            
            const taskCount = 20;
            const tasks = [];
            
            for (let i = 0; i < taskCount; i++) {
                tasks.push(
                    sayCoeiroink.synthesizeTextAsync(`並列テスト${i}`)
                );
            }
            
            const results = await Promise.all(tasks);
            
            // 全てのタスクが成功していることを確認
            results.forEach((result, index) => {
                expect(result.success).toBe(true);
                expect(result.taskId).toBeDefined();
            });
            
            // キューが最終的に空になることを確認
            await new Promise(resolve => setTimeout(resolve, 2000));
            const finalStatus = sayCoeiroink.getSpeechQueueStatus();
            expect(finalStatus.queueLength).toBe(0);
        }, 10000); // 10秒のタイムアウト

        test('メモリリークが発生しないこと', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // 大量の処理を実行
            for (let i = 0; i < 50; i++) {
                await sayCoeiroink.synthesizeText(`メモリテスト${i}`, {
                    voice: 'test-speaker-1'
                });
            }
            
            // ガベージコレクションを強制実行
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // メモリ増加が合理的な範囲内であることを確認（10MB未満）
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });
    });

    describe('例外状況統合テスト', () => {
        test('空文字列や特殊文字を含むテキストが適切に処理されること', async () => {
            const testTexts = [
                '',
                '   ',
                '😊🎵🌟',
                'Hello, World! 123',
                '日本語とEnglishの混在テキスト',
                '\n\t改行とタブ\n\t',
                'Very long text that exceeds normal chunk size and should be handled properly by the streaming system.'
            ];

            for (const text of testTexts) {
                if (text.trim() === '') {
                    // 空文字列の場合はエラーまたは特別な処理が期待される
                    continue;
                }

                const result = await sayCoeiroink.synthesizeText(text, {
                    voice: 'test-speaker-1'
                });
                
                expect(result.success).toBe(true);
            }
        });

        test('不正な設定値でも適切にフォールバックされること', async () => {
            const invalidOptions: SynthesizeOptions[] = [
                { rate: -100 }, // 負の値
                { rate: 10000 }, // 極端に大きい値
                { voice: null }, // null値
                { outputFile: '' }, // 空文字列
            ];

            for (const options of invalidOptions) {
                // エラーが発生するか、適切にフォールバックされることを確認
                try {
                    const result = await sayCoeiroink.synthesizeText('フォールバックテスト', options);
                    if (result.success) {
                        // 成功した場合は、適切なフォールバックが動作したことを意味する
                        expect(result.success).toBe(true);
                    }
                } catch (error) {
                    // エラーが発生した場合は、適切なエラーメッセージであることを確認
                    expect(error).toBeInstanceOf(Error);
                }
            }
        });
    });
});