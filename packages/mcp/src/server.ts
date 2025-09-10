#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import { SayCoeiroink } from '@coeiro-operator/audio';
import { 
  ConfigManager,
  getConfigDir,
  OperatorManager,
  DictionaryService
} from '@coeiro-operator/core';
import { logger, LoggerPresets } from '@coeiro-operator/common';
import type { Character } from '@coeiro-operator/core';

// デバッグ: 環境変数を確認
if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
  console.error(`[MCP Server] Environment: NODE_ENV=${process.env.NODE_ENV}, CI=${process.env.CI}`);
}

interface StyleInfo {
  id: string;
  name: string;
  personality: string;
  speakingStyle: string;
}

interface AssignResult {
  characterId: string;
  characterName: string;
  currentStyle?: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  greeting?: string;
}

interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  [key: string]: any;
}

// コマンドライン引数の解析
const parseArguments = () => {
  const args = process.argv.slice(2);
  let isDebugMode = false;
  let configPath: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--debug' || arg === '-d') {
      isDebugMode = true;
    } else if (arg === '--config' || arg === '-c') {
      configPath = args[i + 1];
      i++; // 次の引数をスキップ
    } else if (arg.startsWith('--config=')) {
      configPath = arg.split('=')[1];
    }
  }

  return { isDebugMode, configPath };
};

const { isDebugMode, configPath } = parseArguments();

// デバッグモードの場合は詳細ログ、そうでなければMCPサーバーモード
if (isDebugMode) {
  LoggerPresets.mcpServerDebugWithAccumulation(); // デバッグモード：全レベル出力・蓄積
  logger.info('DEBUG MODE: Verbose logging enabled (--debug flag detected)');
} else {
  LoggerPresets.mcpServerWithAccumulation(); // 通常モード：info以上のみ蓄積
}

if (configPath) {
  logger.info(`Using config file: ${configPath}`);
}

const server = new McpServer(
  {
    name: 'coeiro-operator',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// top-level awaitを使用した同期的初期化
logger.info('Initializing COEIRO Operator services...');

let sayCoeiroink: SayCoeiroink;
let operatorManager: OperatorManager;
let dictionaryService: DictionaryService;

try {
  const configDir = configPath ? path.dirname(configPath) : await getConfigDir();
  const configManager = new ConfigManager(configDir);
  await configManager.buildDynamicConfig();
  
  sayCoeiroink = new SayCoeiroink(configManager);

  logger.info('Initializing SayCoeiroink...');
  await sayCoeiroink.initialize();
  logger.info('Building dynamic config...');
  await sayCoeiroink.buildDynamicConfig();

  logger.info('Initializing OperatorManager...');
  operatorManager = new OperatorManager();
  await operatorManager.initialize();

  logger.info('Initializing Dictionary...');
  const config = await configManager.getFullConfig();
  dictionaryService = new DictionaryService(config?.connection);
  await dictionaryService.initialize();

  logger.info('SayCoeiroink, OperatorManager and Dictionary initialized successfully');
} catch (error) {
  logger.error('Failed to initialize services:', (error as Error).message);
  logger.error('Error stack:', (error as Error).stack);
  logger.warn('Using fallback configuration...');

  // フォールバック設定で初期化
  try {
    const fallbackConfigDir = await getConfigDir();
    const fallbackConfigManager = new ConfigManager(fallbackConfigDir);
    await fallbackConfigManager.buildDynamicConfig();
    
    sayCoeiroink = new SayCoeiroink(fallbackConfigManager);
    await sayCoeiroink.initialize();
    await sayCoeiroink.buildDynamicConfig();

    operatorManager = new OperatorManager();
    await operatorManager.initialize();

    dictionaryService = new DictionaryService();
    await dictionaryService.initialize();
    logger.info('Fallback initialization completed');
  } catch (fallbackError) {
    logger.error('Fallback initialization also failed:', (fallbackError as Error).message);
    throw fallbackError;
  }
}

// Utility functions for operator assignment
function validateOperatorInput(operator?: string): void {
  if (operator !== undefined && operator !== '' && operator !== null) {
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error(
        'オペレータ名は英語表記で指定してください（例: tsukuyomi, alma）。日本語は使用できません。'
      );
    }
  }
}

async function assignOperator(
  manager: OperatorManager,
  operator?: string,
  style?: string
): Promise<AssignResult> {
  if (operator && operator !== '' && operator !== null) {
    return await manager.assignSpecificOperator(operator, style);
  } else {
    return await manager.assignRandomOperator(style);
  }
}

function extractStyleInfo(character: Character): StyleInfo[] {
  return (character.speaker?.styles || []).map(style => ({
    id: style.styleId.toString(),
    name: style.styleName,
    personality: character.personality,
    speakingStyle: character.speakingStyle,
  }));
}

function formatAssignmentResult(assignResult: AssignResult, availableStyles: StyleInfo[]): string {
  let resultText = `${assignResult.characterName} (${assignResult.characterId}) をアサインしました。\n\n`;

  if (assignResult.currentStyle) {
    resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName}\n`;
    resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
    resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n\n`;
  }

  if (availableStyles.length > 1) {
    resultText += `🎭 利用可能なスタイル（切り替え可能）:\n`;
    availableStyles.forEach(style => {
      const isCurrent = style.id === assignResult.currentStyle?.styleId;
      const marker = isCurrent ? '→ ' : '  ';
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `    性格: ${style.personality}\n`;
      resultText += `    話し方: ${style.speakingStyle}\n`;
    });
  } else {
    resultText += `ℹ️  このキャラクターは1つのスタイルのみ利用可能です。\n`;
  }

  if (assignResult.greeting) {
    resultText += `\n💬 "${assignResult.greeting}"\n`;
  }

  return resultText;
}

