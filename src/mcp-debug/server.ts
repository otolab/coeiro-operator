#!/usr/bin/env node
/**
 * Enhanced MCP Server with Debug Controls
 * デバッグ機能付き拡張MCPサーバー
 */

import { createInterface } from 'readline';
import { ControlHandler } from './control/handler';
import { OutputManager } from './output/manager';
import { DebugLogManager, LoggerPresets } from './logger';

// MCPサーバーのダミー実装（後で完全実装に置き換え）
interface DummyMcpServer {
  registerTool(name: string, config: any, handler: (args: any) => any): void;
  connect(transport: any): Promise<void>;
}

class DummyMcp implements DummyMcpServer {
  registerTool(name: string, config: any, handler: (args: any) => any): void {
    console.log(`Tool registered: ${name}`);
  }
  
  async connect(transport: any): Promise<void> {
    console.log('MCP server connected');
  }
}

class EnhancedMcpServer {
  private mcpServer: DummyMcpServer;
  private controlHandler: ControlHandler;
  private outputManager: OutputManager;
  private logManager: DebugLogManager;
  private isDebugMode: boolean;
  private isShuttingDown: boolean = false;

  constructor() {
    this.isDebugMode = process.argv.includes('--debug') || process.argv.includes('-d');
    
    // ログシステムの初期化
    this.logManager = DebugLogManager.getInstance();
    this.setupLogging();

    // 制御ハンドラーの初期化
    this.controlHandler = new ControlHandler();

    // 出力管理の初期化
    this.outputManager = new OutputManager({
      enableDebugOutput: this.isDebugMode,
      enableMcpOutput: true,
      enableControlOutput: true
    });

    // MCPサーバーの初期化（ダミー実装）
    this.mcpServer = new DummyMcp();

    this.setupSignalHandlers();
    this.setupMcpServer();
    
    const logger = this.logManager.getLogger('server');
    logger.info('Enhanced MCP Server initialized', { 
      debugMode: this.isDebugMode,
      pid: process.pid 
    });
  }

  private setupLogging(): void {
    if (this.isDebugMode) {
      LoggerPresets.debug();
      console.error('DEBUG MODE: Enhanced logging enabled (--debug flag detected)');
    } else {
      LoggerPresets.mcpServerWithAccumulation();
    }
  }

