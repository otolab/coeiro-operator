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

    describe('parseArguments', () => {
        test('基本的な引数を正しく解析できること', async () => {
            const args = ['Hello, World!'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.text).toBe('Hello, World!');
            expect(result.rate).toBe(200);
            expect(result.voice).toBe('');
            expect(result.outputFile).toBe('');
            expect(result.inputFile).toBe('');
            expect(result.chunkMode).toBe('punctuation');
            expect(result.bufferSize).toBe(2048);
        });

        test('レート指定オプションを正しく解析できること', async () => {
            const args = ['-r', '150', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.rate).toBe(150);
            expect(result.text).toBe('テストメッセージ');
        });

        test('音声指定オプションを正しく解析できること', async () => {
            const args = ['-v', 'voice-id', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.voice).toBe('voice-id');
            expect(result.text).toBe('テストメッセージ');
        });

        test('出力ファイル指定オプションを正しく解析できること', async () => {
            const args = ['-o', 'output.wav', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.outputFile).toBe('output.wav');
            expect(result.text).toBe('テストメッセージ');
        });

        test('入力ファイル指定オプションを正しく解析できること', async () => {
            const args = ['-f', 'input.txt'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.inputFile).toBe('input.txt');
        });

        test('スタイル指定オプションを正しく解析できること', async () => {
            const args = ['--style', 'のーまる', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.style).toBe('のーまる');
            expect(result.text).toBe('テストメッセージ');
        });

        test('チャンクモード指定オプションを正しく解析できること', async () => {
            const args = ['--chunk-mode', 'none', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.chunkMode).toBe('none');
            expect(result.text).toBe('テストメッセージ');
        });

        test('バッファサイズ指定オプションを正しく解析できること', async () => {
            const args = ['--buffer-size', '512', 'テストメッセージ'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.bufferSize).toBe(512);
            expect(result.text).toBe('テストメッセージ');
        });

        test('ヘルプオプションが正しく検出されること', async () => {
            const args = ['-h'];
            await expect((cli as unknown).parseArguments(args)).rejects.toThrow('HELP_REQUESTED');
        });

        test('音声リスト表示オプションが正しく検出されること', async () => {
            const args = ['-v', '?'];
            await expect((cli as unknown).parseArguments(args)).rejects.toThrow('VOICE_LIST_REQUESTED');
        });

        test('複数のオプションを組み合わせて解析できること', async () => {
            const args = ['-r', '180', '-v', 'custom-voice', '-o', 'test.wav', 'テスト'];
            const result = await (cli as unknown).parseArguments(args);

            expect(result.text).toBe('テスト');
            expect(result.rate).toBe(180);
            expect(result.voice).toBe('custom-voice');
            expect(result.outputFile).toBe('test.wav');
        });

        test('不明なオプションでエラーになること', async () => {
            const args = ['--unknown-option', 'メッセージ'];
            
            await expect((cli as unknown).parseArguments(args)).rejects.toThrow('Unknown option --unknown-option');
        });

        test('引数なしの場合、デフォルト値が返されること', async () => {
            const result = await (cli as unknown).parseArguments([]);

            expect(result.voice).toBe('');
            expect(result.rate).toBe(200);
            expect(result.inputFile).toBe('');
            expect(result.outputFile).toBe('');
            expect(result.text).toBe('');
            expect(result.chunkMode).toBe('punctuation');
            expect(result.bufferSize).toBe(2048);
        });
    });

    describe('getInputText', () => {
        test('引数で指定されたテキストを返すこと', async () => {
            const options = { text: 'Hello, World!', inputFile: '' };
            const result = await (cli as unknown).getInputText(options);

            expect(result).toBe('Hello, World!');
        });

        test('ファイルからテキストを読み込むこと', async () => {
            const options = { text: '', inputFile: 'test.txt' };
            mockReadFile.mockResolvedValue('File content');

            const result = await (cli as unknown).getInputText(options);

            expect(result).toBe('File content');
            expect(mockReadFile).toHaveBeenCalledWith('test.txt', 'utf8');
        });

        test('ファイル読み込みエラー時に適切なエラーを投げること', async () => {
            const options = { text: '', inputFile: 'nonexistent.txt' };
            mockReadFile.mockRejectedValue(new Error('ENOENT'));

            await expect((cli as unknown).getInputText(options)).rejects.toThrow(
                "File 'nonexistent.txt' not found"
            );
        });

        test.skip('テキストとファイルの両方が未指定の場合、標準入力から読み込みを試みること', async () => {
            // 標準入力のモックが難しいため、スキップ
            const options = { text: '', inputFile: '' };
            // 実際には標準入力から読み込むが、テスト環境では待機してタイムアウトする
        });
    });

    describe('showUsage', () => {
        test('ヘルプメッセージを出力すること', async () => {
            await cli.showUsage();

            expect(consoleSpy.log).toHaveBeenCalled();
            const output = consoleSpy.log.mock.calls[0][0];
            expect(output).toContain('Usage: say-coeiroink');
            expect(output).toContain('-v voice');
            expect(output).toContain('-r rate');
            expect(output).toContain('-o outfile');
        });
    });

    describe('run', () => {
        test('正常なテキスト音声合成が実行されること', async () => {
            const args = ['テストメッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith('テストメッセージ', {
                voice: null,
                rate: 200,
                outputFile: null,
                style: undefined,
                chunkMode: 'punctuation',
                bufferSize: 2048,
            });
        });

        test('入力ファイルからの音声合成が実行されること', async () => {
            const args = ['-f', 'input.txt'];
            mockReadFile.mockResolvedValue('ファイル内容');

            await cli.run(args);

            expect(mockReadFile).toHaveBeenCalledWith('input.txt', 'utf8');
            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith('ファイル内容', {
                voice: null,
                rate: 200,
                outputFile: null,
                style: undefined,
                chunkMode: 'punctuation',
                bufferSize: 2048,
            });
        });

        test('カスタムオプションでの音声合成が実行されること', async () => {
            const args = ['-r', '150', '-v', 'custom-voice', '--style', 'ひそひそ', 'メッセージ'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith('メッセージ', {
                voice: 'custom-voice',
                rate: 150,
                outputFile: null,
                style: 'ひそひそ',
                chunkMode: 'punctuation',
                bufferSize: 2048,
            });
        });

        test('出力ファイル指定時にメッセージが表示されること', async () => {
            const args = ['-o', 'output.wav', 'テスト'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith('テスト', {
                voice: null,
                rate: 200,
                outputFile: 'output.wav',
                style: undefined,
                chunkMode: 'punctuation',
                bufferSize: 2048,
            });
            expect(consoleSpy.error).toHaveBeenCalledWith('Audio saved to: output.wav');
        });

        test('音声合成エラー時に適切にハンドリングされること', async () => {
            const args = ['エラーテスト'];
            mockSayCoeiroink.waitCompletion.mockRejectedValue(new Error('Synthesis failed'));

            await expect(cli.run(args)).rejects.toThrow('Synthesis failed');
        });
    });

    describe('エッジケース', () => {
        test.skip('空文字列のテキストは無視されること', async () => {
            // 空文字列の引数は、テキストなしとして扱われ、標準入力を待つ
            // 標準入力のモックが難しいため、スキップ
            const args = [''];
        });

        test('非常に長いテキストでも正常に処理されること', async () => {
            const longText = 'あ'.repeat(10000);
            const args = [longText];
            
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(longText, expect.anything(Object));
        });

        test('特殊文字を含むテキストでも正常に処理されること', async () => {
            const specialText = '🎉 Hello! こんにちは！<>[]{}';
            const args = [specialText];
            
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalledWith(specialText, expect.anything(Object));
        });

        test('境界値のレート設定でも正常に処理されること', async () => {
            const args = ['-r', '50', 'テスト'];
            await cli.run(args);

            expect(mockSayCoeiroink.synthesize).toHaveBeenCalled();
            const callArgs = mockSayCoeiroink.synthesize.mock.calls[0][1];
            expect(callArgs.rate).toBe(50);
        });
    });
});