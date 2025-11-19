/**
 * src/cli/say-coeiroink.test.ts: CLIクラステスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import SayCoeiroinkCLI from './say-coeiroink.js';
import { readFile } from 'fs/promises';

// モックの設定
vi.mock('fs/promises');
vi.mock('@coeiro-operator/audio');
vi.mock('@coeiro-operator/core');

const mockReadFile = vi.mocked(readFile);

describe('SayCoeiroinkCLI', () => {
    let cli: SayCoeiroinkCLI;
    let mockSayCoeiroink: any;
    let mockConfig: any;
    let consoleSpy: any;

    beforeEach(() => {
        // SayCoeiroinkのモックインスタンス
        mockSayCoeiroink = {
            initialize: vi.fn().mockResolvedValue(undefined),
            warmup: vi.fn().mockResolvedValue(undefined),
            synthesize: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1 }),
            waitCompletion: vi.fn().mockResolvedValue(undefined),
            listVoices: vi.fn().mockResolvedValue(undefined),
            buildDynamicConfig: vi.fn().mockResolvedValue(undefined),
        };

        // Configのモック
        mockConfig = {
            connection: { host: 'localhost', port: '50032' },
            operator: { timeout: 14400000, assignmentStrategy: 'random' },
            audio: {
                defaultRate: 200,
                latencyMode: 'balanced',
                splitMode: 'punctuation',
                bufferSize: 2048
            }
        };

        // CLIインスタンスを作成
        cli = new SayCoeiroinkCLI(mockSayCoeiroink, mockConfig);

        // コンソールのスパイ
        consoleSpy = {
            log: vi.spyOn(console, 'log').mockImplementation(() => {}),
            error: vi.spyOn(console, 'error').mockImplementation(() => {}),
        };

        // readFileのモック設定
        mockReadFile.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('run (統合テスト)', () => {
        test('基本的なテキスト音声合成が実行されること', async () => {
            const args = ['node', 'say-coeiroink', 'Hello, World!'];
            await cli.run(args);

            expect(mockSayCoeiroink.warmup).toHaveBeenCalled();
            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'Hello, World!',
                expect.objectContaining({
                    voice: null,
                    outputFile: null,
                    style: undefined,
                    chunkMode: 'punctuation',
                    bufferSize: 2048
                })
            );
            expect(mockSayCoeiroink.waitCompletion).toHaveBeenCalled();
        });

        test('レート指定オプションが正しく処理されること (数値)', async () => {
            const args = ['node', 'say-coeiroink', '-r', '150', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    rate: 150
                })
            );
        });

        test('レート指定オプションが正しく処理されること (パーセント)', async () => {
            const args = ['node', 'say-coeiroink', '-r', '150%', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    factor: 1.5
                })
            );
        });

        test('音声指定オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '-v', 'voice-id', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    voice: 'voice-id'
                })
            );
        });

        test('音声リスト表示オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '-v', '?'];
            await cli.run(args);

            expect(mockSayCoeiroink.listVoices).toHaveBeenCalled();
            expect(mockSayCoeiroink.synthesize).not.toHaveBeenCalled();
        });

        test('出力ファイル指定オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '-o', 'output.wav', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.warmup).not.toHaveBeenCalled(); // ファイル出力時はウォームアップ不要
            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    outputFile: 'output.wav'
                })
            );
            expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('Audio saved to: output.wav'));
        });

        test('入力ファイル指定オプションが正しく処理されること', async () => {
            mockReadFile.mockResolvedValue('ファイルからのテキスト');
            const args = ['node', 'say-coeiroink', '-f', 'input.txt'];
            await cli.run(args);

            expect(mockReadFile).toHaveBeenCalledWith('input.txt', 'utf8');
            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'ファイルからのテキスト',
                expect.anything()
            );
        });

        test('スタイル指定オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '--style', 'のーまる', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    style: 'のーまる'
                })
            );
        });

        test('チャンクモード指定オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '--chunk-mode', 'none', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    chunkMode: 'none'
                })
            );
        });

        test('バッファサイズ指定オプションが正しく処理されること', async () => {
            const args = ['node', 'say-coeiroink', '--buffer-size', '512', 'テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'テストメッセージ',
                expect.objectContaining({
                    bufferSize: 512
                })
            );
        });

        test('複数のオプションを組み合わせて処理できること', async () => {
            const args = [
                'node', 'say-coeiroink',
                '-v', 'custom-voice',
                '-r', '150',
                '--style', 'ひそひそ',
                '--chunk-mode', 'small',
                '--buffer-size', '256',
                'メッセージ'
            ];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'メッセージ',
                expect.objectContaining({
                    voice: 'custom-voice',
                    rate: 150,
                    style: 'ひそひそ',
                    chunkMode: 'small',
                    bufferSize: 256
                })
            );
        });

        test('無効なチャンクモードでエラーになること', async () => {
            const args = ['node', 'say-coeiroink', '--chunk-mode', 'invalid', 'テスト'];
            await expect(cli.run(args)).rejects.toThrow('Invalid chunk mode');
        });

        test('無効なバッファサイズでエラーになること', async () => {
            const args = ['node', 'say-coeiroink', '--buffer-size', '99999', 'テスト'];
            await expect(cli.run(args)).rejects.toThrow('Invalid buffer size');
        });

        test('存在しないファイルを指定するとエラーになること', async () => {
            mockReadFile.mockRejectedValue(new Error('File not found'));
            const args = ['node', 'say-coeiroink', '-f', 'nonexistent.txt'];
            await expect(cli.run(args)).rejects.toThrow("File 'nonexistent.txt' not found");
        });

        // Commander.jsのヘルプとバージョン表示は
        // process.stdout.writeを使うため、別途統合テストで確認
    });

    describe('エッジケース', () => {
        test('引数なしでstdinから読み込まれること', async () => {
            // stdinのモック
            const originalStdin = process.stdin;
            const mockStdin = {
                [Symbol.asyncIterator]: vi.fn().mockReturnValue({
                    next: vi.fn()
                        .mockResolvedValueOnce({ value: Buffer.from('stdin text'), done: false })
                        .mockResolvedValueOnce({ done: true })
                })
            };
            Object.defineProperty(process, 'stdin', {
                value: mockStdin,
                writable: true,
                configurable: true
            });

            const args = ['node', 'say-coeiroink'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'stdin text',
                expect.anything()
            );

            // stdinを元に戻す
            Object.defineProperty(process, 'stdin', {
                value: originalStdin,
                writable: true,
                configurable: true
            });
        });

        test('複数の引数テキストが結合されること', async () => {
            const args = ['node', 'say-coeiroink', 'Hello', 'World', 'Test'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                'Hello World Test',
                expect.anything()
            );
        });

        test('特殊文字を含むテキストでも正常に処理されること', async () => {
            const args = ['node', 'say-coeiroink', '特殊文字!@#$%^&*()'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(
                '特殊文字!@#$%^&*()',
                expect.anything()
            );
        });
    });
});