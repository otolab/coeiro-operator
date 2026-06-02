#!/usr/bin/env node --no-deprecation
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as path from 'path';
import { Command } from 'commander';
import { SayCoeiroink } from '@coeiro-operator/audio';
import {
  ConfigManager,
  getConfigDir,
  OperatorManager,
  getSessionId,
  CharacterInfoService,
  DictionaryService,
  TerminalBackground,
  type ToolGroup,
} from '@coeiro-operator/core';
import { logger, LoggerPresets } from '@coeiro-operator/common';

// Tool registration functions
import {
  registerOperatorAssignTool,
  registerOperatorReleaseTool,
  registerOperatorStatusTool,
  registerOperatorAvailableTool,
  registerOperatorStylesTool,
} from './tools/operator.js';
import {
  registerSayTool,
  // registerParallelGenerationControlTool,
} from './tools/speech.js';
import {
  registerQueueStatusTool,
  registerQueueClearTool,
  registerPlaybackStopTool,
  registerWaitForTaskCompletionTool,
} from './tools/playback.js';
import { registerDictionaryRegisterTool } from './tools/dictionary.js';
import { registerDebugLogsTool } from './tools/debug.js';

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
    instructions: [
      'COEIRO Operator - 音声オペレータの管理と日本語発声を提供するMCPサーバー。',
      '',
      '音声オペレータ:',
      '- 発声(say)はオペレータが行うのでアシスタントはその発言内容を作成する',
      '- オペレータは端末セッション単位で管理され(operator_status)、音声出力に使用するキャラクター×そのスタイルの割り当て(operator_assign)で管理される',
      '- 割り当てにおいてキャラクタは重複できず(operator_available)、LLMのセッションとは独立して永続する',
      '- 明示的(operator_release)・あるいは一定時間未使用で解放',
    ].join('\n'),
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
let characterInfoService: CharacterInfoService;
let dictionaryService: DictionaryService;
let terminalBackground: TerminalBackground | null = null;
let isGroupEnabled: (group: ToolGroup) => boolean = () => true;

try {
  const configDir = configPath ? path.dirname(configPath) : await getConfigDir();
  const configManager = new ConfigManager(configDir);
  await configManager.buildDynamicConfig();

  // TerminalBackgroundを初期化
  terminalBackground = new TerminalBackground(configManager);
  await terminalBackground.initialize();

  sayCoeiroink = new SayCoeiroink(configManager);

  logger.info('Initializing SayCoeiroink...');
  await sayCoeiroink.initialize();
  logger.info('Building dynamic config...');
  await sayCoeiroink.buildDynamicConfig();

  logger.info('Initializing OperatorManager...');
  const { id: sessionId } = await getSessionId();
  characterInfoService = new CharacterInfoService();
  characterInfoService.initialize(configManager);
  operatorManager = new OperatorManager(sessionId, configManager, characterInfoService);
  await operatorManager.initialize();

  logger.info('Initializing Dictionary...');
  const config = await configManager.getFullConfig();
  dictionaryService = new DictionaryService(config?.connection);
  await dictionaryService.initialize();

  // ツールグループの有効/無効設定を取得
  const toolsConfig = await configManager.getToolsConfig();
  isGroupEnabled = (group: ToolGroup) => configManager.isToolGroupEnabled(toolsConfig, group);

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
    await terminalBackground.initialize();

    sayCoeiroink = new SayCoeiroink(fallbackConfigManager);
    await sayCoeiroink.initialize();
    await sayCoeiroink.buildDynamicConfig();

    const { id: fallbackSessionId } = await getSessionId();
    characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(fallbackConfigManager);
    operatorManager = new OperatorManager(fallbackSessionId, fallbackConfigManager, characterInfoService);
    await operatorManager.initialize();

    dictionaryService = new DictionaryService();
    await dictionaryService.initialize();

    const fallbackToolsConfig = await fallbackConfigManager.getToolsConfig();
    isGroupEnabled = (group: ToolGroup) => fallbackConfigManager.isToolGroupEnabled(fallbackToolsConfig, group);

    logger.info('Fallback initialization completed');
  } catch (fallbackError) {
    logger.error('Fallback initialization also failed:', (fallbackError as Error).message);
    throw fallbackError;
  }
}

// ツールの登録
logger.info('Registering MCP tools...');

// 利用可能なキャラクタ一覧を取得
const availableCharacters = await operatorManager.getAvailableOperators();
logger.info('Available characters for MCP tools:', { available: availableCharacters.available });

// Operator tools
if (isGroupEnabled('operator')) {
  registerOperatorAssignTool(server, sayCoeiroink, operatorManager, characterInfoService, terminalBackground, availableCharacters.available);
  registerOperatorReleaseTool(server, operatorManager, terminalBackground);
  registerOperatorStatusTool(server, operatorManager);
  registerOperatorAvailableTool(server, operatorManager);
  registerOperatorStylesTool(server, operatorManager, characterInfoService);
} else {
  logger.info('Operator tools disabled by configuration');
}

// Speech tools
if (isGroupEnabled('speech')) {
  registerSayTool(server, sayCoeiroink, operatorManager, characterInfoService, terminalBackground);
} else {
  logger.info('Speech tools disabled by configuration');
}

// Playback tools
if (isGroupEnabled('playback')) {
  registerQueueStatusTool(server, sayCoeiroink);
  registerQueueClearTool(server, sayCoeiroink);
  registerPlaybackStopTool(server, sayCoeiroink);
  registerWaitForTaskCompletionTool(server, sayCoeiroink);
} else {
  logger.info('Playback tools disabled by configuration');
}

// Dictionary tool
if (isGroupEnabled('dictionary')) {
  registerDictionaryRegisterTool(server, dictionaryService);
} else {
  logger.info('Dictionary tools disabled by configuration');
}

// Debug tool
if (isGroupEnabled('debug')) {
  registerDebugLogsTool(server);
} else {
  logger.info('Debug tools disabled by configuration');
}

logger.info('All MCP tools registered successfully');

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
