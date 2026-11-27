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
 * Zod v3 raw shape に型を限定して SDK の registerTool を呼び出す。
 * 型推論を安定させつつ、実行時の schema 検証は SDK に委ねる。
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
