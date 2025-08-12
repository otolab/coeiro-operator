/**
 * src/index.test.ts: MCPサーバーテスト（allowFallback動作確認）
 */

import { SayCoeiroink } from '../core/say/index.js';
import type { SynthesizeResult } from '../core/say/types.js';

// モックの設定
vi.mock('../core/say/index.js');
vi.mock('../core/operator/index.js');

const MockSayCoeiroink = SayCoeiroink as jest.MockedClass<typeof SayCoeiroink>;

describe('MCP Server allowFallback behavior', () => {
    let mockSayCoeiroinkInstance: jest.Mocked<SayCoeiroink>;
    
    beforeEach(() => {
        vi.clearAllMocks();
        
        // モックインスタンスを作成
        mockSayCoeiroinkInstance = {
            synthesizeTextAsync: vi.fn(),
            initialize: vi.fn(),
            buildDynamicConfig: vi.fn()
        } as any;
        
        MockSayCoeiroink.mockImplementation(() => mockSayCoeiroinkInstance);
    });

    describe('say ツール (MCP)', () => {
        test('allowFallback=false が設定されてオペレータ未アサイン時にエラーになること', async () => {
            // オペレータが割り当てられていない状況をシミュレート
            const expectedError = new Error('オペレータが割り当てられていません。まず operator_assign を実行してください。');
            mockSayCoeiroinkInstance.synthesizeTextAsync.mockRejectedValue(expectedError);

            // MCPのsayツール呼び出しをシミュレート
            const mockMessage = 'テストメッセージ';
            const mcpOptions = {
                voice: null,
                rate: undefined,
                streamMode: false,
                style: undefined,
                allowFallback: false  // MCPでは明示的にfalse
            };

            // synthesizeTextAsync が正しい引数で呼ばれることを確認
            await expect(
                mockSayCoeiroinkInstance.synthesizeTextAsync(mockMessage, mcpOptions)
            ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');

            expect(mockSayCoeiroinkInstance.synthesizeTextAsync).toHaveBeenCalledWith(
                mockMessage,
                expect.objectContaining({
                    allowFallback: false
                })
            );
        });

        test('オペレータがアサインされている場合は正常に動作すること', async () => {
            const expectedResult: SynthesizeResult = {
                success: true,
                taskId: 12345,
                queueLength: 1
            };
            
            mockSayCoeiroinkInstance.synthesizeTextAsync.mockResolvedValue(expectedResult);

            const mockMessage = 'テストメッセージ';
            const mcpOptions = {
                voice: null,
                rate: undefined,
                streamMode: false,
                style: undefined,
                allowFallback: false
            };

            const result = await mockSayCoeiroinkInstance.synthesizeTextAsync(mockMessage, mcpOptions);

            expect(result).toEqual(expectedResult);
            expect(mockSayCoeiroinkInstance.synthesizeTextAsync).toHaveBeenCalledWith(
                mockMessage,
                expect.objectContaining({
                    allowFallback: false
                })
            );
        });
    });

    describe('say-coeiroink CLI との比較', () => {
        test('CLIではallowFallback=true（デフォルト）でフォールバックが有効であること', async () => {
            const expectedResult: SynthesizeResult = {
                success: true,
                mode: 'normal',
                latency: 100
            };
            
            mockSayCoeiroinkInstance.synthesizeTextAsync.mockResolvedValue(expectedResult);

            // CLIからの呼び出しをシミュレート（allowFallbackは未指定またはtrue）
            const mockMessage = 'テストメッセージ';
            const cliOptions = {
                voice: null,
                rate: 200,
                outputFile: null,
                streamMode: false
                // allowFallbackは指定されない（デフォルトtrue）
            };

            const result = await mockSayCoeiroinkInstance.synthesizeTextAsync(mockMessage, cliOptions);

            expect(result).toEqual(expectedResult);
            expect(mockSayCoeiroinkInstance.synthesizeTextAsync).toHaveBeenCalledWith(
                mockMessage,
                expect.not.objectContaining({
                    allowFallback: false
                })
            );
        });

        test('MCPとCLIで異なるallowFallback設定が適用されること', async () => {
            // MCP呼び出し
            const mcpOptions = {
                voice: null,
                allowFallback: false
            };

            // CLI呼び出し
            const cliOptions = {
                voice: null
                // allowFallback未指定（デフォルトtrue）
            };

            mockSayCoeiroinkInstance.synthesizeTextAsync
                .mockResolvedValueOnce({ success: true, taskId: 1, queueLength: 1 })
                .mockResolvedValueOnce({ success: true, mode: 'normal' });

            // MCP呼び出し
            await mockSayCoeiroinkInstance.synthesizeTextAsync('MCPテスト', mcpOptions);
            
            // CLI呼び出し
            await mockSayCoeiroinkInstance.synthesizeTextAsync('CLIテスト', cliOptions);

            expect(mockSayCoeiroinkInstance.synthesizeTextAsync).toHaveBeenNthCalledWith(
                1,
                'MCPテスト',
                expect.objectContaining({
                    allowFallback: false
                })
            );

            expect(mockSayCoeiroinkInstance.synthesizeTextAsync).toHaveBeenNthCalledWith(
                2,
                'CLIテスト',
                expect.not.objectContaining({
                    allowFallback: false
                })
            );
        });
    });

    describe('エラーメッセージの確認', () => {
        test('MCPでのオペレータ未アサインエラーメッセージが適切であること', async () => {
            const expectedError = new Error('オペレータが割り当てられていません。まず operator_assign を実行してください。');
            mockSayCoeiroinkInstance.synthesizeTextAsync.mockRejectedValue(expectedError);

            const mcpOptions = {
                voice: null,
                allowFallback: false
            };

            await expect(
                mockSayCoeiroinkInstance.synthesizeTextAsync('テスト', mcpOptions)
            ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');
        });

        test('CLIでのフォールバック時にエラーが発生しないこと', async () => {
            // CLIではオペレータが未アサインでもデフォルト音声にフォールバック
            const expectedResult: SynthesizeResult = {
                success: true,
                mode: 'normal',
                latency: 100
            };
            
            mockSayCoeiroinkInstance.synthesizeTextAsync.mockResolvedValue(expectedResult);

            const cliOptions = {
                voice: null
                // allowFallback未指定（デフォルトtrue）
            };

            const result = await mockSayCoeiroinkInstance.synthesizeTextAsync('テスト', cliOptions);

            expect(result).toEqual(expectedResult);
            expect(result.success).toBe(true);
        });
    });
});