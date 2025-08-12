/**
 * src/say/cli.test.ts: CLIクラステスト
 */

import SayCoeiroinkCLI from './say-coeiroink.js';
import { readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

// モックの設定
vi.mock('fs/promises');
vi.mock('../core/say/index.js');

const mockReadFile = readFile as anyedFunction<typeof readFile>;

// SayCoeiroinkクラスのモック
const MockSayCoeiroink = require('./index.js').SayCoeiroink;

// processのモック
const originalArgv = process.argv;
const originalStdin = process.stdin;
const originalExit = process.exit;

describe('SayCoeiroinkCLI', () => {
    let cli: SayCoeiroinkCLI;
    let mockSayCoeiroink: any;
    let mockStdin: any;

    beforeEach(() => {
        // SayCoeiroinkのモックインスタンス
        mockSayCoeiroink = {
            initialize: vi.fn().mockResolvedValue(undefined),
            synthesizeText: vi.fn().mockResolvedValue({ success: true }),
            listVoices: vi.fn().mockResolvedValue(undefined),
            config: { rate: 200 }
        };

        MockSayCoeiroink.mockImplementation(() => mockSayCoeiroink);

        // stdinのモック
        mockStdin = {
            setEncoding: vi.fn(),
            on: vi.fn(),
            read: vi.fn()
        };

        Object.defineProperty(process, 'stdin', {
            value: mockStdin,
            writable: true
        });

        // exitのモック
        Object.defineProperty(process, 'exit', {
            value: vi.fn(),
            writable: true
        });

        cli = new SayCoeiroinkCLI(mockSayCoeiroink);
        
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.argv = originalArgv;
        Object.defineProperty(process, 'stdin', {
            value: originalStdin,
            writable: true
        });
        Object.defineProperty(process, 'exit', {
            value: originalExit,
            writable: true
        });
    });

    describe('parseArguments', () => {
        test('基本的な引数を正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', 'Hello, World!'];

            const result = await cli.parseArguments();

            expect(result).toEqual({
                text: 'Hello, World!',
                rate: undefined,
                voice: undefined,
                outputFile: undefined,
                inputFile: undefined,
                streamMode: false,
                helpRequested: false,
                listVoices: false
            });
        });

        test('レート指定オプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '-r', '150', 'テストメッセージ'];

            const result = await cli.parseArguments();

            expect(result.rate).toBe(150);
            expect(result.text).toBe('テストメッセージ');
        });

        test('音声指定オプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '-v', 'voice-id', 'テストメッセージ'];

            const result = await cli.parseArguments();

            expect(result.voice).toBe('voice-id');
            expect(result.text).toBe('テストメッセージ');
        });

        test('出力ファイル指定オプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '-o', 'output.wav', 'テストメッセージ'];

            const result = await cli.parseArguments();

            expect(result.outputFile).toBe('output.wav');
            expect(result.text).toBe('テストメッセージ');
        });

        test('入力ファイル指定オプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '-f', 'input.txt'];

            const result = await cli.parseArguments();

            expect(result.inputFile).toBe('input.txt');
        });

        test('ストリーミングモードオプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '--stream', 'テストメッセージ'];

            const result = await cli.parseArguments();

            expect(result.streamMode).toBe(true);
            expect(result.text).toBe('テストメッセージ');
        });

        test('ヘルプオプションが正しく検出されること', async () => {
            process.argv = ['node', 'cli.ts', '-h'];

            const result = await cli.parseArguments();

            expect(result.helpRequested).toBe(true);
        });

        test('音声リスト表示オプションが正しく検出されること', async () => {
            process.argv = ['node', 'cli.ts', '-v', '?'];

            const result = await cli.parseArguments();

            expect(result.listVoices).toBe(true);
        });

        test('複数のオプションを組み合わせて解析できること', async () => {
            process.argv = ['node', 'cli.ts', '-r', '180', '-v', 'voice-1', '--stream', '-o', 'out.wav', 'テスト'];

            const result = await cli.parseArguments();

            expect(result).toEqual({
                text: 'テスト',
                rate: 180,
                voice: 'voice-1',
                outputFile: 'out.wav',
                inputFile: undefined,
                streamMode: true,
                helpRequested: false,
                listVoices: false
            });
        });

        test('等号記法のオプションを正しく解析できること', async () => {
            process.argv = ['node', 'cli.ts', '--rate=200', '--voice=test-voice', 'メッセージ'];

            const result = await cli.parseArguments();

            expect(result.rate).toBe(200);
            expect(result.voice).toBe('test-voice');
            expect(result.text).toBe('メッセージ');
        });

        test('無効なレート値の場合エラーを投げること', async () => {
            process.argv = ['node', 'cli.ts', '-r', 'invalid', 'テスト'];

            await expect(cli.parseArguments()).rejects.toThrow('Invalid rate');
        });

        test('引数なしの場合、適切なエラーが投げられること', async () => {
            process.argv = ['node', 'cli.ts'];

            await expect(cli.parseArguments()).rejects.toThrow();
        });
    });

    describe('getInputText', () => {
        test('引数で指定されたテキストを返すこと', async () => {
            const result = await cli.getInputText({
                text: 'Hello World',
                inputFile: undefined
            });

            expect(result).toBe('Hello World');
        });

        test('ファイルからテキストを読み込むこと', async () => {
            const fileContent = 'ファイルからの内容';
            mockReadFile.mockResolvedValueOnce(fileContent);

            const result = await cli.getInputText({
                text: undefined,
                inputFile: 'test.txt'
            });

            expect(result).toBe(fileContent);
            expect(mockReadFile).toHaveBeenCalledWith('test.txt', 'utf8');
        });

        test('標準入力からテキストを読み込むこと', async () => {
            const stdinContent = '標準入力からの内容';
            
            // stdin.readのモック
            mockStdin.read.mockReturnValueOnce(Buffer.from(stdinContent));
            mockStdin.read.mockReturnValueOnce(null); // EOF

            // dataイベントのシミュレート
            mockStdin.on.mockImplementation((event: string, callback: Function) => {
                if (event === 'readable') {
                    setTimeout(callback, 10);
                }
                return mockStdin;
            });

            const result = await cli.getInputText({
                text: undefined,
                inputFile: undefined
            });

            expect(result).toBe(stdinContent);
        });

        test('ファイル読み込みエラー時に適切なエラーを投げること', async () => {
            mockReadFile.mockRejectedValueOnce(new Error('File not found'));

            await expect(
                cli.getInputText({
                    text: undefined,
                    inputFile: 'nonexistent.txt'
                })
            ).rejects.toThrow('File not found');
        });

        test('テキストとファイルの両方が未指定の場合、標準入力を使用すること', async () => {
            const stdinContent = 'stdin content';
            
            mockStdin.read.mockReturnValueOnce(Buffer.from(stdinContent));
            mockStdin.read.mockReturnValueOnce(null);
            
            mockStdin.on.mockImplementation((event: string, callback: Function) => {
                if (event === 'readable') {
                    setTimeout(callback, 10);
                }
                return mockStdin;
            });

            const result = await cli.getInputText({
                text: undefined,
                inputFile: undefined
            });

            expect(result).toBe(stdinContent);
        });
    });

    describe('showUsage', () => {
        test('ヘルプメッセージを出力すること', () => {
            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

            cli.showUsage();

            expect(consoleLogSpy).toHaveBeenCalled();
            const output = consoleLogSpy.mock.calls.map(call => call[0]).join('\n');
            expect(output).toContain('Usage:');
            expect(output).toContain('say-coeiroink');

            consoleLogSpy.mockRestore();
        });
    });

    describe('run', () => {
        test('正常なテキスト音声合成が実行されること', async () => {
            process.argv = ['node', 'cli.ts', 'Hello, World!'];

            await cli.run();

            expect(mockSayCoeiroink.initialize).toHaveBeenCalledTimes(1);
            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('Hello, World!', {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('ヘルプが表示された場合、音声合成は実行されないこと', async () => {
            process.argv = ['node', 'cli.ts', '-h'];

            const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation();

            await cli.run();

            expect(consoleLogSpy).toHaveBeenCalled();
            expect(mockSayCoeiroink.synthesizeText).not.toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);

            consoleLogSpy.mockRestore();
        });

        test('音声リストが表示された場合、音声合成は実行されないこと', async () => {
            process.argv = ['node', 'cli.ts', '-v', '?'];

            await cli.run();

            expect(mockSayCoeiroink.listVoices).toHaveBeenCalledTimes(1);
            expect(mockSayCoeiroink.synthesizeText).not.toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(0);
        });

        test('入力ファイルからの音声合成が実行されること', async () => {
            process.argv = ['node', 'cli.ts', '-f', 'input.txt'];
            mockReadFile.mockResolvedValueOnce('ファイルの内容');

            await cli.run();

            expect(mockReadFile).toHaveBeenCalledWith('input.txt', 'utf8');
            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('ファイルの内容', {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('カスタムオプションでの音声合成が実行されること', async () => {
            process.argv = ['node', 'cli.ts', '-r', '250', '-v', 'custom-voice', '-o', 'output.wav', 'カスタムテスト'];

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('カスタムテスト', {
                voice: 'custom-voice',
                rate: 250,
                outputFile: 'output.wav',
                streamMode: false
            });
        });

        test('ストリーミングモードでの音声合成が実行されること', async () => {
            process.argv = ['node', 'cli.ts', '--stream', 'ストリーミングテスト'];

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('ストリーミングテスト', {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: true
            });
        });

        test('音声合成エラー時に適切にハンドリングされること', async () => {
            process.argv = ['node', 'cli.ts', 'エラーテスト'];
            mockSayCoeiroink.synthesizeText.mockRejectedValueOnce(new Error('Synthesis failed'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

            await cli.run();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Synthesis failed');
            expect(process.exit).toHaveBeenCalledWith(1);

            consoleErrorSpy.mockRestore();
        });

        test('初期化エラー時に適切にハンドリングされること', async () => {
            process.argv = ['node', 'cli.ts', 'テスト'];
            mockSayCoeiroink.initialize.mockRejectedValueOnce(new Error('Initialization failed'));

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

            await cli.run();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error:', 'Initialization failed');
            expect(process.exit).toHaveBeenCalledWith(1);

            consoleErrorSpy.mockRestore();
        });

        test('引数解析エラー時に適切にハンドリングされること', async () => {
            process.argv = ['node', 'cli.ts', '-r', 'invalid'];

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

            await cli.run();

            expect(consoleErrorSpy).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(1);

            consoleErrorSpy.mockRestore();
        });
    });

    describe('エッジケース', () => {
        test('空文字列のテキストでも正常に処理されること', async () => {
            process.argv = ['node', 'cli.ts', ''];

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('', {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('非常に長いテキストでも正常に処理されること', async () => {
            const longText = 'a'.repeat(10000);
            process.argv = ['node', 'cli.ts', longText];

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith(longText, {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('特殊文字を含むテキストでも正常に処理されること', async () => {
            const specialText = '特殊文字: @#$%^&*()_+{}[]|\\:";\'<>?,./～！＠＃';
            process.argv = ['node', 'cli.ts', specialText];

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith(specialText, {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('境界値のレート設定でも正常に処理されること', async () => {
            const boundaryRates = [1, 50, 100, 500, 1000];

            for (const rate of boundaryRates) {
                vi.clearAllMocks();
                process.argv = ['node', 'cli.ts', '-r', rate.toString(), 'テスト'];

                await cli.run();

                expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith('テスト', {
                    voice: undefined,
                    rate: rate,
                    outputFile: undefined,
                    streamMode: false
                });
            }
        });
    });

    describe('非同期処理テスト', () => {
        test('同期的な標準入力読み込みが正常に動作すること', async () => {
            process.argv = ['node', 'cli.ts'];
            
            const stdinData = 'Async stdin test';
            mockStdin.read.mockReturnValueOnce(Buffer.from(stdinData));
            mockStdin.read.mockReturnValueOnce(null);

            mockStdin.on.mockImplementation((event: string, callback: () => void) => {
                if (event === 'readable') {
                    setImmediate(() => callback());
                }
                return mockStdin;
            });

            await cli.run();

            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalledWith(stdinData, {
                voice: undefined,
                rate: undefined,
                outputFile: undefined,
                streamMode: false
            });
        });

        test('音声合成の非同期処理が正常に完了すること', async () => {
            process.argv = ['node', 'cli.ts', '非同期テスト'];
            
            // 遅延のある音声合成をシミュレート
            mockSayCoeiroink.synthesizeText.mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
            );

            const startTime = Date.now();
            await cli.run();
            const endTime = Date.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(100);
            expect(mockSayCoeiroink.synthesizeText).toHaveBeenCalled();
        });
    });
});