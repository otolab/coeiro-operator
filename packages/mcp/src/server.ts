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
  TerminalBackground
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
  const sessionId = await getSessionId();
  characterInfoService = new CharacterInfoService();
  characterInfoService.initialize(configManager);
  operatorManager = new OperatorManager(sessionId, configManager, characterInfoService);
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
    await terminalBackground.initialize();

    sayCoeiroink = new SayCoeiroink(fallbackConfigManager);
    await sayCoeiroink.initialize();
    await sayCoeiroink.buildDynamicConfig();

    const fallbackSessionId = await getSessionId();
    characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(fallbackConfigManager);
    operatorManager = new OperatorManager(fallbackSessionId, fallbackConfigManager, characterInfoService);
    await operatorManager.initialize();

    dictionaryService = new DictionaryService();
    await dictionaryService.initialize();
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
registerOperatorAssignTool(server, sayCoeiroink, operatorManager, characterInfoService, terminalBackground, availableCharacters.available);
registerOperatorReleaseTool(server, operatorManager, terminalBackground);
registerOperatorStatusTool(server, operatorManager);
registerOperatorAvailableTool(server, operatorManager);
registerOperatorStylesTool(server, operatorManager, characterInfoService);

// Speech tools
registerSayTool(server, sayCoeiroink, operatorManager, characterInfoService, terminalBackground);
// registerParallelGenerationControlTool(server, sayCoeiroink);

// Playback tools
registerQueueStatusTool(server, sayCoeiroink);
registerQueueClearTool(server, sayCoeiroink);
registerPlaybackStopTool(server, sayCoeiroink);
registerWaitForTaskCompletionTool(server, sayCoeiroink);

// Dictionary tool
registerDictionaryRegisterTool(server, dictionaryService);

// Debug tool
registerDebugLogsTool(server);

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
