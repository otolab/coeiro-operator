import { createInterface } from 'node:readline';

const mode = process.env.MCP_DEBUG_TOOLS_LIST_MODE ?? 'pages';
const input = createInterface({ input: process.stdin });

for await (const line of input) {
  const request = JSON.parse(line);
  let response;

  if (request.method === 'initialize') {
    response = {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: true,
          },
        },
        serverInfo: {
          name: 'tools-list-test-server',
          version: '1.0.0',
        },
      },
    };
  } else if (request.method === 'tools/list') {
    if (mode === 'error') {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: 'tools/list unavailable',
        },
      };
    } else if (mode === 'empty') {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: [] },
      };
    } else if (mode === 'repeated-cursor' || request.params?.cursor === 'repeated-cursor') {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: [],
          nextCursor: 'repeated-cursor',
        },
      };
    } else if (request.params?.cursor === 'page-2') {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: [
            {
              name: 'echo',
              description: 'Echo a message',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
      };
    } else {
      response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: [
            {
              name: 'say',
              description: 'Speak text',
              inputSchema: {
                type: 'object',
                properties: { speechText: { type: 'string' } },
                required: ['speechText'],
              },
            },
          ],
          nextCursor: 'page-2',
        },
      };
    }
  }

  if (response) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
