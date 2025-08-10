#!/usr/bin/env node
/**
 * Echo Back Test MCP Server
 * テスト用エコーバックMCPサーバー
 * 
 * 以下の機能を提供：
 * 1. MCPツールコール処理（JSON-RPC）
 * 2. 基本的なエコーバック機能
 * 3. ログ蓄積テスト
 * 
 * 制御コマンド（CTRL:xxx）はmcp-debugが処理するため、このサーバーには届きません。
 */

import { createInterface } from 'readline';
import { DebugLogManager, LoggerPresets } from '../logger/index.js';

interface JsonRpcRequest {
  jsonrpc: string;
  method: string;
  params?: any;
  id: number | string;
}

interface JsonRpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: number | string;
}

class EchoBackMcpServer {
  private logManager: DebugLogManager;
  private isDebugMode: boolean;
  private messageCount: number = 0;

  constructor() {
    this.isDebugMode = process.argv.includes('--debug') || process.argv.includes('-d');
    
    // ログシステムの初期化
    this.logManager = DebugLogManager.getInstance();
    this.setupLogging();

    const logger = this.logManager.getLogger('echo-server');
    logger.info('Echo Back MCP Server initialized', { 
      debugMode: this.isDebugMode,
      pid: process.pid
    });
  }

  private setupLogging(): void {
    if (this.isDebugMode) {
      LoggerPresets.debug();
      console.error('ECHO DEBUG MODE: Enhanced logging enabled');
    } else {
      LoggerPresets.mcpServerWithAccumulation();
    }
  }

  async start(): Promise<void> {
    const logger = this.logManager.getLogger('echo-server');
    
    try {
      // 標準入力からの入力処理
      this.setupInputProcessing();
      
      logger.info('Echo Back MCP Server started successfully');
      
      // 初期化完了メッセージを標準出力に出力
      console.log('Echo MCP Server ready');
      
    } catch (error) {
      logger.error('Failed to start echo server', error);
      throw error;
    }
  }