// Utility functions for operator styles
async function getTargetCharacter(
  manager: OperatorManager,
  characterId?: string
): Promise<{ character: Character; characterId: string }> {
  if (characterId) {
    try {
      const character = await manager.getCharacterInfo(characterId);
      if (!character) {
        throw new Error(`キャラクター '${characterId}' が見つかりません`);
      }
      return { character, characterId };
    } catch (error) {
      throw new Error(`キャラクター '${characterId}' が見つかりません`);
    }
  } else {
    const currentOperator = await manager.showCurrentOperator();
    if (!currentOperator.characterId) {
      throw new Error(
        '現在オペレータが割り当てられていません。まず operator_assign を実行してください。'
      );
    }

    const character = await manager.getCharacterInfo(currentOperator.characterId);
    if (!character) {
      throw new Error(
        `現在のオペレータ '${currentOperator.characterId}' のキャラクター情報が見つかりません`
      );
    }

    return { character, characterId: currentOperator.characterId };
  }
}

function formatStylesResult(character: Character, availableStyles: StyleInfo[]): string {
  let resultText = `🎭 ${character.speaker?.speakerName || character.characterId} のスタイル情報\n\n`;

  resultText += `📋 基本情報:\n`;
  resultText += `   性格: ${character.personality}\n`;
  resultText += `   話し方: ${character.speakingStyle}\n`;
  resultText += `   デフォルトスタイル: ${character.defaultStyle}\n\n`;

  if (availableStyles.length > 0) {
    resultText += `🎨 利用可能なスタイル (${availableStyles.length}種類):\n`;
    availableStyles.forEach((style, index) => {
      const isDefault = style.id === character.defaultStyle;
      const marker = isDefault ? '★ ' : `${index + 1}. `;
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `   性格: ${style.personality}\n`;
      resultText += `   話し方: ${style.speakingStyle}\n`;
      if (isDefault) {
        resultText += `   (デフォルトスタイル)\n`;
      }
      resultText += `\n`;
    });
  } else {
    resultText += `⚠️  利用可能なスタイルがありません。\n`;
  }

  return resultText;
}

