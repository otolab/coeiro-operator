#!/usr/bin/env node --no-deprecation
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import { Command } from 'commander';
import { SayCoeiroink } from '@coeiro-operator/audio';
import {
  ConfigManager,
  getConfigDir,
  OperatorManager,
  DictionaryService,
  TerminalBackground
} from '@coeiro-operator/core';
import { logger, LoggerPresets } from '@coeiro-operator/common';
import type { Character } from '@coeiro-operator/core';

interface StyleInfo {
  id: string;
  name: string;
  personality: string;
  speakingStyle: string;
  morasPerSecond?: number;
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
  [key: string]: unknown; // MCP SDK\u304c\u8ffd\u52a0\u30d5\u30a3\u30fc\u30eb\u30c9\u3092\u8a31\u53ef\u3059\u308b\u305f\u3081\u5fc5\u8981
}

interface CLIOptions {
  debug?: boolean;
  config?: string;
}

// Commanderの設定と引数解析
const program = new Command();
program
  .name('coeiro-operator-mcp')
  .description('COEIRO Operator MCP Server')
  .version('1.0.0')
  .option('-d, --debug', 'Enable debug logging')
  .option('-c, --config <path>', 'Path to config file')
  .parse(process.argv);

const options = program.opts<CLIOptions>();
const { debug: isDebugMode, config: configPath } = options;

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

// 環境変数のデバッグ出力
logger.debug('Environment variables check:', {
  TERM_PROGRAM: process.env.TERM_PROGRAM,
  ITERM_SESSION_ID: process.env.ITERM_SESSION_ID,
  TERM_SESSION_ID: process.env.TERM_SESSION_ID,
  NODE_ENV: process.env.NODE_ENV
});

let sayCoeiroink: SayCoeiroink;
let operatorManager: OperatorManager;
let dictionaryService: DictionaryService;
let terminalBackground: TerminalBackground | null = null;

try {
  const configDir = configPath ? path.dirname(configPath) : await getConfigDir();
  const configManager = new ConfigManager(configDir);
  await configManager.buildDynamicConfig();

  // TerminalBackgroundを初期化
  terminalBackground = new TerminalBackground(configManager);

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

    // TerminalBackgroundを初期化
    terminalBackground = new TerminalBackground(fallbackConfigManager);

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
  return (character.speaker?.styles || []).map(style => {
    // スタイル毎の設定があればそれを使用、なければキャラクターのデフォルトを使用
    const styleConfig = character.styles?.[style.styleId];
    return {
      id: style.styleId.toString(),
      name: style.styleName,
      personality: styleConfig?.personality || character.personality,
      speakingStyle: styleConfig?.speakingStyle || character.speakingStyle,
      morasPerSecond: styleConfig?.morasPerSecond,
    };
  });
}

function formatAssignmentResult(assignResult: AssignResult, availableStyles: StyleInfo[]): string {
  let resultText = `${assignResult.characterName} (${assignResult.characterId}) をアサインしました。\n\n`;

  if (assignResult.currentStyle) {
    resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName}\n`;
    resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
    resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n`;
    // 現在のスタイルの話速を取得
    const currentStyleInfo = availableStyles.find(s => s.id === assignResult.currentStyle?.styleId);
    if (currentStyleInfo?.morasPerSecond) {
      resultText += `   基準話速: ${currentStyleInfo.morasPerSecond} モーラ/秒\n`;
    }
    resultText += '\n';
  }

  if (availableStyles.length > 1) {
    resultText += `🎭 利用可能なスタイル（切り替え可能）:\n`;
    availableStyles.forEach(style => {
      const isCurrent = style.id === assignResult.currentStyle?.styleId;
      const marker = isCurrent ? '→ ' : '  ';
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `    性格: ${style.personality}\n`;
      resultText += `    話し方: ${style.speakingStyle}\n`;
      if (style.morasPerSecond) {
        resultText += `    基準話速: ${style.morasPerSecond} モーラ/秒\n`;
      }
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

  // defaultStyleIdからスタイル名を取得
  const defaultStyleInfo = character.styles?.[character.defaultStyleId];
  const defaultStyleName = defaultStyleInfo?.styleName || `ID:${character.defaultStyleId}`;
  resultText += `   デフォルトスタイル: ${defaultStyleName}\n\n`;

  if (availableStyles.length > 0) {
    resultText += `🎨 利用可能なスタイル (${availableStyles.length}種類):\n`;
    availableStyles.forEach(style => {
      const isDefault = style.name === defaultStyleName;
      const marker = isDefault ? '★ ' : '  ';
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `   性格: ${style.personality}\n`;
      resultText += `   話し方: ${style.speakingStyle}\n`;
      if (style.morasPerSecond) {
        resultText += `   基準話速: ${style.morasPerSecond} モーラ/秒\n`;
      }
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
      'オペレータを割り当てます。通常は引数なしで実行し、ランダムに選択されます。特定のオペレータが必要な場合のみ名前を指定してください。スタイル切り替えはsayツールのstyleパラメータで日本語名を指定します。',
    inputSchema: {
      operator: z
        .string()
        .optional()
        .describe(
          "オペレータ名（省略推奨。特定のオペレータが必要な場合のみ英語表記で指定）"
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

          const character = await operatorManager.getCharacterInfo(targetCharacterId);
          if (!character) {
            throw new Error(`キャラクター '${targetCharacterId}' が見つかりません`);
          }

          // 利用可能なスタイルを取得
          const availableStyles = character.speaker?.styles || [];

          // 指定されたスタイルが存在するか確認
          const styleExists = availableStyles.some(s => s.styleName === parsedStyle);

          if (!styleExists) {
            const styleNames = availableStyles.map(s => s.styleName);
            throw new Error(
              `指定されたスタイル '${parsedStyle}' が ${character.speaker?.speakerName || targetCharacterId} には存在しません。\n` +
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

// キュー状態確認ツール
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

// キュークリアツール
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

// 再生停止ツール
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

// タスク完了待機ツール
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