  private setupInputProcessing(): void {
    const logger = this.logManager.getLogger('echo-server');
    
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', async (input: string) => {
      try {
        const trimmedInput = input.trim();
        this.messageCount++;
        
        if (trimmedInput === '') {
          return;
        }

        logger.debug('Received input', { 
          input: trimmedInput.substring(0, 100),
          messageCount: this.messageCount
        });

        if (this.isJsonRpc(trimmedInput)) {
          // JSON-RPCメッセージの処理
          await this.handleJsonRpc(trimmedInput);
        } else {
          // その他の入力（エコーバック）
          await this.handleEcho(trimmedInput);
        }
        
      } catch (error) {
        logger.error('Error processing input', { input, error });
        console.error(`Input processing error: ${(error as Error).message}`);
      }
    });

    rl.on('close', () => {
      logger.info('Input stream closed, shutting down');
      this.shutdown();
    });
  }

  private isJsonRpc(input: string): boolean {
    try {
      const parsed = JSON.parse(input);
      return parsed.jsonrpc === '2.0' && 
             typeof parsed.method === 'string' &&
             parsed.id !== undefined;
    } catch {
      return false;
    }
  }


  private async handleJsonRpc(input: string): Promise<void> {
    const logger = this.logManager.getLogger('mcp');
    
    try {
      const request: JsonRpcRequest = JSON.parse(input);
      logger.info('Processing JSON-RPC request', { 
        method: request.method,
        id: request.id 
      });

      let response: JsonRpcResponse;

      switch (request.method) {
        case 'initialize':
          response = this.handleInitialize(request);
          break;
        case 'initialized':
          response = this.handleInitialized(request);
          break;
        case 'tools/list':
          response = this.handleToolsList(request);
          break;
        case 'tools/call':
          response = await this.handleToolsCall(request);
          break;
        default:
          response = {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            },
            id: request.id
          };
      }

      const responseJson = JSON.stringify(response);
      console.log(responseJson);
      
      if (this.isDebugMode) {
        console.error(`DEBUG:MCP: ${request.method} -> ${response.error ? 'error' : 'ok'}`);
      }
      
    } catch (error) {
      logger.error('JSON-RPC processing failed', { input, error });
      
      const errorResponse: JsonRpcResponse = {
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error'
        },
        id: 'unknown'
      };
      
      console.log(JSON.stringify(errorResponse));
    }
  }

  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'echo-back-mcp-server',
          version: '1.0.0'
        }
      },
      id: request.id
    };
  }

  private handleInitialized(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      result: {},
      id: request.id
    };
  }

  private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      result: {
        tools: [
          {
            name: 'echo',
            description: 'エコーバックテストツール',
            inputSchema: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  description: 'エコーするメッセージ'
                },
                delay: {
                  type: 'number',
                  description: '遅延時間（ミリ秒）',
                  default: 0
                }
              },
              required: ['message']
            }
          },
          {
            name: 'debug_info',
            description: 'デバッグ情報取得ツール',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['logs', 'stats', 'status'],
                  description: '取得する情報タイプ'
                }
              },
              required: ['type']
            }
          },
          {
            name: 'test_output',
            description: '出力チャネルテストツール',
            inputSchema: {
              type: 'object',
              properties: {
                channel: {
                  type: 'string',
                  enum: ['mcp', 'control', 'debug', 'error'],
                  description: 'テストする出力チャネル'
                },
                message: {
                  type: 'string',
                  description: 'テストメッセージ'
                }
              },
              required: ['channel', 'message']
            }
          }
        ]
      },
      id: request.id
    };
  }

  private async handleToolsCall(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { name, arguments: args } = request.params || {};
    const logger = this.logManager.getLogger('tools');

    try {
      logger.info('Tool call', { name, args });
      return await this.executeToolInternal(request, name, args);

    } catch (error) {
      logger.error('Tool call failed', { name, args, error });
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: `Tool execution failed: ${(error as Error).message}`
        },
        id: request.id
      };
    }
  }

  private async executeToolInternal(request: JsonRpcRequest, name: string, args: any): Promise<JsonRpcResponse> {
    switch (name) {
      case 'echo':
        return await this.handleEchoTool(request, args);
      case 'debug_info':
        return await this.handleDebugInfoTool(request, args);
      case 'test_output':
        return await this.handleTestOutputTool(request, args);
      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: `Unknown tool: ${name}`
          },
          id: request.id
        };
    }
  }

  private async handleEchoTool(request: JsonRpcRequest, args: any): Promise<JsonRpcResponse> {
    const { message, delay = 0 } = args || {};
    
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      jsonrpc: '2.0',
      result: {
        content: [{
          type: 'text',
          text: `🔄 Echo: ${message}\n📊 Message count: ${this.messageCount}\n⏰ Timestamp: ${new Date().toISOString()}`
        }]
      },
      id: request.id
    };
  }

  private async handleDebugInfoTool(request: JsonRpcRequest, args: any): Promise<JsonRpcResponse> {
    const { type } = args || {};
    const accumulator = this.logManager.getAccumulator();

    switch (type) {
      case 'logs': {
        const entries = accumulator.getEntries({ limit: 10 });
        return {
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: `📋 Recent logs (${entries.length}):\n\n` +
                    entries.map((entry, i) => 
                      `${i + 1}. [${entry.level.toUpperCase()}] ${entry.timestamp}\n   ${entry.message}`
                    ).join('\n\n')
            }]
          },
          id: request.id
        };
      }

      case 'stats': {
        const stats = accumulator.getStats();
        return {
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: `📊 Server Statistics:\n\n` +
                    `Messages processed: ${this.messageCount}\n` +
                    `Log entries: ${stats.totalEntries}\n` +
                    `Debug mode: ${this.isDebugMode}\n` +
                    `Uptime: ${process.uptime().toFixed(1)}s`
            }]
          },
          id: request.id
        };
      }

      case 'status': {
        const memUsage = process.memoryUsage();
        return {
          jsonrpc: '2.0',
          result: {
            content: [{
              type: 'text',
              text: `🖥️ Server Status:\n\n` +
                    `PID: ${process.pid}\n` +
                    `Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n` +
                    `Messages processed: ${this.messageCount}`
            }]
          },
          id: request.id
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Invalid debug info type: ${type}`
          },
          id: request.id
        };
    }
  }

  private async handleTestOutputTool(request: JsonRpcRequest, args: any): Promise<JsonRpcResponse> {
    const { channel, message } = args || {};

    // 指定されたチャネルにテストメッセージを出力
    switch (channel) {
      case 'mcp':
        console.log(`{"test":"mcp","message":"${message}"}`);
        break;
      case 'control':
        console.log(`CTRL_RESPONSE:test:ok:{"message":"${message}"}`);
        break;
      case 'debug':
        console.error(`DEBUG: Test debug: ${message}`);
        break;
      case 'error':
        console.error(`ERROR: Test error: ${message}`);
        break;
    }

    return {
      jsonrpc: '2.0',
      result: {
        content: [{
          type: 'text',
          text: `✅ Test message sent to ${channel} channel: "${message}"`
        }]
      },
      id: request.id
    };
  }

  private async handleEcho(input: string): Promise<void> {
    const logger = this.logManager.getLogger('echo');
    
    logger.info('Echo input', { input });
    
    // 非JSON入力は標準出力にエコー
    console.log(`Echo: ${input} (count: ${this.messageCount})`);
  }

  private shutdown(): void {
    const logger = this.logManager.getLogger('echo-server');
    logger.info('Shutting down Echo Back MCP Server...');

    try {
      logger.info('Echo Back MCP Server shutdown completed');
    } catch (error) {
      console.error('Error during shutdown:', error);
    }

    process.exit(0);
  }
}

// サーバーの起動
async function main() {
  try {
    const server = new EchoBackMcpServer();
    await server.start();
    
  } catch (error) {
    console.error('Failed to start Echo Back MCP Server:', error);
    process.exit(1);
  }
}

// 直接実行された場合のみサーバーを起動
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}

export { EchoBackMcpServer };