import { INVALID_PARAMS, type JSONRPCMessage, type Transport } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { LegacyToolResponseTransport } from './legacy-tool-response-transport.js';

type RequestId = number | string;

function createHarness() {
  const sent: JSONRPCMessage[] = [];
  const underlying = {
    onmessage: undefined as Transport['onmessage'],
    onclose: undefined as Transport['onclose'],
    onerror: undefined as Transport['onerror'],
    start: async () => {},
    send: async (message: JSONRPCMessage) => {
      sent.push(message);
    },
    close: async () => {},
  } as unknown as Transport;
  const transport = new LegacyToolResponseTransport(underlying);
  transport.onmessage = () => {};

  return {
    transport,
    sent,
    receiveRequest(id: RequestId, toolName: string) {
      underlying.onmessage?.({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: toolName, arguments: {} },
      });
    },
  };
}

function unknownToolError(id: RequestId, toolName: string): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: INVALID_PARAMS,
      message: `Tool ${toolName} not found`,
    },
  };
}

function legacyToolResult(id: RequestId, toolName: string): JSONRPCMessage {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: `MCP error ${INVALID_PARAMS}: Tool ${toolName} not found`,
        },
      ],
      isError: true,
    },
  };
}

describe('LegacyToolResponseTransport', () => {
  it('correlates concurrent unknown-tool errors by request ID, including out-of-order replies', async () => {
    const harness = createHarness();
    harness.receiveRequest(1, 'first_tool');
    harness.receiveRequest('2', 'second_tool');

    await harness.transport.send(unknownToolError('2', 'second_tool'));
    await harness.transport.send(unknownToolError(1, 'first_tool'));

    expect(harness.sent).toEqual([
      legacyToolResult('2', 'second_tool'),
      legacyToolResult(1, 'first_tool'),
    ]);
  });

  it.each([
    {
      name: 'a mismatched tool name',
      responseId: 1,
      code: INVALID_PARAMS,
      message: 'Tool another_tool not found',
    },
    {
      name: 'a different protocol error code',
      responseId: 1,
      code: -32600,
      message: 'Tool requested_tool not found',
    },
    {
      name: 'an untracked request ID',
      responseId: 'untracked',
      code: INVALID_PARAMS,
      message: 'Tool requested_tool not found',
    },
    {
      name: 'a disabled tool error',
      responseId: 1,
      code: INVALID_PARAMS,
      message: 'Tool requested_tool disabled',
    },
  ])(
    'passes through JSON-RPC errors with $name unchanged',
    async ({ responseId, code, message }) => {
      const harness = createHarness();
      harness.receiveRequest(1, 'requested_tool');
      const response: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: responseId,
        error: { code, message },
      };

      await harness.transport.send(response);

      expect(harness.sent).toEqual([response]);
    }
  );
});
