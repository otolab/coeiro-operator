/**
 * registerTool の Zod schema が MCP wire protocol 上で保たれることを確認する。
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as path from 'path';
import { getDirname } from '@coeiro-operator/common';
import { createMCPTester, type MCPServiceE2ETester } from './e2e/index.js';

const __dirname = getDirname(import.meta.url);

type JsonSchemaProperty = {
  type?: string | string[];
  enum?: unknown[];
  anyOf?: Array<{ type?: string }>;
};

type ListedTool = {
  name: string;
  inputSchema: {
    type?: string;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
};

describe('registerTool Zod schema compatibility', () => {
  let tester: MCPServiceE2ETester;

  beforeAll(async () => {
    tester = await createMCPTester({
      serverPath: path.join(__dirname, '../dist/echo-server.js'),
    });
    await tester.waitUntilReady();
  }, 15000);

  afterAll(async () => {
    await tester?.cleanup();
  });

  it('tools/list preserves optional, enum, and property union schemas', async () => {
    const response = await tester.sendRequest<{ tools: ListedTool[] }>('tools/list');
    const tool = response.tools.find(candidate => candidate.name === 'schema_compatibility');

    expect(tool).toBeDefined();
    expect(tool?.inputSchema.type).toBe('object');
    expect(tool?.inputSchema.properties?.mode.enum).toEqual(['absolute', 'relative']);
    expect(tool?.inputSchema.properties?.speed.type).toEqual(['number', 'string']);
    expect(tool?.inputSchema.required).toContain('mode');
    expect(tool?.inputSchema.required).toContain('speed');
    expect(tool?.inputSchema.required).not.toContain('label');
  });

  it.each([200, '1.25x'])('tools/call accepts speed value %s', async speed => {
    const result = await tester.callTool<{ content: Array<{ text: string }> }>(
      'schema_compatibility',
      { mode: 'relative', speed }
    );

    expect(result.success).toBe(true);
    expect(JSON.parse(result.result?.content[0].text ?? '{}')).toMatchObject({
      mode: 'relative',
      speed,
    });
  });

  it('tools/call rejects values outside the union', async () => {
    const result = await tester.callTool<{
      isError?: boolean;
      content?: Array<{ text: string }>;
    }>('schema_compatibility', {
      mode: 'relative',
      speed: true,
    });

    expect(result.success).toBe(true);
    expect(result.result?.isError).toBe(true);
    expect(result.result?.content?.[0]?.text).toContain('Input validation error');
  });
});
