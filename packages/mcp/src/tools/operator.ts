/**
 * Operator関連のMCPツール定義
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  OperatorManager,
  CharacterInfoService,
  TerminalBackground,
} from '@coeiro-operator/core';
import { logger } from '@coeiro-operator/common';
import { SayCoeiroink } from '@coeiro-operator/audio';

import type { ToolResponse, StyleInfo } from '../types.js';
import {
  validateOperatorInput,
  assignOperator,
  extractStyleInfo,
  formatAssignmentResult,
  formatStyleList,
  formatStylesResult,
  getTargetCharacter,
} from '../utils.js';

/**
 * operator_assign ツールを登録
 * オペレータを割り当てる
 */
export function registerOperatorAssignTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink,
  operatorManager: OperatorManager,
  characterInfoService: CharacterInfoService,
  terminalBackground: TerminalBackground | null,
  availableCharacters: string[]
): void {
  // 'AUTO'を先頭に追加して選択肢を作成
  const operatorOptions = ['AUTO', ...availableCharacters] as [string, ...string[]];

  server.registerTool(
    'operator_assign',
    {
      description: 'オペレータを割り当てる。AUTOで自動選択',
      inputSchema: {
        characterId: z
          .enum(operatorOptions)
          .optional()
          .describe(
            'キャラクターID（省略時AUTO）',
          ),
        styleName: z
          .string()
          .optional()
          .describe(
            'スタイル名またはスタイルID',
          ),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { characterId, styleName } = args || {};

      logger.info('オペレータアサイン開始', { characterId, styleName });

      // 'AUTO'の場合はundefinedとして扱う（自動選択）
      const effectiveCharacterId = characterId === 'AUTO' ? undefined : characterId;

      validateOperatorInput(effectiveCharacterId);

      try {
        const assignResult = await assignOperator(operatorManager, effectiveCharacterId, styleName);
        logger.info('オペレータアサイン成功', {
          characterId: assignResult.characterId,
          characterName: assignResult.characterName,
        });

        // 背景画像を切り替え
        if (terminalBackground) {
          logger.error('🔧 TerminalBackground instance exists');
          const isEnabled = await terminalBackground.isEnabled();
          logger.error('📊 Terminal background enabled check:', { isEnabled });

          if (isEnabled) {
            logger.error('🔄 Switching background for character:', assignResult.characterId);
            await terminalBackground.switchCharacter(assignResult.characterId);
            logger.error('✅ 背景画像切り替え完了', { characterId: assignResult.characterId });
          } else {
            logger.error('⚠️ Terminal background is not enabled');
          }
        } else {
          logger.error('❌ TerminalBackground instance is null');
        }

        const character = await characterInfoService.getCharacterInfo(assignResult.characterId);

        if (!character) {
          throw new Error(`キャラクター情報が見つかりません: ${assignResult.characterId}`);
        }

        const availableStyles = extractStyleInfo(character);
        const resultText = formatAssignmentResult(assignResult, availableStyles);

        // 挨拶メッセージがある場合は発話
        if (assignResult.greeting && assignResult.currentStyle) {
          logger.info('オペレータ挨拶を発話', { greeting: assignResult.greeting });
          try {
            // MCP設計: 音声合成タスクをキューに投稿のみ（再生完了を待たない）
            const result = sayCoeiroink.synthesize(assignResult.greeting, {
              voice: assignResult.characterId,
              style: assignResult.currentStyle.styleName,
              allowFallback: false,
            });
            logger.info('挨拶発話をキューに追加', { taskId: result.taskId });
          } catch (sayError) {
            logger.warn('挨拶の発話に失敗しました', { error: (sayError as Error).message });
            // 発話エラーはアサイン処理全体のエラーとはしない
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      } catch (error) {
        throw new Error(`オペレータ割り当てエラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * operator_release ツールを登録
 * 現在のオペレータを解放する
 */
export function registerOperatorReleaseTool(
  server: McpServer,
  operatorManager: OperatorManager,
  terminalBackground: TerminalBackground | null
): void {
  server.registerTool(
    'operator_release',
    {
      description: '現在のオペレータを解放する',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        const result = await operatorManager.releaseOperator();

        let releaseMessage: string;
        if (result.wasAssigned) {
          releaseMessage = `オペレータを解放しました: ${result.characterName}`;
          logger.info(`オペレータ解放: ${result.characterId}`);
        } else {
          releaseMessage = 'オペレータは割り当てられていません';
          logger.info('オペレータ未割り当て状態');
        }

        // 背景画像をクリア（オペレータの有無に関わらず実行）
        if (terminalBackground) {
          if (await terminalBackground.isEnabled()) {
            await terminalBackground.clearBackground();
            logger.info('背景画像クリア完了');
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: releaseMessage,
            },
          ],
        };
      } catch (error) {
        throw new Error(`オペレータ解放エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * operator_status ツールを登録
 * 現在のオペレータ状況を確認する
 */
export function registerOperatorStatusTool(
  server: McpServer,
  operatorManager: OperatorManager,
  characterInfoService: CharacterInfoService
): void {
  server.registerTool(
    'operator_status',
    {
      description: '現在のオペレータ状態を確認する',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        const status = await operatorManager.showCurrentOperator();

        if (!status.characterId) {
          return {
            content: [{ type: 'text', text: status.message }],
          };
        }

        let resultText = `現在のオペレータ: ${status.characterName || status.characterId} (${status.characterId})\n`;

        if (status.currentStyle) {
          resultText += `現在のスタイル: ${status.currentStyle.styleName} (${status.currentStyle.styleId})\n`;
          resultText += `   性格: ${status.currentStyle.personality}\n`;
          resultText += `   話し方: ${status.currentStyle.speakingStyle}\n`;
        }

        const character = await characterInfoService.getCharacterInfo(status.characterId);
        if (character) {
          const availableStyles = extractStyleInfo(character);
          resultText += formatStyleList(availableStyles, status.currentStyle?.styleId);
        }

        return {
          content: [{ type: 'text', text: resultText }],
        };
      } catch (error) {
        throw new Error(`オペレータ状況確認エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * operator_available ツールを登録
 * 利用可能なオペレータ一覧を表示する
 */
export function registerOperatorAvailableTool(
  server: McpServer,
  operatorManager: OperatorManager
): void {
  server.registerTool(
    'operator_available',
    {
      description: '利用可能なオペレータ一覧を表示する',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        const result = await operatorManager.getAvailableOperators();
        let text =
          result.available.length > 0
            ? `利用可能なオペレータ: ${result.available.join(', ')}`
            : '利用可能なオペレータがありません';

        if (result.busy.length > 0) {
          text += `\n仕事中のオペレータ: ${result.busy.join(', ')}`;
        }

        return {
          content: [
            {
              type: 'text',
              text: text,
            },
          ],
        };
      } catch (error) {
        throw new Error(`利用可能オペレータ確認エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * operator_styles ツールを登録
 * 現在のオペレータまたは指定したキャラクターの利用可能なスタイル一覧を表示する
 */
export function registerOperatorStylesTool(
  server: McpServer,
  operatorManager: OperatorManager,
  characterInfoService: CharacterInfoService
): void {
  server.registerTool(
    'operator_styles',
    {
      description: '指定キャラクターの基本情報とスタイル一覧を表示する',
      inputSchema: {
        characterId: z
          .string()
          .optional()
          .describe('キャラクターID（省略時は現在のオペレータ）'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { characterId } = args || {};

      try {
        // getTargetCharacter関数を使用してキャラクター情報を取得
        const { character: targetCharacter } = await getTargetCharacter(
          operatorManager,
          characterInfoService,
          characterId
        );

        // スタイル情報を取得
        const availableStyles: StyleInfo[] = extractStyleInfo(targetCharacter);

        // 結果を整形
        const resultText = formatStylesResult(targetCharacter, availableStyles);

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      } catch (error) {
        throw new Error(`スタイル情報取得エラー: ${(error as Error).message}`);
      }
    }
  );
}
