/**
 * MCP Protocol Type Definitions
 * MCPプロトコルの標準型定義
 */

/**
 * MCPツールの定義
 */
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

/**
 * tools/listレスポンス
 */
export interface MCPToolsListResponse {
  tools: MCPTool[];
}

/**
 * MCPコンテンツのベース型
 */
export interface MCPContentBase {
  type: string;
}

/**
 * テキストコンテンツ
 */
export interface MCPTextContent extends MCPContentBase {
  type: 'text';
  text: string;
}

/**
 * 画像コンテンツ
 */
export interface MCPImageContent extends MCPContentBase {
  type: 'image';
  data: string;
  mimeType: string;
}

/**
 * リソースコンテンツ
 */
export interface MCPResourceContent extends MCPContentBase {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
  };
}

/**
 * MCPコンテンツの型
 */
export type MCPContent = MCPTextContent | MCPImageContent | MCPResourceContent;

/**
 * tools/callレスポンス
 */
export interface MCPToolCallResponse {
  content?: MCPContent[];
  isError?: boolean;
}

/**
 * リソース定義
 */
export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * resources/listレスポンス
 */
export interface MCPResourcesListResponse {
  resources: MCPResource[];
}

/**
 * resources/readレスポンス
 */
export interface MCPResourceReadResponse {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  }>;
}

/**
 * プロンプト定義
 */
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * prompts/listレスポンス
 */
export interface MCPPromptsListResponse {
  prompts: MCPPrompt[];
}

/**
 * prompts/getレスポンス
 */
export interface MCPPromptGetResponse {
  description?: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: MCPContent;
  }>;
}

/**
 * ログレベル
 */
export type MCPLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * logging/setLevelパラメータ
 */
export interface MCPLoggingSetLevelParams {
  level: MCPLogLevel;
}

/**
 * completion/completeパラメータ
 */
export interface MCPCompletionCompleteParams {
  ref: {
    type: 'ref/prompt' | 'ref/resource';
    name: string;
  };
  argument: {
    name: string;
    value: string;
  };
}

/**
 * completion/completeレスポンス
 */
export interface MCPCompletionCompleteResponse {
  completion: {
    values: string[];
    total?: number;
    hasMore?: boolean;
  };
}
