#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn, ChildProcess } from "child_process";
import { z } from "zod";
import { SayCoeiroink, loadConfig } from "../core/say/index.js";
import { OperatorManager } from "../core/operator/index.js";
import { logger, LoggerPresets } from "../utils/logger.js";

interface StyleInfo {
  id: string;
  name: string;
  personality: string;
  speakingStyle: string;
}

interface AssignResult {
  operatorId: string;
  characterName: string;
  currentStyle?: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  greeting?: string;
}

interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
  [key: string]: unknown;
}

// MCPサーバーモードでlogger設定
LoggerPresets.mcpServer();

const server = new McpServer({
  name: "coeiro-operator",
  version: "1.0.0",
}, { 
  capabilities: { 
    tools: {} 
  } 
});

// top-level awaitを使用した同期的初期化
logger.info("Initializing COEIRO Operator services...");

let sayCoeiroink: SayCoeiroink;
let operatorManager: OperatorManager;

try {
  const config = await loadConfig();
  sayCoeiroink = new SayCoeiroink(config);
  
  await sayCoeiroink.initialize();
  await sayCoeiroink.buildDynamicConfig();
  
  operatorManager = new OperatorManager();
  await operatorManager.initialize();
  
  logger.info("SayCoeiroink and OperatorManager initialized successfully");
} catch (error) {
  logger.error("Failed to initialize services:", (error as Error).message);
  logger.warn("Using fallback configuration...");
  
  // フォールバック設定で初期化
  sayCoeiroink = new SayCoeiroink();
  await sayCoeiroink.initialize();
  await sayCoeiroink.buildDynamicConfig();
  
  operatorManager = new OperatorManager();
  await operatorManager.initialize();
}

// Utility functions for operator assignment
function validateOperatorInput(operator?: string): void {
  if (operator !== undefined && operator !== '' && operator !== null) {
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error('オペレータ名は英語表記で指定してください（例: tsukuyomi, alma）。日本語は使用できません。');
    }
  }
}

async function assignOperator(
  manager: OperatorManager, 
  operator?: string, 
  style?: string
): Promise<AssignResult> {
  if (operator && operator !== '' && operator !== null) {
    return await manager.assignSpecificOperator(operator, style);
  } else {
    return await manager.assignRandomOperator(style);
  }
}

interface CharacterForStyleExtraction {
  available_styles?: Record<string, {
    enabled: boolean;
    name: string;
    personality: string;
    speaking_style: string;
  }>;
}

function extractStyleInfo(character: CharacterForStyleExtraction): StyleInfo[] {
  return Object.entries(character.available_styles || {})
    .filter(([_, style]) => style.enabled)
    .map(([styleId, style]) => ({
      id: styleId,
      name: style.name,
      personality: style.personality,
      speakingStyle: style.speaking_style
    }));
}

function formatAssignmentResult(
  assignResult: AssignResult, 
  availableStyles: StyleInfo[]
): string {
  let resultText = `${assignResult.characterName} (${assignResult.operatorId}) をアサインしました。\n\n`;
  
  if (assignResult.currentStyle) {
    resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName}\n`;
    resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
    resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n\n`;
  }
  
  if (availableStyles.length > 1) {
    resultText += `🎭 利用可能なスタイル（切り替え可能）:\n`;
    availableStyles.forEach(style => {
      const isCurrent = style.id === assignResult.currentStyle?.styleId;
      const marker = isCurrent ? '→ ' : '  ';
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `    性格: ${style.personality}\n`;
      resultText += `    話し方: ${style.speakingStyle}\n`;
    });
  } else {
    resultText += `ℹ️  このキャラクターは1つのスタイルのみ利用可能です。\n`;
  }
  
  if (assignResult.greeting) {
    resultText += `\n💬 \"${assignResult.greeting}\"\n`;
  }
  
  return resultText;
}

