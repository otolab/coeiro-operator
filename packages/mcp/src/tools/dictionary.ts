/**
 * Dictionary関連のMCPツール定義
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { DictionaryService } from '@coeiro-operator/core';
import { logger } from '@coeiro-operator/common';

import type { ToolResponse } from '../types.js';

/**
 * dictionary_register ツールを登録
 * COEIROINKのユーザー辞書に単語を登録する
 */
export function registerDictionaryRegisterTool(
  server: McpServer,
  dictionaryService: DictionaryService
): void {
  server.registerTool(
    'dictionary_register',
    {
      description: 'ユーザー辞書に単語を登録する',
      inputSchema: {
        word: z.string().describe('登録する単語'),
        yomi: z.string().describe('読み（全角カタカナ）'),
        accent: z.number().describe('アクセント位置（0=平板型、1以上=該当モーラが高）'),
        numMoras: z.number().describe('モーラ数'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { word, yomi, accent, numMoras } = args;

      try {
        // 接続確認
        const isConnected = await dictionaryService.checkConnection();
        if (!isConnected) {
          return {
            content: [
              {
                type: 'text',
                text:
                  '❌ COEIROINKサーバーに接続できません。\n' +
                  'サーバーが起動していることを確認してください。',
              },
            ],
          };
        }

        // 単語を登録（DictionaryServiceが永続化まで処理）
        const success = await dictionaryService.addWord({ word, yomi, accent, numMoras });

        if (success) {
          return {
            content: [
              {
                type: 'text',
                text:
                  `✅ 単語を辞書に登録しました\n\n` +
                  `単語: ${word}\n` +
                  `読み方: ${yomi}\n` +
                  `アクセント: ${accent}\n` +
                  `モーラ数: ${numMoras}\n\n` +
                  `💾 辞書データは永続化され、次回起動時に自動登録されます。`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text',
                text: `❌ 辞書登録に失敗しました`,
              },
            ],
          };
        }
      } catch (error) {
        logger.error(`Dictionary registration error:`, error);
        throw new Error(`辞書登録エラー: ${(error as Error).message}`);
      }
    }
  );
}
