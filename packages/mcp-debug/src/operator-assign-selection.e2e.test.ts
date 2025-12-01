/**
 * operator_assign選択式パラメータのE2Eテスト
 * Issue #201: オペレータアサインを選択式に変更
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createMCPTester, MCPServiceE2ETester } from './index.js';
import * as path from 'path';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);

describe('operator_assign選択式パラメータ', () => {
  let tester: MCPServiceE2ETester;

  beforeAll(async () => {
    // MCPサーバーのパスを設定
    const serverPath = path.join(__dirname, '../../mcp/dist/server.js');

    tester = await createMCPTester({
      serverPath,
      timeout: 30000,
    });

    // サーバーが準備完了するまで待機
    await tester.waitUntilReady(10000);
  }, 40000);

  afterAll(async () => {
    await tester.cleanup();
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
    expect(inputSchema.properties.operator).toBeDefined();

    // operatorパラメータがenum型であることを確認
    const operatorParam = inputSchema.properties.operator;
    expect(operatorParam.enum).toBeDefined();
    expect(Array.isArray(operatorParam.enum)).toBe(true);

    // 'AUTO'が先頭にあることを確認
    expect(operatorParam.enum[0]).toBe('AUTO');

    // 少なくとも1つのキャラクターが含まれていることを確認（AUTO + キャラクター）
    expect(operatorParam.enum.length).toBeGreaterThan(1);

    console.log('利用可能なオプション:', operatorParam.enum);
  });

  it('AUTOを指定してオペレータをアサインできること', async () => {
    const result = await tester.callTool('operator_assign', {
      operator: 'AUTO',
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
});