// operator-manager操作ツール
server.registerTool(
  'operator_assign',
  {
    description:
      'オペレータをランダム選択して割り当てます。アサイン後に現在のスタイルと利用可能な他のスタイル情報を表示します。スタイル切り替えはsayツールのstyleパラメータで日本語名を指定します（例: say({message: "テスト", style: "ひそひそ"})）。',
    inputSchema: {
      operator: z
        .string()
        .optional()
        .describe(
          "指定するオペレータ名（英語表記、例: 'tsukuyomi', 'alma'など。省略時または空文字列時はランダム選択。日本語表記は無効）"
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
      const character = await operatorManager.getCharacterInfo(assignResult.characterId);

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

server.registerTool(
  'operator_release',
  {
    description: '現在のオペレータを解放します',
    inputSchema: {},
  },
  async (): Promise<ToolResponse> => {
    try {
      await operatorManager.releaseOperator();
      return {
        content: [
          {
            type: 'text',
            text: 'オペレータを解放しました',
          },
        ],
      };
    } catch (error) {
      throw new Error(`オペレータ解放エラー: ${(error as Error).message}`);
    }
  }
);

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

// say音声出力ツール（src/say/index.js使用）
server.registerTool(
  'say',
  {
    description:
      'COEIROINKを使って日本語音声を非同期で出力します（低レイテンシストリーミング対応、即座にレスポンス）',
    inputSchema: {
      message: z.string().describe('発話させるメッセージ（日本語）'),
      voice: z.string().optional().describe('音声ID（省略時はオペレータ設定を使用）'),
      rate: z.number().optional().describe('話速（WPM、デフォルト200）'),
      style: z
        .string()
        .optional()
        .describe(
          "スタイル名（日本語名をそのまま指定。例: ディアちゃんの場合 'のーまる', 'ひそひそ', 'セクシー'）"
        ),
    },
  },
  async (args): Promise<ToolResponse> => {
    const { message, voice, rate, style } = args;

    try {
      logger.debug('=== SAY TOOL DEBUG START ===');
      logger.debug(`Input parameters:`);
      logger.debug(`  message: "${message}"`);
      logger.debug(`  voice: ${voice || 'null (will use operator voice)'}`);
      logger.debug(`  rate: ${rate || 'undefined (will use config default)'}`);
      logger.debug(`  style: ${style || 'undefined (will use operator default)'}`);

      // Issue #58: オペレータ未アサイン時の再アサイン促進メッセージ
      const currentOperator = await operatorManager.showCurrentOperator();
      if (!currentOperator.characterId) {
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
        guidanceMessage += '1. operator_assign を実行してオペレータを選択\n';
        guidanceMessage += '2. 再度 say コマンドで音声を生成\n\n';

        if (availableOperators.length > 0) {
          guidanceMessage += `🎭 利用可能なオペレータ: ${availableOperators.join(', ')}\n\n`;
          guidanceMessage +=
            "💡 例：operator_assign ツールで 'tsukuyomi' を選択する場合は、operator パラメータに 'tsukuyomi' を指定してください。";
        } else {
          guidanceMessage +=
            '❌ 現在利用可能なオペレータがありません。しばらく待ってから再試行してください。';
        }

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
      operatorManager
        .refreshOperatorReservation()
        .then(refreshSuccess => {
          if (refreshSuccess) {
            logger.debug(`Operator reservation refreshed for: ${currentOperator.characterId}`);
          } else {
            logger.debug(
              `Could not refresh operator reservation for: ${currentOperator.characterId} (not critical)`
            );
          }
        })
        .catch(error => {
          logger.debug(
            `Operator reservation refresh failed: ${(error as Error).message} (not critical)`
          );
        });

      // スタイル検証（事前チェック）
      if (style && currentOperator.characterId) {
        try {
          const character = await operatorManager.getCharacterInfo(currentOperator.characterId);
          if (!character) {
            throw new Error(`キャラクター情報が取得できません`);
          }

          // 利用可能なスタイルを取得
          const availableStyles = character.speaker?.styles || [];

          // 指定されたスタイルが存在するか確認
          const styleExists = availableStyles.some(s => s.styleName === style);

          if (!styleExists) {
            const styleNames = availableStyles.map(s => s.styleName);
            throw new Error(
              `指定されたスタイル '${style}' が見つかりません。利用可能なスタイル: ${styleNames.join(', ')}`
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

      // MCP設計: 音声合成タスクをキューに投稿のみ（再生完了を待たない）
      // - synthesizeTextAsync() はキューに追加して即座にレスポンス
      // - 実際の音声合成・再生は背景のSpeechQueueで非同期処理
      // - CLIとは異なり、MCPではウォームアップ・完了待機は実行しない
      const speechPromise = sayCoeiroink.synthesizeTextAsync(message, {
        voice: voice || null,
        rate: rate || undefined,
        style: style || undefined,
        allowFallback: false, // MCPツールではオペレータが必須
      });

      // 完了ログを非同期で処理
      speechPromise
        .then(result => {
          logger.debug(`Result: ${JSON.stringify(result)}`);
          const modeInfo = `発声完了 - オペレータ: ${currentOperator.characterId}, タスクID: ${result.taskId}`;
          logger.info(modeInfo);
        })
        .catch(error => {
          logger.error(`音声合成非同期処理エラー: ${(error as Error).message}`);
        });

      logger.debug('=== SAY TOOL DEBUG END ===');

      // 即座にレスポンスを返す（音声合成の完了を待たない）
      const responseText = `音声合成を開始しました - オペレータ: ${currentOperator.characterId}`;

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

// ログ取得ツール
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

// スタイル情報表示ツール
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
      let targetCharacter: Character | null;
      let targetCharacterId: string;

      if (character) {
        // 指定されたキャラクターの情報を取得
        try {
          targetCharacter = await operatorManager.getCharacterInfo(character);
          if (!targetCharacter) {
            throw new Error(`キャラクター '${character}' が見つかりません`);
          }
          targetCharacterId = character;
        } catch (error) {
          throw new Error(`キャラクター '${character}' が見つかりません`);
        }
      } else {
        // 現在のオペレータの情報を取得
        const currentOperator = await operatorManager.showCurrentOperator();
        if (!currentOperator.characterId) {
          throw new Error(
            '現在オペレータが割り当てられていません。まず operator_assign を実行してください。'
          );
        }

        targetCharacter = await operatorManager.getCharacterInfo(currentOperator.characterId);
        targetCharacterId = currentOperator.characterId;

        if (!targetCharacter) {
          throw new Error(
            `現在のオペレータ '${currentOperator.characterId}' のキャラクター情報が見つかりません`
          );
        }
      }

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

// 並行生成制御ツール
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

// 辞書登録ツール
server.registerTool(
  'dictionary_register',
  {
    description:
      'COEIROINKのユーザー辞書に単語を登録します。専門用語や固有名詞の読み方を正確に制御できます。',
    inputSchema: {
      word: z.string().describe('登録する単語（半角英数字も可、自動で全角変換されます）'),
      yomi: z.string().describe('読み方（全角カタカナ）'),
      accent: z.number().describe('アクセント位置（0:平板型、1以上:該当モーラが高い）'),
      numMoras: z.number().describe('モーラ数（カタカナの音節数）'),
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

// サーバーの起動
async function main(): Promise<void> {
  const transport = new StdioServerTransport();

  logger.info('Say COEIROINK MCP Server starting...');
  await server.connect(transport);
  logger.info('Say COEIROINK MCP Server started');
}

main().catch(error => {
  logger.error('Server error:', error);
  process.exit(1);
});
