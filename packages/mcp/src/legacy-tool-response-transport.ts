import {
  INVALID_PARAMS,
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  type JSONRPCMessage,
  type MessageExtraInfo,
  type RequestId,
  type Transport,
  type TransportSendOptions,
} from '@modelcontextprotocol/server';

/**
 * SDK v2 reports unknown tools as JSON-RPC errors. The v1 server exposed them
 * as error CallToolResults, so translate only the SDK's exact not-found error
 * at the transport boundary.
 */
export class LegacyToolResponseTransport implements Transport {
  private readonly pendingToolCalls = new Map<RequestId, string>();

  constructor(private readonly transport: Transport) {}

  get hasPerRequestStream(): boolean | undefined {
    return this.transport.hasPerRequestStream;
  }

  get onclose(): (() => void) | undefined {
    return this.transport.onclose;
  }

  set onclose(handler: (() => void) | undefined) {
    this.transport.onclose = handler;
  }

  get onerror(): ((error: Error) => void) | undefined {
    return this.transport.onerror;
  }

  set onerror(handler: ((error: Error) => void) | undefined) {
    this.transport.onerror = handler;
  }

  get onmessage(): Transport['onmessage'] {
    return this.transport.onmessage;
  }

  set onmessage(handler: Transport['onmessage']) {
    if (!handler) {
      this.transport.onmessage = undefined;
      return;
    }

    this.transport.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo) => {
      if (isJSONRPCRequest(message) && message.method === 'tools/call') {
        const toolName = (message.params as { name?: unknown } | undefined)?.name;
        if (typeof toolName === 'string') {
          this.pendingToolCalls.set(message.id, toolName);
        }
      }
      handler(message, extra);
    };
  }

  get sessionId(): string | undefined {
    return this.transport.sessionId;
  }

  set sessionId(sessionId: string | undefined) {
    this.transport.sessionId = sessionId;
  }

  get setProtocolVersion(): Transport['setProtocolVersion'] {
    return this.transport.setProtocolVersion;
  }

  set setProtocolVersion(handler: Transport['setProtocolVersion']) {
    this.transport.setProtocolVersion = handler;
  }

  get setSupportedProtocolVersions(): Transport['setSupportedProtocolVersions'] {
    return this.transport.setSupportedProtocolVersions;
  }

  set setSupportedProtocolVersions(handler: Transport['setSupportedProtocolVersions']) {
    this.transport.setSupportedProtocolVersions = handler;
  }

  start(): Promise<void> {
    return this.transport.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    if (isJSONRPCErrorResponse(message)) {
      const responseId = message.id;
      const toolName = responseId === undefined ? undefined : this.pendingToolCalls.get(responseId);
      const isUnknownToolError =
        responseId !== undefined &&
        toolName !== undefined &&
        message.error.code === INVALID_PARAMS &&
        message.error.message === `Tool ${toolName} not found`;

      if (isUnknownToolError) {
        this.pendingToolCalls.delete(responseId);
        const result: JSONRPCMessage = {
          jsonrpc: '2.0',
          id: responseId,
          result: {
            content: [
              {
                type: 'text',
                text: `MCP error ${message.error.code}: ${message.error.message}`,
              },
            ],
            isError: true,
          },
        };
        await this.transport.send(result, options);
        return;
      }
    }

    if ('id' in message && message.id !== undefined && !('method' in message)) {
      this.pendingToolCalls.delete(message.id);
    }
    await this.transport.send(message, options);
  }

  async close(): Promise<void> {
    this.pendingToolCalls.clear();
    await this.transport.close();
  }
}
