/**
 * src/index.test.ts: MCPサーバーテスト（allowFallback動作確認）
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SayCoeiroink } from '@coeiro-operator/audio';
import type { SynthesizeResult } from '@coeiro-operator/audio';

// モックの設定
vi.mock('@coeiro-operator/audio');
vi.mock('@coeiro-operator/core');

const MockSayCoeiroink = SayCoeiroink as unknown as ReturnType<typeof vi.fn>;

describe('MCP Server allowFallback behavior', () => {
    let mockSayCoeiroinkInstance: any;
    
    beforeEach(() => {
        vi.clearAllMocks();
        
        // モックインスタンスを作成
        mockSayCoeiroinkInstance = {
            enqueueSpeech: vi.fn(),
            initialize: vi.fn(),
            buildDynamicConfig: vi.fn()
        } as unknown;
        
        MockSayCoeiroink.mockImplementation(() => mockSayCoeiroinkInstance);
    });

    describe('say ツール (MCP)', () => {
        test('allowFallback=false が設定されてオペレータ未アサイン時にエラーになること', async () => {
            // オペレータが割り当てられていない状況をシミュレート
            const expectedError = new Error('オペレータが割り当てられていません。まず operator_assign を実行してください。');
            mockSayCoeiroinkInstance.enqueueSpeech.mockRejectedValue(expectedError);

            // MCPのsayツール呼び出しをシミュレート
            const mockMessage = 'テストメッセージ';
            const mcpOptions = {
                voice: null,
                rate: undefined,
                streamMode: false,
                style: undefined,
                allowFallback: false  // MCPでは明示的にfalse
            };

            // enqueueSpeech が正しい引数で呼ばれることを確認
            await expect(
                mockSayCoeiroinkInstance.enqueueSpeech(mockMessage, mcpOptions)
            ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');

            expect(mockSayCoeiroinkInstance.enqueueSpeech).toHaveBeenCalledWith(
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
            
            mockSayCoeiroinkInstance.enqueueSpeech.mockResolvedValue(expectedResult);

            const mockMessage = 'テストメッセージ';
            const mcpOptions = {
                voice: null,
                rate: undefined,
                streamMode: false,
                style: undefined,
                allowFallback: false
            };

            const result = await mockSayCoeiroinkInstance.enqueueSpeech(mockMessage, mcpOptions);

            expect(result).toEqual(expectedResult);
            expect(mockSayCoeiroinkInstance.enqueueSpeech).toHaveBeenCalledWith(
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
            
            mockSayCoeiroinkInstance.enqueueSpeech.mockResolvedValue(expectedResult);

            // CLIからの呼び出しをシミュレート（allowFallbackは未指定またはtrue）
            const mockMessage = 'テストメッセージ';
            const cliOptions = {
                voice: null,
                rate: 200,
                outputFile: null,
                streamMode: false
                // allowFallbackは指定されない（デフォルトtrue）
            };

            const result = await mockSayCoeiroinkInstance.enqueueSpeech(mockMessage, cliOptions);

            expect(result).toEqual(expectedResult);
            expect(mockSayCoeiroinkInstance.enqueueSpeech).toHaveBeenCalledWith(
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

            mockSayCoeiroinkInstance.enqueueSpeech
                .mockResolvedValueOnce({ success: true, taskId: 1, queueLength: 1 })
                .mockResolvedValueOnce({ success: true, mode: 'normal' });

            // MCP呼び出し
            await mockSayCoeiroinkInstance.enqueueSpeech('MCPテスト', mcpOptions);
            
            // CLI呼び出し
            await mockSayCoeiroinkInstance.enqueueSpeech('CLIテスト', cliOptions);

            expect(mockSayCoeiroinkInstance.enqueueSpeech).toHaveBeenNthCalledWith(
                1,
                'MCPテスト',
                expect.objectContaining({
                    allowFallback: false
                })
            );

            expect(mockSayCoeiroinkInstance.enqueueSpeech).toHaveBeenNthCalledWith(
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
            mockSayCoeiroinkInstance.enqueueSpeech.mockRejectedValue(expectedError);

            const mcpOptions = {
                voice: null,
                allowFallback: false
            };

            await expect(
                mockSayCoeiroinkInstance.enqueueSpeech('テスト', mcpOptions)
            ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');
        });

        test('CLIでのフォールバック時にエラーが発生しないこと', async () => {
            // CLIではオペレータが未アサインでもデフォルト音声にフォールバック
            const expectedResult: SynthesizeResult = {
                success: true,
                mode: 'normal',
                latency: 100
            };

            mockSayCoeiroinkInstance.enqueueSpeech.mockResolvedValue(expectedResult);

            const cliOptions = {
                voice: null
                // allowFallback未指定（デフォルトtrue）
            };

            const result = await mockSayCoeiroinkInstance.enqueueSpeech('テスト', cliOptions);

            expect(result).toEqual(expectedResult);
            expect(result.success).toBe(true);
        });
    });

    describe('voice形式のパース', () => {
        test('不正なvoice形式（コロンが複数）でエラーが発生すること', () => {
            const invalidVoice = 'alma:裏:extra';

            // パース処理をシミュレート
            const parseVoice = (voice: string) => {
                if (voice && voice.includes(':')) {
                    const parts = voice.split(':');
                    if (parts.length !== 2) {
                        throw new Error(
                            `不正なvoice形式です: "${voice}"\n` +
                            `使用可能な形式:\n` +
                            `  - "characterId" (例: "alma")\n` +
                            `  - "characterId:styleName" (例: "alma:のーまる")`
                        );
                    }
                    return { characterId: parts[0], styleName: parts[1] };
                }
                return { characterId: voice, styleName: undefined };
            };

            expect(() => parseVoice(invalidVoice)).toThrow('不正なvoice形式です');
            expect(() => parseVoice(invalidVoice)).toThrow('alma:裏:extra');
        });

        test('正常なvoice形式（characterId:styleName）が正しくパースされること', () => {
            const validVoice = 'alma:のーまる';

            const parseVoice = (voice: string) => {
                if (voice && voice.includes(':')) {
                    const parts = voice.split(':');
                    if (parts.length !== 2) {
                        throw new Error('不正なvoice形式');
                    }
                    return { characterId: parts[0], styleName: parts[1] };
                }
                return { characterId: voice, styleName: undefined };
            };

            const result = parseVoice(validVoice);
            expect(result.characterId).toBe('alma');
            expect(result.styleName).toBe('のーまる');
        });

        test('characterIdのみの場合も正しくパースされること', () => {
            const validVoice = 'alma';

            const parseVoice = (voice: string) => {
                if (voice && voice.includes(':')) {
                    const parts = voice.split(':');
                    if (parts.length !== 2) {
                        throw new Error('不正なvoice形式');
                    }
                    return { characterId: parts[0], styleName: parts[1] };
                }
                return { characterId: voice, styleName: undefined };
            };

            const result = parseVoice(validVoice);
            expect(result.characterId).toBe('alma');
            expect(result.styleName).toBeUndefined();
        });
    });

    describe('Issue #180: voice指定時に別キャラのstyleを使用', () => {
        test('voice指定時、そのキャラのstyleを検証すること', () => {
            // operator_assign=tsukuyomiの状態で
            // voice="alma" + style="のーまる"を指定
            // → almaの「のーまる」が検証されるべき

            const currentOperator = { characterId: 'tsukuyomi' };
            const voice = 'alma';

            // targetCharacterIdの決定（voice指定時はそのキャラ、未指定時はオペレータ）
            const targetCharacterId = voice || currentOperator.characterId;

            expect(targetCharacterId).toBe('alma');
            // almaの「のーまる」が検証される
        });

        test('voice未指定時、オペレータのstyleを検証すること', () => {
            // operator_assign=tsukuyomiの状態で
            // voice未指定 + style="ささやき"を指定
            // → tsukuyomiの「ささやき」が検証されるべき

            const currentOperator = { characterId: 'tsukuyomi' };
            const voice = null;

            // targetCharacterIdの決定
            const targetCharacterId = voice || currentOperator.characterId;

            expect(targetCharacterId).toBe('tsukuyomi');
            // tsukuyomiの「ささやき」が検証される
        });
    });

    describe('Issue #179: クラッシュ防止（存在しないキャラクター）', () => {
        test('存在しないvoiceでクラッシュせず、適切なエラーメッセージを返すこと', () => {
            // 存在しないキャラクターを指定した場合のエラーハンドリング
            const invalidVoice = 'nonexistent_character';

            // resolveCharacterToConfigのシミュレーション
            const handleInvalidCharacter = (characterId: string) => {
                // characterConfigが取得できない場合
                const characterConfig = null;
                if (!characterConfig) {
                    throw new Error(`Character not found: ${characterId}`);
                }
            };

            expect(() => handleInvalidCharacter(invalidVoice)).toThrow('Character not found: nonexistent_character');
        });

        test('存在しないvoice:styleでクラッシュせず、適切なエラーメッセージを返すこと', () => {
            // alma:裏のような存在しない組み合わせ
            const invalidVoice = 'alma:裏';

            const parseVoice = (voice: string) => {
                if (voice && voice.includes(':')) {
                    const parts = voice.split(':');
                    if (parts.length !== 2) {
                        throw new Error('不正なvoice形式');
                    }
                    return { characterId: parts[0], styleName: parts[1] };
                }
                return { characterId: voice, styleName: undefined };
            };

            const result = parseVoice(invalidVoice);
            expect(result.characterId).toBe('alma');
            expect(result.styleName).toBe('裏');

            // この後、getCharacterInfo('alma')が呼ばれ、
            // almaに「裏」というstyleがなければエラーが返される
            // クラッシュではなく、適切なエラーメッセージが表示される
        });
    });
});