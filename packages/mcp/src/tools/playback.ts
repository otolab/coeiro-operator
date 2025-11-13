import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SayCoeiroink } from '@coeiro-operator/audio';
import type { ToolResponse } from '../types.js';

/**
 * queue_statusツールの登録
 * 音声キューの状態を確認します
 */
export function registerQueueStatusTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  server.registerTool(
    'queue_status',
    {
      description:
        '音声キューの状態を確認します。現在のキュー長、処理状況、次に処理されるタスクIDを取得できます。',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        const status = sayCoeiroink.getSpeechQueueStatus();

        let statusText = '📊 音声キューステータス\n\n';
        statusText += `キュー長: ${status.queueLength} 個\n`;
        statusText += `処理状態: ${status.isProcessing ? '🔄 処理中' : '⏸️ 待機中'}\n`;

        if (status.nextTaskId !== null) {
          statusText += `次のタスクID: ${status.nextTaskId}\n`;
        } else {
          statusText += `次のタスク: なし\n`;
        }

        if (status.queueLength === 0 && !status.isProcessing) {
          statusText += '\n💡 キューは空で、待機中です。';
        } else if (status.isProcessing) {
          statusText += '\n⚡ 音声処理が実行中です。';
        }

        return {
          content: [
            {
              type: 'text',
              text: statusText,
            },
          ],
        };
      } catch (error) {
        throw new Error(`キューステータス取得エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * queue_clearツールの登録
 * 音声キューをクリアします
 */
export function registerQueueClearTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  server.registerTool(
    'queue_clear',
    {
      description:
        '音声キューをクリアします。taskIdsを指定すると特定のタスクのみ削除できます。省略時は全タスクを削除します。現在再生中の音声は停止しません。',
      inputSchema: {
        taskIds: z
          .array(z.number())
          .optional()
          .describe('削除するタスクIDのリスト（省略時は全タスク削除）'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { taskIds } = args || {};

      try {
        const statusBefore = sayCoeiroink.getSpeechQueueStatus();
        const result = await sayCoeiroink.clearSpeechQueue(taskIds);

        let resultText: string;

        if (taskIds && taskIds.length > 0) {
          // 特定タスクの削除
          resultText = '🗑️ 指定されたタスクを削除しました\n\n';
          resultText += `削除されたタスク数: ${result.removedCount} 個\n`;
          resultText += `指定されたタスクID: ${taskIds.join(', ')}\n`;

          if (result.removedCount < taskIds.length) {
            resultText += `\n⚠️ 一部のタスクIDが見つかりませんでした。`;
          }
        } else {
          // 全タスクの削除
          resultText = '🗑️ キューをクリアしました\n\n';
          resultText += `削除されたタスク数: ${result.removedCount} 個\n`;
        }

        if (statusBefore.isProcessing) {
          resultText += '\n⚠️ 注意: 現在再生中の音声は継続されます。';
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
        throw new Error(`キュークリアエラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * playback_stopツールの登録
 * 音声再生を停止します（チャンク境界で停止）
 */
export function registerPlaybackStopTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  server.registerTool(
    'playback_stop',
    {
      description:
        '音声再生を停止します（チャンク境界で停止）。現在再生中のチャンクは最後まで再生され、次のチャンクから停止します。キューにあるタスクは削除されません。',
      inputSchema: {},
    },
    async (): Promise<ToolResponse> => {
      try {
        sayCoeiroink.stopPlayback();

        const status = sayCoeiroink.getSpeechQueueStatus();

        let resultText = '⏹️ 音声再生の停止を要求しました\n\n';
        resultText += '⚠️ 注意:\n';
        resultText += '- 現在再生中のチャンク（文）は最後まで再生されます\n';
        resultText += '- 次のチャンクからは再生されません\n';
        resultText += `- キューにある ${status.queueLength} 個のタスクは削除されていません\n\n`;
        resultText += '💡 タスクも削除する場合は queue_clear を使用してください';

        return {
          content: [
            {
              type: 'text',
              text: resultText,
            },
          ],
        };
      } catch (error) {
        throw new Error(`再生停止エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * wait_for_task_completionツールの登録
 * 音声タスクの完了を待機します
 */
export function registerWaitForTaskCompletionTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  server.registerTool(
    'wait_for_task_completion',
    {
      description:
        '音声タスクの完了を待機します。デフォルトではすべてのタスクが完了するまで待ちますが、remainingQueueLengthを指定すると、キューが指定数になったときに解除されます。デバッグやテスト時に便利です。',
      inputSchema: {
        timeout: z
          .number()
          .min(1000)
          .max(60000)
          .optional()
          .describe('タイムアウト時間（ミリ秒、1000-60000、デフォルト30000）'),
        remainingQueueLength: z
          .number()
          .min(0)
          .optional()
          .describe('この数までキューが減ったら待ちを解除（デフォルト0=全タスク完了まで待機）'),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { timeout = 30000, remainingQueueLength = 0 } = args || {};

      try {
        const startTime = Date.now();

        // 初期状態を取得
        const initialStatus = sayCoeiroink.getSpeechQueueStatus();

        // 待機対象がない場合（remainingQueueLengthを考慮）
        if (initialStatus.queueLength <= remainingQueueLength && !initialStatus.isProcessing) {
          return {
            content: [
              {
                type: 'text',
                text: remainingQueueLength === 0
                  ? '✅ 待機対象のタスクがありません（キューは空で、処理中のタスクもありません）'
                  : `✅ キューは既に目標数（${remainingQueueLength}個）以下です（現在: ${initialStatus.queueLength}個）`,
              },
            ],
          };
        }

        // タイムアウト付きで待機
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), timeout);
        });

        try {
          // waitForQueueLength()を使用してイベントベースで待機
          await Promise.race([
            sayCoeiroink.waitForQueueLength(remainingQueueLength),
            timeoutPromise
          ]);

          const waitedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
          const finalStatus = sayCoeiroink.getSpeechQueueStatus();

          const completionMessage = remainingQueueLength === 0
            ? '💡 すべての音声処理が完了しました。'
            : `💡 キューが目標数（${remainingQueueLength}個）になりました。`;

          return {
            content: [
              {
                type: 'text',
                text:
                  `✅ 待機完了\n\n` +
                  `待機時間: ${waitedSeconds}秒\n` +
                  `最終ステータス:\n` +
                  `  - キュー長: ${finalStatus.queueLength} 個\n` +
                  `  - 処理状態: ${finalStatus.isProcessing ? '処理中' : '待機中'}\n\n` +
                  completionMessage,
              },
            ],
          };
        } catch (error) {
          if ((error as Error).message === 'Timeout') {
            const currentStatus = sayCoeiroink.getSpeechQueueStatus();
            const timeoutMessage = remainingQueueLength === 0
              ? `⚠️ タスクがまだ完了していません。`
              : `⚠️ キューが目標数（${remainingQueueLength}個）まで減っていません。`;

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `⏱️ タイムアウト（${timeout / 1000}秒）しました\n\n` +
                    `現在のステータス:\n` +
                    `  - キュー長: ${currentStatus.queueLength} 個\n` +
                    `  - 処理状態: ${currentStatus.isProcessing ? '処理中' : '待機中'}\n\n` +
                    timeoutMessage,
                },
              ],
            };
          }
          throw error;
        }
      } catch (error) {
        throw new Error(`タスク待機エラー: ${(error as Error).message}`);
      }
    }
  );
}
