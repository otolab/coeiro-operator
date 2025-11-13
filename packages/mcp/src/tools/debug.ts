/**
 * Debug関連のMCPツール定義
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { logger } from '@coeiro-operator/common';

import type { ToolResponse } from '../types.js';

/**
 * debug_logs ツールを登録
 * デバッグ用ログの取得と表示
 */
export function registerDebugLogsTool(server: McpServer): void {
  server.registerTool(
    'debug_logs',
    {
      description:
        'デバッグ用ログの取得と表示。ログレベル・時刻・検索条件による絞り込み、統計情報の表示が可能',
      inputSchema: {
        action: z
          .enum(['get', 'stats', 'clear'])
          .describe('実行するアクション: get=ログ取得, stats=統計表示, clear=ログクリア'),
        level: z
          .array(z.enum(['error', 'warn', 'info', 'verbose', 'debug']))
          .optional()
          .describe('取得するログレベル（複数選択可）'),
        since: z.string().optional().describe('この時刻以降のログを取得（ISO 8601形式）'),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .optional()
          .describe('取得する最大ログエントリ数（1-1000）'),
        search: z.string().optional().describe('ログメッセージ内の検索キーワード'),
        format: z
          .enum(['formatted', 'raw'])
          .optional()
          .describe('出力形式: formatted=整形済み, raw=生データ'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { action = 'get', level, since, limit, search, format = 'formatted' } = args || {};

      try {
        switch (action) {
          case 'get': {
            const options: Parameters<typeof logger.getLogEntries>[0] = {};

            if (level && level.length > 0) {
              options.level = level as any;
            }

            if (since) {
              try {
                options.since = new Date(since);
              } catch {
                throw new Error(`無効な日時形式です: ${since}`);
              }
            }

            if (limit) {
              options.limit = limit;
            }

            if (search) {
              options.search = search;
            }

            const entries = logger.getLogEntries(options);

            if (entries.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: '条件に一致するログエントリが見つかりませんでした。',
                  },
                ],
              };
            }

            let resultText: string;

            if (format === 'raw') {
              resultText = `ログエントリ (${entries.length}件):\n\n${JSON.stringify(entries, null, 2)}`;
            } else {
              resultText = `ログエントリ (${entries.length}件):\n\n`;
              entries.forEach((entry, index) => {
                resultText += `${index + 1}. [${entry.level.toUpperCase()}] ${entry.timestamp}\n`;
                resultText += `   ${entry.message}\n`;
                if (entry.args && entry.args.length > 0) {
                  resultText += `   引数: ${entry.args
                    .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
                    .join(', ')}\n`;
                }
                resultText += '\n';
              });
            }

            return {
              content: [
                {
                  type: 'text',
                  text: resultText,
                },
              ],
            };
          }

          case 'stats': {
            const stats = logger.getLogStats();
            const statsText =
              `📊 ログ統計情報\n\n` +
              `総エントリ数: ${stats.totalEntries}\n\n` +
              `レベル別エントリ数:\n` +
              `  ERROR: ${stats.entriesByLevel.error}\n` +
              `  WARN:  ${stats.entriesByLevel.warn}\n` +
              `  INFO:  ${stats.entriesByLevel.info}\n` +
              `  VERB:  ${stats.entriesByLevel.verbose}\n` +
              `  DEBUG: ${stats.entriesByLevel.debug}\n\n` +
              `時刻範囲:\n` +
              `  最古: ${stats.oldestEntry || 'なし'}\n` +
              `  最新: ${stats.newestEntry || 'なし'}\n\n` +
              `蓄積モード: ${logger.isAccumulating() ? 'ON' : 'OFF'}`;

            return {
              content: [
                {
                  type: 'text',
                  text: statsText,
                },
              ],
            };
          }

          case 'clear': {
            const beforeCount = logger.getLogStats().totalEntries;
            logger.clearLogEntries();

            return {
              content: [
                {
                  type: 'text',
                  text: `ログエントリをクリアしました（${beforeCount}件削除）`,
                },
              ],
            };
          }

          default:
            throw new Error(`無効なアクション: ${action}`);
        }
      } catch (error) {
        throw new Error(`ログ取得エラー: ${(error as Error).message}`);
      }
    }
  );
}