// Utility functions for operator styles
async function getTargetCharacter(
  manager: OperatorManager, 
  characterId?: string
): Promise<{ character: CharacterForFormatting; characterId: string }> {
  if (characterId) {
    try {
      const character = await manager.getCharacterInfo(characterId);
      return { character, characterId };
    } catch (error) {
      throw new Error(`キャラクター '${characterId}' が見つかりません`);
    }
  } else {
    const currentOperator = await manager.showCurrentOperator();
    if (!currentOperator.operatorId) {
      throw new Error('現在オペレータが割り当てられていません。まず operator_assign を実行してください。');
    }
    
    const character = await manager.getCharacterInfo(currentOperator.operatorId);
    if (!character) {
      throw new Error(`現在のオペレータ '${currentOperator.operatorId}' のキャラクター情報が見つかりません`);
    }
    
    return { character, characterId: currentOperator.operatorId };
  }
}

interface CharacterForFormatting extends CharacterForStyleExtraction {
  name: string;
  personality: string;
  speaking_style: string;
  style_selection: string;
  default_style: string;
}

function formatStylesResult(character: CharacterForFormatting, availableStyles: StyleInfo[]): string {
  let resultText = `🎭 ${character.name} のスタイル情報\n\n`;
  
  resultText += `📋 基本情報:\n`;
  resultText += `   性格: ${character.personality}\n`;
  resultText += `   話し方: ${character.speaking_style}\n`;
  resultText += `   スタイル選択方法: ${character.style_selection}\n`;
  resultText += `   デフォルトスタイル: ${character.default_style}\n\n`;
  
  if (availableStyles.length > 0) {
    resultText += `🎨 利用可能なスタイル (${availableStyles.length}種類):\n`;
    availableStyles.forEach((style, index) => {
      const isDefault = style.id === character.default_style;
      const marker = isDefault ? '★ ' : `${index + 1}. `;
      resultText += `${marker}${style.id}: ${style.name}\n`;
      resultText += `   性格: ${style.personality}\n`;
      resultText += `   話し方: ${style.speakingStyle}\n`;
      if (isDefault) {
        resultText += `   (デフォルトスタイル)\n`;
      }
      resultText += `\n`;
    });
  } else {
    resultText += `⚠️  利用可能なスタイルがありません。\n`;
  }
  
  return resultText;
}

// Promiseを返すspawn wrapper
function spawnAsync(command: string, args: string[], env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: env || process.env
    });
    
    let stdout = "";
    let stderr = "";
    
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    child.on("error", (err) => {
      reject(new Error(`Failed to execute command: ${err.message}`));
    });
  });
}


// operator-manager操作ツール
server.registerTool("operator_assign", {
  description: "オペレータをランダム選択して割り当てます。アサイン後に現在のスタイルと利用可能な他のスタイル情報を表示します。スタイル切り替えはsayツールのstyleパラメータで可能です（例: say({message: \"テスト\", style: \"ura\"})）。ランダムスタイル選択キャラクターは次回アサイン時に異なるスタイルが選ばれる場合があります。",
  inputSchema: {
    operator: z.string().optional().describe("指定するオペレータ名（英語表記、例: 'tsukuyomi', 'alma'など。省略時または空文字列時はランダム選択。日本語表記は無効）"),
    style: z.string().optional().describe("指定するスタイル名（例: 'normal', 'ura', 'sleepy'など。省略時はキャラクターのデフォルト設定に従う）")
  }
}, async (args): Promise<ToolResponse> => {
  const { operator, style } = args || {};
  
  validateOperatorInput(operator);
  
  try {
    const assignResult = await assignOperator(operatorManager, operator, style);
    const character = await operatorManager.getCharacterInfo(assignResult.operatorId);
    
    if (!character) {
      throw new Error(`キャラクター情報が見つかりません: ${assignResult.operatorId}`);
    }
    
    const availableStyles = extractStyleInfo(character);
    const resultText = formatAssignmentResult(assignResult, availableStyles);
    
    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };
    
  } catch (error) {
    throw new Error(`オペレータ割り当てエラー: ${(error as Error).message}`);
  }
});

server.registerTool("operator_release", {
  description: "現在のオペレータを解放します",
  inputSchema: {}
}, async (): Promise<ToolResponse> => {
  try {
    const result = await spawnAsync("operator-manager", ["release"]);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  } catch (error) {
    throw new Error(`オペレータ解放エラー: ${(error as Error).message}`);
  }
});

