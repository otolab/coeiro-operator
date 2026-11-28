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
  minimum?: number;
  maximum?: number;
  pattern?: string;
  default?: unknown;
  anyOf?: Array<{
    type?: string;
    minimum?: number;
    maximum?: number;
    pattern?: string;
  }>;
};

type ListedTool = {
  name: string;
  inputSchema: {
    $schema?: string;
    type?: string;
    additionalProperties?: boolean;
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
    const rateBranches = tool?.inputSchema.properties?.rate.anyOf;

    expect(tool).toBeDefined();
    expect(tool?.inputSchema).toEqual({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        label: { type: 'string' },
        defaulted: { type: 'string', default: 'natural' },
        mode: { type: 'string', enum: ['absolute', 'relative'] },
        rate: {
          anyOf: [
            { type: 'number', minimum: 50, maximum: 400 },
            {
              type: 'string',
              pattern: /^x(?:0\.(?:[5-9]\d*)|1(?:\.\d+)?|2(?:\.0+)?)$/.source,
            },
          ],
        },
      },
      required: ['mode'],
      additionalProperties: false,
    });
    expect(tool?.inputSchema.properties?.mode.enum).toEqual(['absolute', 'relative']);
    expect(rateBranches).toHaveLength(2);
    expect(rateBranches?.[0]).toMatchObject({
      type: 'number',
      minimum: 50,
      maximum: 400,
    });
    expect(rateBranches?.[1]).toMatchObject({
      type: 'string',
      pattern: /^x(?:0\.(?:[5-9]\d*)|1(?:\.\d+)?|2(?:\.0+)?)$/.source,
    });
    expect(tool?.inputSchema.properties?.defaulted.default).toBe('natural');
    expect(tool?.inputSchema.required).toContain('mode');
    expect(tool?.inputSchema.required).not.toContain('rate');
    expect(tool?.inputSchema.required).not.toContain('label');
    expect(tool?.inputSchema.required).not.toContain('defaulted');
  });

  it.each([200, 'x1.25'])('tools/call accepts rate value %s', async rate => {
    const result = await tester.callTool<{ content: Array<{ text: string }> }>(
      'schema_compatibility',
      { mode: 'relative', rate }
    );

    expect(result.success).toBe(true);
    expect(JSON.parse(result.result?.content[0].text ?? '{}')).toMatchObject({
      mode: 'relative',
      rate,
      defaulted: 'natural',
    });
  });

  it.each([49, 401, 'x0.49', 'x2.01', '1.2x', true])(
    'tools/call rejects invalid rate value %s',
    async rate => {
      const result = await tester.callTool<{
        isError?: boolean;
        content?: Array<{ text: string }>;
      }>('schema_compatibility', {
        mode: 'relative',
        rate,
      });

      expect(result.success).toBe(true);
      expect(result.result?.isError).toBe(true);
      expect(result.result?.content?.[0]?.text).toContain('Input validation error');
    }
  );

  it('tools/call applies a default value when the field is omitted', async () => {
    const result = await tester.callTool<{ content: Array<{ text: string }> }>(
      'schema_compatibility',
      { mode: 'absolute' }
    );

    expect(result.success).toBe(true);
    expect(JSON.parse(result.result?.content[0].text ?? '{}')).toMatchObject({
      mode: 'absolute',
      defaulted: 'natural',
    });
  });
});
