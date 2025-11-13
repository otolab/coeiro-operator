/**
 * MCP Server共通型定義
 */

export interface StyleInfo {
  id: string;
  name: string;
  personality: string;
  speakingStyle: string;
  morasPerSecond?: number;
}

export interface AssignResult {
  characterId: string;
  characterName: string;
  currentStyle?: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  greeting?: string;
}

export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  [key: string]: unknown; // MCP SDKが追加フィールドを許可するため必要
}
