import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z, type ZodRawShape } from 'zod';

type SchemaArgs<Shape extends ZodRawShape> = z.infer<z.ZodObject<Shape>>;
type SchemaCallback<Shape extends ZodRawShape> = (
  args: SchemaArgs<Shape>
) => CallToolResult | Promise<CallToolResult>;
type Zod3ShapeRegisterTool = <Shape extends ZodRawShape>(
  name: string,
  config: { description?: string; inputSchema: Shape },
  callback: SchemaCallback<Shape>
) => RegisteredTool;

/**
 * SDK 1.32.x の registerTool は Zod v3/v4 の両 schema を同じ型引数で扱う。
 * Zod v3 を使うこの package では、入力を raw shape に限定して型推論を安定させる。
 * 実行時は SDK の registerTool をそのまま呼び、SDK による入力検証を維持する。
 */
export function registerToolWithZod3Shape<Shape extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: { description?: string; inputSchema: Shape },
  callback: SchemaCallback<Shape>
): RegisteredTool {
  const registerTool = server.registerTool.bind(server) as Zod3ShapeRegisterTool;
  return registerTool(name, config, callback);
}
