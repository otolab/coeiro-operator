#!/usr/bin/env node
/**
 * Echo Back Test MCP Server
 * MCPライブラリを使用した最小限のテスト用エコーバックサーバー
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// デバッグモードの判定
const isDebugMode = process.argv.includes('--debug') || process.argv.includes('-d');
let messageCount = 0;
const startTime = Date.now();

// デバッグログ出力
function debugLog(message: string, data?: unknown): void {
  if (isDebugMode) {
    console.error(`[ECHO-DEBUG] ${message}`, data ? JSON.stringify(data) : '');
  }
}

// MCPサーバーインスタンスの作成
const server = new McpServer(
  {
    name: 'echo-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

debugLog('Echo MCP Server instance created');

// echoツール
server.registerTool(
  'echo',
  {
    description: 'エコーバックテストツール',
    inputSchema: {
      message: z.string().describe('エコーするメッセージ'),
      delay: z.number().optional().describe('遅延時間（ミリ秒）'),
    },
  },
  async args => {
    const { message, delay = 0 } = args;
    messageCount++;

    debugLog('Echo tool called', { message, delay, messageCount });

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return {
      content: [
        {
          type: 'text',
          text: `🔄 Echo: ${message}\n📊 Message count: ${messageCount}\n⏰ Timestamp: ${new Date().toISOString()}`,
        },
      ],
    };
  }
);

// debug_infoツール
server.registerTool(
  'debug_info',
  {
    description: 'デバッグ情報取得ツール',
    inputSchema: {
      type: z.enum(['stats', 'status']).describe('取得する情報タイプ'),
    },
  },
  async args => {
    const { type } = args;

    debugLog('Debug info tool called', { type });

    switch (type) {
      case 'stats': {
        const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
        return {
          content: [
            {
              type: 'text',
              text:
                `📊 Server Statistics:\n\n` +
                `Messages processed: ${messageCount}\n` +
                `Debug mode: ${isDebugMode}\n` +
                `Uptime: ${uptime}s`,
            },
          ],
        };
      }

      case 'status': {
        const memUsage = process.memoryUsage();
        return {
          content: [
            {
              type: 'text',
              text:
                `🖥️ Server Status:\n\n` +
                `PID: ${process.pid}\n` +
                `Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n` +
                `Messages processed: ${messageCount}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Invalid debug info type: ${type}`);
    }
  }
);

// test_outputツール
server.registerTool(
  'test_output',
  {
    description: '出力チャネルテストツール',
    inputSchema: {
      channel: z.enum(['stdout', 'stderr', 'json']).describe('テストする出力チャネル'),
      message: z.string().describe('テストメッセージ'),
    },
  },
  async args => {
    const { channel, message } = args;

    debugLog('Test output tool called', { channel, message });

    // 指定されたチャネルにテストメッセージを出力
    // 注意: これらの出力はMCP通信を妨げる可能性があるため、テスト専用
    switch (channel) {
      case 'stdout':
        // MCPプロトコル外の標準出力（通常は避けるべき）
        console.log(`[TEST-STDOUT] ${message}`);
        break;
      case 'stderr':
        // 標準エラー出力（デバッグ用）
        console.error(`[TEST-STDERR] ${message}`);
        break;
      case 'json':
        // JSON形式のテストメッセージ（MCPプロトコル外）
        console.log(JSON.stringify({ test: 'output', message }));
        break;
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ Test message sent to ${channel} channel: "${message}"`,
        },
      ],
    };
  }
);

// server-info リソース（テキスト）
server.resource(
  'server-info',
  'echo://server/info',
  {
    description: 'サーバー情報リソース',
    mimeType: 'text/plain',
  },
  async (uri) => {
    debugLog('Resource read: server-info', { uri: uri.href });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/plain',
          text: `Echo MCP Server v1.0.0\nMessages processed: ${messageCount}\nUptime: ${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        },
      ],
    };
  }
);

// config リソース（JSON）
server.resource(
  'config',
  'echo://server/config',
  {
    description: 'サーバー設定リソース',
    mimeType: 'application/json',
  },
  async (uri) => {
    debugLog('Resource read: config', { uri: uri.href });
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            debugMode: isDebugMode,
            version: '1.0.0',
            serverName: 'echo-mcp-server',
          }),
        },
      ],
    };
  }
);

// サーバーの起動
async function main(): Promise<void> {
  debugLog('Starting Echo MCP Server...');

  try {
    // StdioServerTransportを作成して接続
    const transport = new StdioServerTransport();

    debugLog('Connecting transport...');
    await server.connect(transport);

    debugLog('Echo MCP Server started successfully');

    // エラー出力にのみサーバー起動メッセージを出力
    // （標準出力はMCP通信専用）
    console.error('Echo MCP Server is running');
  } catch (error) {
    console.error('Failed to start Echo MCP Server:', error);
    process.exit(1);
  }
}

// シグナルハンドラー
process.on('SIGTERM', () => {
  debugLog('Received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  debugLog('Received SIGINT, shutting down...');
  process.exit(0);
});

// 直接実行された場合のみサーバーを起動
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
