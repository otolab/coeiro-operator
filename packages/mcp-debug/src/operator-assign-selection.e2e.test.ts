/**
 * operator_assign選択式パラメータのE2Eテスト
 * Issue #201: オペレータアサインを選択式に変更
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMCPTester, MCPServiceE2ETester } from './index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'path';
import { getDirname } from '@coeiro-operator/common';
import { MCPDebugClient } from './core/mcp-debug-client.js';

const __dirname = getDirname(import.meta.url);
let isolatedHome: string;

describe('operator_assign選択式パラメータ', () => {
  let tester: MCPServiceE2ETester;

  beforeAll(async () => {
    isolatedHome = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-e2e-'));
    // MCPサーバーのパスを設定
    const serverPath = path.join(__dirname, '../../mcp/dist/server.js');

    tester = await createMCPTester({
      serverPath,
      timeout: 30000,
      env: {
        HOME: isolatedHome,
        USERPROFILE: isolatedHome,
      },
    });

    // サーバーが準備完了するまで待機
    await tester.waitUntilReady(10000);
  }, 40000);

  afterAll(async () => {
    await tester?.cleanup();
    if (isolatedHome) {
      await rm(isolatedHome, { recursive: true, force: true });
    }
  });

  it('operator_assignツールが選択式リストを持っていること', async () => {
    const tools = await tester.sendRequest('tools/list');

    // operator_assignツールを探す
    const operatorAssignTool = (tools as any).tools.find(
      (tool: any) => tool.name === 'operator_assign'
    );

    expect(operatorAssignTool).toBeDefined();
    expect(operatorAssignTool.name).toBe('operator_assign');

    // inputSchemaを確認
    const inputSchema = operatorAssignTool.inputSchema;
    expect(inputSchema).toBeDefined();
    expect(inputSchema.properties).toBeDefined();
    expect(inputSchema.properties.characterId).toBeDefined();

    // characterIdパラメータがenum型であることを確認
    const characterIdParam = inputSchema.properties.characterId;
    expect(characterIdParam.enum).toBeDefined();
    expect(Array.isArray(characterIdParam.enum)).toBe(true);

    // 'AUTO'が先頭にあることを確認
    expect(characterIdParam.enum[0]).toBe('AUTO');

    // 少なくともAUTOが含まれていることを確認（CI環境ではCOEIROINKサーバーが起動していないため、AUTOのみの場合もある）
    expect(characterIdParam.enum.length).toBeGreaterThanOrEqual(1);

    console.log('利用可能なオプション:', characterIdParam.enum);
  });

  it('MCP taskSupport を広告せず、音声キュー待機を通常の tool call で使えること', async () => {
    const response = await tester.sendRequest<{
      tools: Array<{ name: string; execution?: unknown }>;
    }>('tools/list');

    expect(response.tools.length).toBeGreaterThan(0);
    expect(response.tools.every(tool => !Object.hasOwn(tool, 'execution'))).toBe(true);
    expect(response.tools.some(tool => tool.name === 'wait_for_task_completion')).toBe(true);

    const waitResult = await tester.callTool('wait_for_task_completion', { timeout: 1000 });
    expect(waitResult.success).toBe(true);
  });

  it('AUTOを指定してオペレータをアサインできること', async () => {
    const result = await tester.callTool('operator_assign', {
      characterId: 'AUTO',
    });

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });

  it('省略時もオペレータをアサインできること（デフォルト動作）', async () => {
    // 一度リリース
    await tester.callTool('operator_release', {});

    // 省略してアサイン
    const result = await tester.callTool('operator_assign', {});

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
  });

  it('未登録 tool の応答が従来の tool result 形式であること', async () => {
    const result = await tester.callTool<{
      isError?: boolean;
      content?: Array<{ type: string; text: string }>;
    }>('legacy_unknown_tool', {});

    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      content: [
        {
          type: 'text',
          text: 'MCP error -32602: Tool legacy_unknown_tool not found',
        },
      ],
      isError: true,
    });
  });

  it('MCPDebugClient.callTool でも未登録 tool を tool result として返すこと', async () => {
    const client = new MCPDebugClient({
      serverPath: path.join(__dirname, '../../mcp/dist/server.js'),
      timeout: 30000,
      env: {
        HOME: isolatedHome,
        USERPROFILE: isolatedHome,
      },
    });

    try {
      await client.start();
      await expect(client.callTool('legacy_unknown_tool', {})).resolves.toEqual({
        content: [
          {
            type: 'text',
            text: 'MCP error -32602: Tool legacy_unknown_tool not found',
          },
        ],
        isError: true,
      });
    } finally {
      await client.cleanup();
    }
  });
});
