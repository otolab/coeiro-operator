import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SayCoeiroink } from '@coeiro-operator/audio';
import { OperatorManager, CharacterInfoService, TerminalBackground } from '@coeiro-operator/core';
import { logger } from '@coeiro-operator/common';
import type { ToolResponse } from '../types.js';

/**
 * sayツールの登録
 * COEIROINKを使って日本語音声を非同期で出力します（低レイテンシストリーミング対応）
 */
export function registerSayTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink,
  operatorManager: OperatorManager,
  characterInfoService: CharacterInfoService,
  terminalBackground: TerminalBackground | null
): void {
  server.registerTool(
    'say',
    {
      description:
        'COEIROINKを使って日本語音声を非同期で出力します（低レイテンシストリーミング対応、即座にレスポンス）',
      inputSchema: {
        message: z.string().describe('発話させるメッセージ（日本語）'),
        voice: z.string().optional().describe('音声ID（省略時はオペレータ設定を使用）'),
        rate: z.number().optional().describe('絶対速度（WPM、200 = 標準）'),
        factor: z.number().optional().describe('相対速度（倍率、1.0 = 等速）'),
        style: z
          .string()
          .optional()
          .describe(
            "スタイル名（日本語名をそのまま指定。例: ディアちゃんの場合 'のーまる', 'ひそひそ', 'セクシー'）"
          ),
      },
    },
    async (args): Promise<ToolResponse> => {
      const { message, voice, rate, factor, style } = args;

      try {
        logger.debug('=== SAY TOOL DEBUG START ===');
        logger.debug(`Input parameters:`);
        logger.debug(`  message: "${message}"`);
        logger.debug(`  voice: ${voice || 'null (will use operator voice)'}`);
        logger.debug(`  rate: ${rate || 'undefined (will use config default)'}`);
        logger.debug(`  factor: ${factor || 'undefined (will use speaker natural speed)'}`);
        logger.debug(`  style: ${style || 'undefined (will use operator default)'}`);

        // rateとfactorの同時指定チェック
        if (rate !== undefined && factor !== undefined) {
          throw new Error('rateとfactorは同時に指定できません。どちらか一方を指定してください。');
        }

        // voice文字列をパース（"characterId:styleName"形式に対応）
        let parsedVoice: string | null = voice || null;
        let parsedStyle: string | undefined = style;

        if (voice && voice.includes(':')) {
          const parts = voice.split(':');
          if (parts.length === 2) {
            parsedVoice = parts[0];
            // styleパラメータが明示されていない場合のみ、voice文字列から抽出したstyleを使用
            if (!style) {
              parsedStyle = parts[1];
              logger.debug(`  voice文字列からパース: characterId="${parsedVoice}", style="${parsedStyle}"`);
            } else {
              logger.warn(`voice文字列にstyleが含まれていますが、styleパラメータが優先されます`);
            }
          } else {
            throw new Error(
              `不正なvoice形式です: "${voice}"\n` +
              `使用可能な形式:\n` +
              `  - "characterId" (例: "alma")\n` +
              `  - "characterId:styleName" (例: "alma:のーまる")`
            );
          }
        }

        // Issue #58: オペレータ未アサイン時の再アサイン促進メッセージ
        // voiceパラメータが指定されている場合はオペレータ不要
        const currentOperator = await operatorManager.showCurrentOperator();
        if (!currentOperator.characterId && !parsedVoice) {
          // オペレータ未割り当て時に背景画像をクリア
          if (terminalBackground) {
            if (await terminalBackground.isEnabled()) {
              await terminalBackground.clearBackground();
              logger.info('オペレータ未割り当てのため背景画像をクリア');
            }
          }

          // 利用可能なオペレータを取得
          let availableOperators: string[] = [];
          try {
            const result = await operatorManager.getAvailableOperators();
            availableOperators = result.available;
          } catch (error) {
            logger.warn(`Failed to get available operators: ${(error as Error).message}`);
          }

          let guidanceMessage = '⚠️  オペレータが割り当てられていません。\n\n';
          guidanceMessage += '🔧 次の手順で進めてください：\n';
          guidanceMessage += '1. operator_assign を実行（通常は引数なしで）\n';
          guidanceMessage += '2. 再度 say コマンドで音声を生成\n\n';

          if (availableOperators.length > 0) {
            guidanceMessage += `🎭 利用可能なオペレータ: ${availableOperators.join(', ')}\n\n`;
            guidanceMessage +=
              "💡 operator_assign を引数なしで実行すると、ランダムに選択されます。";
          } else {
            guidanceMessage +=
              '❌ 現在利用可能なオペレータがありません。しばらく待ってから再試行してください。';
          }

          guidanceMessage += '\n\n💡 または、voice パラメータで直接キャラクターを指定することもできます。';

          return {
            content: [
              {
                type: 'text',
                text: guidanceMessage,
              },
            ],
          };
        }

        // Issue #58: 動的タイムアウト延長 - sayコマンド実行時にオペレータ予約を延長
        // ベストエフォート非同期処理（エラーは無視、音声生成をブロックしない）
        // オペレータがアサインされている場合のみ予約を延長
        if (currentOperator.characterId) {
          operatorManager
            .refreshOperatorReservation()
            .then(refreshSuccess => {
              if (refreshSuccess) {
                logger.info(`Operator reservation refreshed for: ${currentOperator.characterId}`);
              } else {
                logger.warn(
                  `Could not refresh operator reservation for: ${currentOperator.characterId} - operator may have already expired`
                );
              }
            })
            .catch(error => {
              logger.error(
                `Operator reservation refresh failed: ${(error as Error).message} - operator timeout extension failed`
              );
            });
        }

        // スタイル検証（事前チェック）
        // parsedStyleとparsedVoiceを使用
        if (parsedStyle) {
          try {
            // voiceが指定されている場合はそのキャラクターのスタイル、なければ現在のオペレータのスタイルを検証
            const targetCharacterId = parsedVoice || currentOperator.characterId;

            if (!targetCharacterId) {
              throw new Error(`キャラクター情報が取得できません`);
            }

            const character = await characterInfoService.getCharacterInfo(targetCharacterId);
            if (!character) {
              throw new Error(`キャラクター '${targetCharacterId}' が見つかりません`);
            }

            // 利用可能なスタイルを取得
            const availableStyles = Object.values(character.styles || {});

            // 指定されたスタイルが存在するか確認
            const styleExists = availableStyles.some(s => s.styleName === parsedStyle);

            if (!styleExists) {
              const styleNames = availableStyles.map(s => s.styleName);
              throw new Error(
                `指定されたスタイル '${parsedStyle}' が ${character.speakerName || targetCharacterId} には存在しません。\n` +
                `利用可能なスタイル: ${styleNames.join(', ')}`
              );
            }
          } catch (error) {
            logger.error(`スタイル検証エラー: ${(error as Error).message}`);
            throw error;
          }
        }

        // 設定情報をログ出力
        // NOTE: ConfigManagerはすでにsayCoeiroink内部で管理されているため、
        // ここでは設定のログ出力をスキップ
        logger.debug('Audio config is managed internally by SayCoeiroink');
        logger.debug('==============================');

        // 速度設定オプションを構築（CLIと同じ形式）
        const speedOptions: { rate?: number; factor?: number } = {};
        if (rate !== undefined) {
          speedOptions.rate = rate;
        }
        if (factor !== undefined) {
          speedOptions.factor = factor;
        }

        // MCP設計: 音声合成タスクをキューに投稿のみ（再生完了を待たない）
        // - synthesize() はキューに追加して即座にレスポンス
        // - 実際の音声合成・再生は背景のSpeechQueueで非同期処理
        // - CLIとは異なり、MCPではウォームアップ・完了待機は実行しない
        const result = sayCoeiroink.synthesize(message, {
          voice: parsedVoice,
          ...speedOptions,  // rateまたはfactorを展開
          style: parsedStyle,
          allowFallback: false, // MCPツールではオペレータが必須
        });

        // 結果をログ出力
        logger.debug(`Result: ${JSON.stringify(result)}`);

        // オペレータまたはvoice指定の情報を取得
        const voiceInfo = currentOperator.characterId
          ? `オペレータ: ${currentOperator.characterId}`
          : `voice指定: ${parsedVoice}${parsedStyle ? `:${parsedStyle}` : ''}`;

        const modeInfo = `発声キューに追加 - ${voiceInfo}, タスクID: ${result.taskId}`;
        logger.info(modeInfo);

        logger.debug('=== SAY TOOL DEBUG END ===');

        // 即座にレスポンスを返す（音声合成の完了を待たない）
        // タスクIDとキュー長の情報も含める
        const responseText = `音声合成を開始しました - ${voiceInfo}\n` +
                           `タスクID: ${result.taskId}\n` +
                           `キュー長: ${result.queueLength} 個`;

        return {
          content: [
            {
              type: 'text',
              text: responseText,
            },
          ],
        };
      } catch (error) {
        logger.debug(`SAY TOOL ERROR: ${(error as Error).message}`);
        logger.debug(`Stack trace: ${(error as Error).stack}`);
        throw new Error(`音声出力エラー: ${(error as Error).message}`);
      }
    }
  );
}

