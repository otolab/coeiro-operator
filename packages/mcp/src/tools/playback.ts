import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { SayCoeiroink } from '@coeiro-operator/audio';
import type { ToolResponse } from '../types.js';
import { registerToolWithZodShape } from './register-tool.js';

/**
 * queue_statusツールの登録
 * 音声キューの状態を確認します
 */
export function registerQueueStatusTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  registerToolWithZodShape(
    server,
    'queue_status',
    {
      description:
        '共有音声キューの現在の状態を確認します。キュー長、処理中かどうか、次のタスクIDを返します。タスクの成功・失敗履歴は返さないため、キューが空でも正常再生の保証にはなりません。',
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
  registerToolWithZodShape(
    server,
    'queue_clear',
    {
      description:
        '待機中の音声タスクを削除します。taskIds を指定すると該当するタスクを対象にし、省略すると待機中のタスクをすべて削除します。再生中の音声は停止しません。',
      inputSchema: {
        taskIds: z
          .array(z.number())
          .optional()
          .describe('削除する待機中タスクのIDリスト（省略時はすべて削除）'),
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
  registerToolWithZodShape(
    server,
    'playback_stop',
    {
      description:
        '再生中の音声を停止します。現在のチャンクは最後まで再生され、その次のチャンクから停止します。キューで待機中のタスクは削除しません。',
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
  registerToolWithZodShape(
    server,
    'wait_for_task_completion',
    {
      description:
        '個別の say タスクではなく共有音声キュー全体を待機します。remainingQueueLength が 0（既定値）の場合はキューが空で処理中でない状態まで待ちます。0 より大きい場合は待ち行列が指定数以下になると、処理中のタスクが残っていても返ることがあります。開始時点ですでに条件を満たし、処理中でもない場合は即時に返り、蓄積エラーを確認しません。実際に待機した場合、蓄積されたタスクエラーがあれば最初のエラーがツールエラーとして伝播します。timeout（既定30秒、1〜60秒）は警告結果として返り、内部の待機処理は取り消されません。タイムアウト後に再度呼ぶと待機処理が重なるため、queue_status で状態を確認してください。待機はキューを予約・ロックせず、別の呼び出し元がタスクを追加できます。待機完了は音声の正常再生を保証しません。',
      inputSchema: {
        timeout: z
          .number()
          .min(1000)
          .max(60000)
          .optional()
          .describe('待機時間の上限（ミリ秒、1,000〜60,000、既定値30,000）'),
        remainingQueueLength: z
          .number()
          .min(0)
          .optional()
          .describe('待機を解除するキュー残数（既定値0はキューが空になるまで待機）'),
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