server.registerTool("operator_status", {
  description: "現在のオペレータ状況を確認します",
  inputSchema: {}
}, async (): Promise<ToolResponse> => {
  try {
    const result = await spawnAsync("operator-manager", ["status"]);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  } catch (error) {
    throw new Error(`オペレータ状況確認エラー: ${(error as Error).message}`);
  }
});

server.registerTool("operator_available", {
  description: "利用可能なオペレータ一覧を表示します",
  inputSchema: {}
}, async (): Promise<ToolResponse> => {
  try {
    const result = await spawnAsync("operator-manager", ["available"]);
    return {
      content: [{
        type: "text",
        text: result
      }]
    };
  } catch (error) {
    throw new Error(`利用可能オペレータ確認エラー: ${(error as Error).message}`);
  }
});

// say音声出力ツール（src/say/index.js使用）
server.registerTool("say", {
  description: "COEIROINKを使って日本語音声を順次出力します（低レイテンシストリーミング対応）",
  inputSchema: {
    message: z.string().describe("発話させるメッセージ（日本語）"),
    voice: z.string().optional().describe("音声ID（省略時はオペレータ設定を使用）"),
    rate: z.number().optional().describe("話速（WPM、デフォルト200）"),
    streamMode: z.boolean().optional().describe("ストリーミングモード強制（デフォルト自動）"),
    style: z.string().optional().describe("スタイルID（オペレータのスタイル選択を上書き）")
  }
}, async (args): Promise<ToolResponse> => {
  const { message, voice, rate, streamMode, style } = args;
  
  try {
    // src/say/index.jsを直接呼び出し（enqueue処理で即座に戻る）
    const result = await sayCoeiroink.synthesizeTextAsync(message, {
      voice: voice || null,
      rate: rate || undefined,
      streamMode: streamMode || false,
      style: style || undefined,
      allowFallback: false  // MCPツールではフォールバックを無効化
    });
    
    return {
      content: [{
        type: "text",
        text: `音声合成キューに追加: タスクID ${result.taskId}, キュー長 ${result.queueLength}`
      }]
    };
  } catch (error) {
    throw new Error(`音声出力エラー: ${(error as Error).message}`);
  }
});

// スタイル情報表示ツール
server.registerTool("operator_styles", {
  description: "現在のオペレータまたは指定したキャラクターの利用可能なスタイル一覧を表示します。キャラクターの基本情報、全スタイルの詳細（性格・話し方）、スタイル選択方法を確認できます。スタイル切り替えにはsayツールのstyleパラメータを使用してください。",
  inputSchema: {
    character: z.string().optional().describe("キャラクターID（省略時は現在のオペレータのスタイル情報を表示）")
  }
}, async (args): Promise<ToolResponse> => {
  const { character } = args || {};
  
  try {
    let targetCharacter: CharacterForFormatting;
    let targetCharacterId: string;
    
    if (character) {
      // 指定されたキャラクターの情報を取得
      try {
        targetCharacter = await operatorManager.getCharacterInfo(character);
        targetCharacterId = character;
      } catch (error) {
        throw new Error(`キャラクター '${character}' が見つかりません`);
      }
    } else {
      // 現在のオペレータの情報を取得
      const currentOperator = await operatorManager.showCurrentOperator();
      if (!currentOperator.operatorId) {
        throw new Error('現在オペレータが割り当てられていません。まず operator_assign を実行してください。');
      }
      
      targetCharacter = await operatorManager.getCharacterInfo(currentOperator.operatorId);
      targetCharacterId = currentOperator.operatorId;
      
      if (!targetCharacter) {
        throw new Error(`現在のオペレータ '${currentOperator.operatorId}' のキャラクター情報が見つかりません`);
      }
    }
    
    // スタイル情報を取得
    const availableStyles: StyleInfo[] = extractStyleInfo(targetCharacter);
    
    // 結果を整形
    const resultText = formatStylesResult(targetCharacter, availableStyles);
    
    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };
    
  } catch (error) {
    throw new Error(`スタイル情報取得エラー: ${(error as Error).message}`);
  }
});

// サーバーの起動
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Say COEIROINK MCP Server started");
}

main().catch((error) => {
  logger.error("Server error:", error);
  process.exit(1);
});
