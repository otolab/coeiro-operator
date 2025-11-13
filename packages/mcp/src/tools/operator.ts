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

import type { ToolResponse, StyleInfo } from '../types.js';
import {
  validateOperatorInput,
  assignOperator,
  extractStyleInfo,
  formatAssignmentResult,
  formatStylesResult,
  getTargetCharacter,
} from '../utils.js';

/**
 * operator_assign ツールを登録
 * オペレータを割り当てる
 */
export function registerOperatorAssignTool(
  server: McpServer,
  operatorManager: OperatorManager,
  characterInfoService: CharacterInfoService,
  terminalBackground: TerminalBackground | null
): void {
  server.registerTool(
    'operator_assign',
    {
      description:
        'オペレータを割り当てます。通常は引数なしで実行し、ランダムに選択されます。特定のオペレータが必要な場合のみ名前を指定してください。スタイル切り替えはsayツールのstyleパラメータで日本語名を指定します。',
      inputSchema: {
        operator: z
          .string()
          .optional()
          .describe(
            'オペレータ名（省略推奨。特定のオペレータが必要な場合のみ英語表記で指定）'
          ),
        style: z
          .string()
          .optional()
          .describe(
            "指定するスタイル名（例: 'normal', 'ura', 'sleepy'など。省略時はキャラクターのデフォルト設定に従う）"
          ),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { operator, style } = args || {};

      logger.info('オペレータアサイン開始', { operator, style });
      validateOperatorInput(operator);

      try {
        const assignResult = await assignOperator(operatorManager, operator, style);
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
      description: '現在のオペレータを解放します',
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
  operatorManager: OperatorManager
): void {
  server.registerTool(
    'operator_status',
    {
      description: '現在のオペレータ状況を確認します',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        const status = await operatorManager.showCurrentOperator();

        return {
          content: [
            {
              type: 'text',
              text: status.message,
            },
          ],
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
      description: '利用可能なオペレータ一覧を表示します',
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
      description:
        '現在のオペレータまたは指定したキャラクターの利用可能なスタイル一覧を表示します。キャラクターの基本情報、全スタイルの詳細（性格・話し方）、スタイル選択方法を確認できます。スタイル切り替えにはsayツールのstyleパラメータで日本語名を使用してください。',
      inputSchema: {
        character: z
          .string()
          .optional()
          .describe('キャラクターID（省略時は現在のオペレータのスタイル情報を表示）'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { character } = args || {};

      try {
        // getTargetCharacter関数を使用してキャラクター情報を取得
        const { character: targetCharacter } = await getTargetCharacter(
          operatorManager,
          characterInfoService,
          character
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
