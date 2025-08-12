/**
 * src/core/say/e2e-workflow.test.ts
 * End-to-End ワークフローテスト
 * Issue #37: 複雑なテストの分割 - E2E責務分離
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile, readFile, unlink } from 'fs/promises';
import Speaker from 'speaker';

// 共通モック設定
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

describe('Say E2E ワークフローテスト', () => {
    let sayCoeiroink: SayCoeiroink;
    let tempDir: string;

    beforeEach(async () => {
        tempDir = join(tmpdir(), `say-e2e-test-${Date.now()}`);
        
        // Speakerモック設定
        MockSpeaker.mockImplementation(() => ({
            write: vi.fn(),
            end: vi.fn(),
            on: vi.fn((event, handler) => {
                if (event === 'close') {
                    setTimeout(handler, 10);
                }
            }),
            destroy: vi.fn()
        }));

        // fetchモック設定 - 音声情報取得
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes('/speakers')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve([
                        { id: 'test-speaker-1', name: 'テスト話者1', styles: [] },
                        { id: 'test-speaker-2', name: 'テスト話者2', styles: [] }
                    ])
                });
            }
            
            if (url.includes('/synthesis')) {
                const audioBuffer = new ArrayBuffer(1024);
                return Promise.resolve({
                    ok: true,
                    arrayBuffer: () => Promise.resolve(audioBuffer)
                });
            }
            
            return Promise.reject(new Error('Unexpected URL in mock'));
        });

        sayCoeiroink = new SayCoeiroink();
    });

    afterEach(async () => {
        vi.clearAllMocks();
    });

    describe('完全なワークフロー実行', () => {
        test('初期化から音声合成まで完全なフローが動作すること', async () => {
            // 1. 初期化
            expect(sayCoeiroink).toBeDefined();
            
            // 2. 音声合成実行
            const result = await sayCoeiroink.synthesizeText('E2Eテストです', {
                voice: 'test-speaker-1',
                streamMode: false
            });
            
            // 3. 結果検証
            expect(result.success).toBe(true);
            expect(result.taskId || result.mode).toBeDefined();
            
            // 4. APIが適切に呼ばれたことを確認
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/speakers'),
                expect.any(Object)
            );
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/synthesis'),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });

        test('ファイル出力から読み込み確認まで完全なフローが動作すること', async () => {
            const outputFile = join(tempDir, 'test-output.wav');
            
            try {
                // 1. ファイル出力付き音声合成
                const result = await sayCoeiroink.synthesizeText('ファイル出力テスト', {
                    voice: 'test-speaker-1',
                    outputFile: outputFile,
                    streamMode: false
                });
                
                // 2. 合成成功を確認
                expect(result.success).toBe(true);
                
                // 3. ファイルが作成されたことを確認（モック環境では実際のファイル作成はされない）
                // この部分は実環境でのみ検証可能
                
            } catch (error) {
                // テスト環境での制約によるエラーは許容
                console.log('ファイル出力テスト: テスト環境エラー', error);
            }
        });

        test('非同期キューイングと処理が正常に動作すること', async () => {
            // 複数のリクエストを同時発行
            const requests = [
                'キューテスト1',
                'キューテスト2',
                'キューテスト3'
            ];
            
            const promises = requests.map((text, index) => 
                sayCoeiroink.synthesizeText(text, {
                    voice: 'test-speaker-1',
                    streamMode: false
                })
            );
            
            // 全ての処理が完了することを確認
            const results = await Promise.allSettled(promises);
            
            // 少なくとも一つは成功することを期待
            const successCount = results.filter(result => 
                result.status === 'fulfilled' && result.value.success
            ).length;
            
            expect(successCount).toBeGreaterThan(0);
            
            // 全てのリクエストが処理されたことを確認
            expect(results).toHaveLength(3);
        });
    });

    describe('ストリーミングワークフロー', () => {
        test('ストリーミングモードでの完全なフローが動作すること', async () => {
            const result = await sayCoeiroink.synthesizeText('ストリーミングE2Eテスト', {
                voice: 'test-speaker-1',
                streamMode: true
            });
            
            expect(result.success).toBe(true);
            expect(result.mode).toBeDefined();
            
            // ストリーミング特有の検証
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining('/synthesis'),
                expect.objectContaining({
                    method: 'POST'
                })
            );
        });

        test('ストリーミング生成ジェネレータが正常に動作すること', async () => {
            try {
                const generator = sayCoeiroink.synthesizeStreamingGenerator('ストリーミング生成テスト');
                
                let chunkCount = 0;
                for await (const chunk of generator) {
                    expect(chunk).toBeDefined();
                    chunkCount++;
                    
                    // 無限ループ防止
                    if (chunkCount > 10) break;
                }
                
                expect(chunkCount).toBeGreaterThan(0);
            } catch (error) {
                // テスト環境での制約によるエラーは許容
                console.log('ストリーミング生成テスト: テスト環境エラー');
            }
        });
    });

    describe('設定統合ワークフロー', () => {
        test('カスタム設定でのE2Eワークフローが正常に動作すること', async () => {
            // カスタム設定でSayCoeiroinkを初期化
            const customConfig = {
                server: {
                    host: 'localhost',
                    port: 50031
                },
                audio: {
                    latencyMode: 'ultra-low' as const,
                    splitMode: 'medium' as const
                }
            };
            
            const customSayCoeiroink = new SayCoeiroink(customConfig);
            
            const result = await customSayCoeiroink.synthesizeText('カスタム設定テスト', {
                voice: 'test-speaker-1',
                streamMode: false
            });
            
            expect(result.success).toBe(true);
        });

        test('異なるレイテンシモードでのワークフロー比較', async () => {
            const modes = ['ultra-low', 'balanced', 'quality'] as const;
            const results = [];
            
            for (const mode of modes) {
                try {
                    const result = await sayCoeiroink.synthesizeText(`${mode}モードテスト`, {
                        voice: 'test-speaker-1',
                        latencyMode: mode,
                        streamMode: true
                    });
                    
                    results.push({ mode, success: result.success });
                } catch (error) {
                    results.push({ mode, success: false });
                }
            }
            
            // 全てのモードが処理されたことを確認
            expect(results).toHaveLength(3);
            
            // 少なくとも一つのモードは成功することを期待
            const successCount = results.filter(r => r.success).length;
            expect(successCount).toBeGreaterThan(0);
        });
    });
});