  private setupSignalHandlers(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      const logger = this.logManager.getLogger('server');
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await this.shutdown();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // 未処理のエラーをキャッチ
    process.on('uncaughtException', (error) => {
      const logger = this.logManager.getLogger('server');
      logger.error('Uncaught exception', error);
      if (!this.isDebugMode) {
        process.exit(1);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      const logger = this.logManager.getLogger('server');
      logger.error('Unhandled rejection', { reason, promise });
      if (!this.isDebugMode) {
        process.exit(1);
      }
    });
  }

  private setupMcpServer(): void {
    // TODO: 既存のMCPツール登録をここに移植
    // 現在は基本的なツールのみ登録
    this.registerBasicTools();
  }

  private registerBasicTools(): void {
    const logger = this.logManager.getLogger('mcp');

    // デバッグログツール
    this.mcpServer.registerTool('debug_logs', {
      description: 'デバッグ用ログの取得と表示',
      inputSchema: {
        action: { 
          type: 'string', 
          enum: ['get', 'stats', 'clear'],
          description: '実行するアクション' 
        },
        level: { 
          type: 'array', 
          items: { 
            type: 'string', 
            enum: ['error', 'warn', 'info', 'verbose', 'debug'] 
          },
          description: '取得するログレベル' 
        },
        limit: { 
          type: 'number', 
          minimum: 1, 
          maximum: 1000,
          description: '取得する最大ログエントリ数' 
        }
      }
    }, async (args) => {
      logger.info('Debug logs tool called', args);
      
      try {
        const { action = 'get', level, limit } = args || {};
        const accumulator = this.logManager.getAccumulator();

        switch (action) {
          case 'get': {
            const entries = accumulator.getEntries({
              level: level as any,
              limit: limit as number
            });

            return {
              content: [{
                type: 'text',
                text: `ログエントリ (${entries.length}件):\n\n` +
                      entries.map((entry, i) => 
                        `${i + 1}. [${entry.level.toUpperCase()}] ${entry.timestamp}\n   ${entry.message}`
                      ).join('\n\n')
              }]
            };
          }

          case 'stats': {
            const stats = accumulator.getStats();
            return {
              content: [{
                type: 'text',
                text: `📊 ログ統計情報\n\n` +
                      `総エントリ数: ${stats.totalEntries}\n\n` +
                      `レベル別エントリ数:\n` +
                      Object.entries(stats.entriesByLevel)
                        .map(([level, count]) => `  ${level.toUpperCase()}: ${count}`)
                        .join('\n') +
                      `\n\n時刻範囲:\n` +
                      `  最古: ${stats.oldestEntry || 'なし'}\n` +
                      `  最新: ${stats.newestEntry || 'なし'}`
              }]
            };
          }

          case 'clear': {
            const beforeCount = accumulator.getStats().totalEntries;
            accumulator.clearEntries();
            return {
              content: [{
                type: 'text',
                text: `ログエントリをクリアしました（${beforeCount}件削除）`
              }]
            };
          }

          default:
            throw new Error(`無効なアクション: ${action}`);
        }
      } catch (error) {
        throw new Error(`ログ取得エラー: ${(error as Error).message}`);
      }
    });

    // サーバーステータスツール
    this.mcpServer.registerTool('server_status', {
      description: 'サーバーの状態情報を取得',
      inputSchema: {}
    }, async () => {
      logger.info('Server status tool called');
      
      try {
        const status = await this.controlHandler.getStatus();
        const stats = this.outputManager.getStats();
        
        return {
          content: [{
            type: 'text',
            text: `🖥️ サーバー状態\n\n` +
                  `モード: ${status.mode}\n` +
                  `稼働時間: ${Math.floor(status.uptime / 1000 / 60)} 分\n` +
                  `プロセスID: ${status.processId}\n` +
                  `総リクエスト数: ${status.mcpStats.totalRequests}\n` +
                  `エラー数: ${status.mcpStats.errorCount}\n` +
                  `ログエントリ数: ${status.logStats.totalEntries}\n` +
                  `出力統計: ${stats.totalMessages} メッセージ`
          }]
        };
      } catch (error) {
        throw new Error(`ステータス取得エラー: ${(error as Error).message}`);
      }
    });
  }

  async start(): Promise<void> {
    const logger = this.logManager.getLogger('server');
    
    try {
      // ダミーMCPサーバーを開始
      await this.mcpServer.connect(null);
      
      // 制御コマンド処理のためのreadlineインターフェース
      this.setupControlInterface();
      
      logger.info('Enhanced MCP Server started successfully');
      
    } catch (error) {
      logger.error('Failed to start server', error);
      throw error;
    }
  }

  private setupControlInterface(): void {
    const logger = this.logManager.getLogger('control');
    
    // 標準入力からの制御コマンド処理
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', async (input: string) => {
      try {
        const trimmedInput = input.trim();
        
        if (trimmedInput.startsWith('CTRL:')) {
          // 制御コマンドの処理
          logger.debug('Processing control command', { input: trimmedInput });
          
          const response = await this.controlHandler.handleInput(trimmedInput);
          const formattedResponse = this.controlHandler.formatResponse(response);
          
          this.outputManager.writeControlResponse(formattedResponse);
          
          // デバッグモードでは詳細ログも出力
          if (this.isDebugMode) {
            this.outputManager.writeDebug(
              `Control: ${response.command} -> ${response.status}`,
              'control'
            );
          }
        } else {
          // 通常のMCPメッセージとして処理
          // 注: 実際の実装では StdioTransport が処理するため、ここでは特別な処理は不要
          logger.debug('Non-control input received', { input: trimmedInput.substring(0, 100) });
        }
      } catch (error) {
        logger.error('Error processing input', error);
        this.outputManager.writeError(
          `Input processing error: ${(error as Error).message}`
        );
      }
    });

    rl.on('close', () => {
      logger.info('Input stream closed, shutting down');
      if (!this.isShuttingDown) {
        this.shutdown();
      }
    });
  }

  async shutdown(): Promise<void> {
    const logger = this.logManager.getLogger('server');
    logger.info('Shutting down Enhanced MCP Server...');

    try {
      // 出力管理のシャットダウン
      this.outputManager.flush();
      this.outputManager.shutdown();

      // ログマネージャーのシャットダウン
      await this.logManager.shutdown();

      logger.info('Enhanced MCP Server shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }

  // デバッグ用ヘルパー
  _getInternalComponents() {
    return {
      mcpServer: this.mcpServer,
      controlHandler: this.controlHandler,
      outputManager: this.outputManager,
      logManager: this.logManager
    };
  }
}

// サーバーの起動
async function main() {
  try {
    const server = new EnhancedMcpServer();
    await server.start();
    
    // graceful shutdown のための待機
    process.on('exit', () => {
      console.error('Enhanced MCP Server process exiting');
    });
    
  } catch (error) {
    console.error('Failed to start Enhanced MCP Server:', error);
    process.exit(1);
  }
}

// 直接実行された場合のみサーバーを起動
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { EnhancedMcpServer };