/**
 * parallel_generation_controlツールの登録
 * チャンク並行生成機能の制御と設定管理
 */
export function registerParallelGenerationControlTool(
  server: McpServer,
  sayCoeiroink: SayCoeiroink
): void {
  server.registerTool(
    'parallel_generation_control',
    {
      description:
        'チャンク並行生成機能の制御と設定管理を行います。生成の並行数、待機時間、先読み数、初回ポーズ機能などを調整できます。',
      inputSchema: {
        action: z
          .enum(['enable', 'disable', 'status', 'update_options'])
          .describe('実行するアクション'),
        options: z
          .object({
            maxConcurrency: z.number().min(1).max(5).optional().describe('最大並行生成数（1-5）'),
            delayBetweenRequests: z
              .number()
              .min(0)
              .max(1000)
              .optional()
              .describe('リクエスト間隔（ms、0-1000）'),
            bufferAheadCount: z.number().min(0).max(3).optional().describe('先読みチャンク数（0-3）'),
            pauseUntilFirstComplete: z
              .boolean()
              .optional()
              .describe('初回チャンク完了まで並行生成をポーズ（レイテンシ改善）'),
          })
          .optional()
          .describe('更新するオプション（action=update_optionsの場合）'),
      },
    },
    async args => {
      const { action, options } = args || {};

      try {
        switch (action) {
          case 'enable':
            sayCoeiroink.setParallelGenerationEnabled(true);
            return {
              content: [
                {
                  type: 'text',
                  text: '✅ 並行チャンク生成を有効化しました。\n\n⚡ 効果:\n- 複数チャンクの同時生成により高速化\n- レスポンシブな音声再生開始\n- 体感的なレイテンシ削減',
                },
              ],
            };

          case 'disable':
            sayCoeiroink.setParallelGenerationEnabled(false);
            return {
              content: [
                {
                  type: 'text',
                  text: '⏸️ 並行チャンク生成を無効化しました。\n\n🔄 従来の逐次生成モードに戻りました。\n- 安定性重視の動作\n- メモリ使用量削減',
                },
              ],
            };

          case 'status': {
            const currentOptions = sayCoeiroink.getStreamControllerOptions();
            const stats = sayCoeiroink.getGenerationStats();

            return {
              content: [
                {
                  type: 'text',
                  text:
                    `📊 並行生成ステータス\n\n` +
                    `🎛️ 設定:\n` +
                    `  - 状態: ${currentOptions.maxConcurrency > 1 ? '✅ 並行生成' : '❌ 逐次生成'}\n` +
                    `  - 最大並行数: ${currentOptions.maxConcurrency} ${currentOptions.maxConcurrency === 1 ? '(逐次モード)' : '(並行モード)'}\n` +
                    `  - リクエスト間隔: ${currentOptions.delayBetweenRequests}ms\n` +
                    `  - 先読み数: ${currentOptions.bufferAheadCount}\n` +
                    `  - 初回ポーズ: ${currentOptions.pauseUntilFirstComplete ? '✅ 有効' : '❌ 無効'}\n\n` +
                    `📈 現在の統計:\n` +
                    `  - アクティブタスク: ${stats.activeTasks}\n` +
                    `  - 完了済み結果: ${stats.completedResults}\n` +
                    `  - メモリ使用量: ${(stats.totalMemoryUsage / 1024).toFixed(1)}KB`,
                },
              ],
            };
          }

          case 'update_options':
            if (options) {
              sayCoeiroink.updateStreamControllerOptions(options);
              const updatedOptions = sayCoeiroink.getStreamControllerOptions();

              return {
                content: [
                  {
                    type: 'text',
                    text:
                      `⚙️ オプション更新完了\n\n` +
                      `🔧 新しい設定:\n` +
                      `  - 最大並行数: ${updatedOptions.maxConcurrency} ${updatedOptions.maxConcurrency === 1 ? '(逐次モード)' : '(並行モード)'}\n` +
                      `  - リクエスト間隔: ${updatedOptions.delayBetweenRequests}ms\n` +
                      `  - 先読み数: ${updatedOptions.bufferAheadCount}\n` +
                      `  - 初回ポーズ: ${updatedOptions.pauseUntilFirstComplete ? '✅ 有効' : '❌ 無効'}\n\n` +
                      `💡 次回の音声合成から適用されます。`,
                  },
                ],
              };
            } else {
              throw new Error('update_optionsアクションにはoptionsパラメータが必要です');
            }

          default:
            throw new Error(`無効なアクション: ${action}`);
        }
      } catch (error) {
        throw new Error(`並行生成制御エラー: ${(error as Error).message}`);
      }
    }
  );
}
