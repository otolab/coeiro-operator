#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn, ChildProcess } from "child_process";
import { z } from "zod";
import { SayCoeiroink, loadConfig } from "./say/index.js";
import { OperatorManager } from "./operator/index.js";

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

const server = new McpServer({
  name: "coeiro-operator",
  version: "1.0.0",
}, { 
  capabilities: { 
    tools: {} 
  } 
});

let sayCoeiroink: SayCoeiroink | null = null;
let operatorManager: OperatorManager | null = null;

// 初期化を非同期で実行
(async () => {
  try {
    const config = await loadConfig();
    sayCoeiroink = new SayCoeiroink(config);
    
    operatorManager = new OperatorManager();
    await operatorManager.initialize();
    console.error("SayCoeiroink initialized with config");
  } catch (error) {
    console.error("Failed to initialize SayCoeiroink:", (error as Error).message);
    sayCoeiroink = new SayCoeiroink(); // デフォルト設定でフォールバック
  }
})();

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

// オペレータ入力バリデーション関数
function validateOperatorInput(operator?: string): void {
  if (operator !== undefined && operator !== '' && operator !== null) {
    // 日本語文字（ひらがな、カタカナ、漢字）の検出
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error('オペレータ名は英語表記で指定してください（例: tsukuyomi, alma）。日本語は使用できません。');
    }
  }
}

// アサインメント実行関数
async function executeAssignment(operatorManager: OperatorManager, operator?: string, style?: string): Promise<AssignResult> {
  if (operator && operator !== '' && operator !== null) {
    return await operatorManager.assignSpecificOperator(operator, style);
  } else {
    return await operatorManager.assignRandomOperator(style);
  }
}

// スタイル情報生成関数
function generateStyleInfoList(character: any): StyleInfo[] {
  return Object.entries(character.available_styles || {})
    .filter(([_, style]) => (style as any).enabled)
    .map(([styleId, style]) => ({
      id: styleId,
      name: (style as any).name,
      personality: (style as any).personality,
      speakingStyle: (style as any).speaking_style
    }));
}

// 結果テキスト生成関数
function formatAssignmentResult(assignResult: AssignResult, availableStyles: StyleInfo[]): string {
  let resultText = `${assignResult.characterName} (${assignResult.operatorId}) をアサインしました。\n\n`;
  
  // 現在のスタイル情報
  if (assignResult.currentStyle) {
    resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName}\n`;
    resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
    resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n\n`;
  }
  
  // 利用可能なスタイル一覧
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
  
  // 挨拶
  if (assignResult.greeting) {
    resultText += `\n💬 \"${assignResult.greeting}\"\n`;
  }
  
  return resultText;
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
    if (!operatorManager) {
      throw new Error('OperatorManager not initialized');
    }
    
    const assignResult = await executeAssignment(operatorManager, operator, style);
    const character = await operatorManager.getCharacterInfo(assignResult.operatorId);
    
    if (!character) {
      throw new Error(`キャラクター情報が見つかりません: ${assignResult.operatorId}`);
    }
    
    const availableStyles = generateStyleInfoList(character);
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
    if (!sayCoeiroink) {
      throw new Error('SayCoeiroink not initialized');
    }
    
    // src/say/index.jsを直接呼び出し（enqueue処理で即座に戻る）
    const result = await sayCoeiroink.synthesizeText(message, {
      voice: voice || null,
      rate: rate || undefined,
      streamMode: streamMode || false,
      style: style || undefined
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
    if (!operatorManager) {
      throw new Error('OperatorManager not initialized');
    }
    
    let targetCharacter: any;
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
    const availableStyles: StyleInfo[] = Object.entries(targetCharacter.available_styles || {})
      .filter(([_, style]) => (style as any).enabled)
      .map(([styleId, style]) => ({
        id: styleId,
        name: (style as any).name,
        personality: (style as any).personality,
        speakingStyle: (style as any).speaking_style
      }));
    
    // 結果を整形
    let resultText = `🎭 ${targetCharacter.name} のスタイル情報\n\n`;
    
    // キャラクターの基本情報
    resultText += `📋 基本情報:\n`;
    resultText += `   性格: ${targetCharacter.personality}\n`;
    resultText += `   話し方: ${targetCharacter.speaking_style}\n`;
    resultText += `   スタイル選択方法: ${targetCharacter.style_selection}\n`;
    resultText += `   デフォルトスタイル: ${targetCharacter.default_style}\n\n`;
    
    // 利用可能なスタイル一覧
    if (availableStyles.length > 0) {
      resultText += `🎨 利用可能なスタイル (${availableStyles.length}種類):\n`;
      availableStyles.forEach((style, index) => {
        const isDefault = style.id === targetCharacter.default_style;
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
  console.error("Say COEIROINK MCP Server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
