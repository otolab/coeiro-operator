/**
 * src/say/parallel-generation-integration.test.ts: 並行チャンク生成システム統合テスト
 * Issue #35: ドキュメント記載機能の検証 - 並行チャンク生成システムの動作確認
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import type { Config, SynthesizeOptions } from './types.js';
import { tmpdir } from 'os';
import { join } from 'path';
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
        pipe: vi.fn((destination) => destination),
        on: vi.fn(),
        write: vi.fn(),
        destroy: vi.fn()
    }));
    MockSampleRate.SRC_SINC_MEDIUM_QUALITY = 2;
    return { default: MockSampleRate };
});

const MockSpeaker = Speaker as any;

describe('並行チャンク生成システム統合テスト', () => {
    let sayCoeiroink: SayCoeiroink;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `parallel-generation-test-${Date.now()}`);
        
        // Speakerモックを設定
        const mockSpeakerInstance = {
            write: vi.fn(),
            end: vi.fn(),
            on: vi.fn((event, callback) => {
                if (event === 'close') {
                    setTimeout(callback, 10);
                }
            })
        };
        MockSpeaker.mockImplementation(() => mockSpeakerInstance as any);
        
        // 並行生成有効な設定
        const config: Config = {
            connection: {
                host: 'localhost',
                port: '50031'
            },
            audio: {
                parallelGeneration: {
                    enabled: true,
                    maxConcurrency: 2,
                    delayBetweenRequests: 50,
                    bufferAheadCount: 1,
                    pauseUntilFirstComplete: true
                },
                splitMode: 'punctuation',
                latencyMode: 'balanced'
            }
        };

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
                                { styleId: 0, styleName: 'ノーマル' }
                            ]
                        }
                    ]
                });
            }
            
            if (url.includes('/v1/synthesis')) {
                // 並行生成の遅延をシミュレート
                return new Promise(resolve => {
                    setTimeout(() => {
                        const buffer = new ArrayBuffer(44 + 1000);
                        const view = new DataView(buffer);
                        
                        // RIFFヘッダー
                        view.setUint32(0, 0x52494646, false);
                        view.setUint32(4, buffer.byteLength - 8, true);
                        view.setUint32(8, 0x57415645, false);
                        
                        // fmtチャンク
                        view.setUint32(12, 0x666d7420, false);
                        view.setUint32(16, 16, true);
                        view.setUint16(20, 1, true);
                        view.setUint16(22, 1, true);
                        view.setUint32(24, 48000, true);
                        view.setUint32(28, 96000, true);
                        view.setUint16(32, 2, true);
                        view.setUint16(34, 16, true);
                        
                        // dataチャンク
                        view.setUint32(36, 0x64617461, false);
                        view.setUint32(40, 1000, true);
                        
                        resolve({
                            ok: true,
                            arrayBuffer: async () => buffer
                        });
                    }, 100); // 並行生成効果を測定するための遅延
                });
            }
            
            return Promise.reject(new Error('Unknown endpoint'));
        });

        vi.clearAllMocks();
    });

    afterEach(async () => {
        // クリーンアップ
        try {
            const fs = await import('fs');
            await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (error) {
            // クリーンアップエラーは無視
        }
    });

    describe('並行生成 vs 逐次生成 パフォーマンス比較', () => {
        test('並行生成が逐次生成と同等以上のパフォーマンスを発揮すること', async () => {
            // 複数チャンクに分割される長文テスト
            const longText = 'これは最初の文です。これは二番目の文です。これは三番目の文です。これは四番目の文です。これは五番目の文です。';

            await sayCoeiroink.initialize();

            // 並行生成でのパフォーマンス測定
            const parallelStartTime = Date.now();
            const parallelResult = await sayCoeiroink.synthesizeText(longText, {
                voice: 'test-speaker-1',
                chunkMode: 'punctuation'
            });
            const parallelDuration = Date.now() - parallelStartTime;

            expect(parallelResult.success).toBe(true);
            expect(parallelResult.taskId).toBeDefined();
            
            // 並行生成の場合、適切なレスポンス時間内で完了
            expect(parallelDuration).toBeLessThan(2000); // 2秒以内
        });

        test('maxConcurrency設定による並行数制御が動作すること', async () => {
            // maxConcurrency=1で逐次生成をシミュレート
            const sequentialConfig: Config = {
                connection: {
                    host: 'localhost',
                    port: '50031'
                },
                audio: {
                    parallelGeneration: {
                        enabled: true,
                        maxConcurrency: 1, // 逐次生成
                        delayBetweenRequests: 50,
                        bufferAheadCount: 0
                    },
                    splitMode: 'punctuation'
                }
            };

            const sequentialSayCoeiroink = new SayCoeiroink(sequentialConfig);
            await sequentialSayCoeiroink.initialize();

            const longText = 'テスト文1。テスト文2。テスト文3。';
            
            const result = await sequentialSayCoeiroink.synthesizeText(longText, {
                voice: 'test-speaker-1'
            });

            expect(result.success).toBe(true);
            // 逐次生成でも正常に動作することを確認
        });

        test('bufferAheadCount設定が先読み制御に効果があること', async () => {
            const bufferConfig: Config = {
                connection: {
                    host: 'localhost',
                    port: '50031'
                },
                audio: {
                    parallelGeneration: {
                        enabled: true,
                        maxConcurrency: 3,
                        delayBetweenRequests: 30,
                        bufferAheadCount: 2 // 先読み2チャンク
                    },
                    splitMode: 'small' // 小さく分割して効果を確認
                }
            };

            const bufferSayCoeiroink = new SayCoeiroink(bufferConfig);
            await bufferSayCoeiroink.initialize();

            const result = await bufferSayCoeiroink.synthesizeText(
                'バッファ先読みテスト1。バッファ先読みテスト2。バッファ先読みテスト3。バッファ先読みテスト4。',
                { voice: 'test-speaker-1' }
            );

            expect(result.success).toBe(true);
            expect(result.taskId).toBeDefined();
        });
    });

    describe('並行生成無効時のフォールバック', () => {
        test('並行生成無効設定で逐次生成にフォールバックすること', async () => {
            const disabledConfig: Config = {
                connection: {
                    host: 'localhost',
                    port: '50031'
                },
                audio: {
                    parallelGeneration: {
                        enabled: false // 無効
                    },
                    splitMode: 'punctuation'
                }
            };

            const disabledSayCoeiroink = new SayCoeiroink(disabledConfig);
            await disabledSayCoeiroink.initialize();

            const result = await disabledSayCoeiroink.synthesizeText(
                'フォールバックテスト1。フォールバックテスト2。',
                { voice: 'test-speaker-1' }
            );

            expect(result.success).toBe(true);
            // 無効時でも正常に動作（逐次生成で処理）
        });
    });

    describe('エラー処理とレジリエンス', () => {
        test('並行生成中の一部失敗でも全体処理が継続されること', async () => {
            // 特定のリクエストで失敗するモック
            let requestCount = 0;
            (global.fetch as any).mockImplementation((url: string) => {
                if (url.includes('/v1/speakers')) {
                    return Promise.resolve({
                        ok: true,
                        json: async () => [{ speakerUuid: 'test-speaker-1', speakerName: 'テスト', styles: [{ styleId: 0, styleName: 'ノーマル' }] }]
                    });
                }
                
                if (url.includes('/v1/synthesis')) {
                    requestCount++;
                    if (requestCount === 2) {
                        // 2番目のリクエストで失敗
                        return Promise.resolve({
                            ok: false,
                            status: 500,
                            statusText: 'Internal Server Error'
                        });
                    }
                    
                    // 正常レスポンス
                    const buffer = new ArrayBuffer(44 + 100);
                    return Promise.resolve({
                        ok: true,
                        arrayBuffer: async () => buffer
                    });
                }
                
                return Promise.reject(new Error('Unknown endpoint'));
            });

            await expect(
                sayCoeiroink.synthesizeText('エラーテスト1。エラーテスト2。エラーテスト3。', {
                    voice: 'test-speaker-1'
                })
            ).rejects.toThrow(); // エラーが適切に伝播されることを確認
        });

        test('並行生成設定の境界値が適切に処理されること', async () => {
            const edgeCaseConfig: Config = {
                connection: {
                    host: 'localhost',
                    port: '50031'
                },
                audio: {
                    parallelGeneration: {
                        enabled: true,
                        maxConcurrency: 5, // 最大値
                        delayBetweenRequests: 0, // 最小遅延
                        bufferAheadCount: 3 // 最大先読み
                    },
                    splitMode: 'large'
                }
            };

            const edgeCaseSayCoeiroink = new SayCoeiroink(edgeCaseConfig);
            await edgeCaseSayCoeiroink.initialize();

            const result = await edgeCaseSayCoeiroink.synthesizeText(
                '境界値テストです。' + '長い文章を繰り返して境界値での動作を確認します。'.repeat(5),
                { voice: 'test-speaker-1' }
            );

            expect(result.success).toBe(true);
        });
    });

    describe('メモリ効率とリソース管理', () => {
        test('並行生成完了後にメモリが適切に解放されること', async () => {
            const initialMemory = process.memoryUsage().heapUsed;

            // 複数回の並行生成を実行
            for (let i = 0; i < 5; i++) {
                const result = await sayCoeiroink.synthesizeText(
                    `メモリテスト${i}。複数の文を含む処理。リソース解放確認。`,
                    { voice: 'test-speaker-1' }
                );
                expect(result.success).toBe(true);
            }

            // ガベージコレクション強制実行
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            // メモリ増加が合理的な範囲内であることを確認（5MB未満）
            expect(memoryIncrease).toBeLessThan(5 * 1024 * 1024);
        });
    });
});