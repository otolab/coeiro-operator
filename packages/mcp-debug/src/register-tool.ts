import {
  McpServer,
  type CallToolResult,
  type RegisteredTool,
  type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import { z, type ZodRawShape } from 'zod';

type SchemaArgs<Shape extends ZodRawShape> = z.output<z.ZodObject<Shape>>;
type SchemaCallback<Shape extends ZodRawShape> = (
  args: SchemaArgs<Shape>
) => CallToolResult | Promise<CallToolResult>;

/**
 * Zod 4 で入力を検証しつつ、v1 SDK と同じ draft-07 schema を tools/list に公開する。
 */
export function registerToolWithZodShape<Shape extends ZodRawShape>(
  server: McpServer,
  name: string,
  config: { description?: string; inputSchema: Shape },
  callback: SchemaCallback<Shape>
): RegisteredTool {
  const inputSchema = z.object(config.inputSchema);
  const standardSchema = inputSchema['~standard'];
  const inputSchemaWithLegacyJsonSchema = {
    '~standard': {
      ...standardSchema,
      jsonSchema: {
        input: () => ({
          ...z.toJSONSchema(inputSchema, { target: 'draft-7', io: 'input' }),
          additionalProperties: false,
        }),
        output: () => ({
          ...z.toJSONSchema(inputSchema, { target: 'draft-7', io: 'output' }),
          additionalProperties: false,
        }),
      },
    },
  } as StandardSchemaWithJSON<z.input<typeof inputSchema>, z.output<typeof inputSchema>>;

  return server.registerTool(
    name,
    {
      description: config.description,
      inputSchema: inputSchemaWithLegacyJsonSchema,
    },
    callback
  );
}
