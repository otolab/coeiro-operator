#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import { z } from "zod";
import { SayCoeiroink } from "./say/index.js";
import { OperatorManager } from "./operator/index.js";

const server = new McpServer({
  name: "coeiro-operator",
  version: "1.0.0",
}, { 
  capabilities: { 
    tools: {} 
  } 
});

import { loadConfig } from "./say/index.js";

let sayCoeiroink = null;
let operatorManager = null;

// 初期化を非同期で実行
(async () => {
  try {
    const config = await loadConfig();
    sayCoeiroink = new SayCoeiroink(config);
    
    operatorManager = new OperatorManager();
    await operatorManager.initialize();
    console.error("SayCoeiroink initialized with config");
  } catch (error) {
    console.error("Failed to initialize SayCoeiroink:", error.message);
    sayCoeiroink = new SayCoeiroink(); // デフォルト設定でフォールバック
  }
})();

// operator-manager操作ツール
server.registerTool("operator_assign", {
  description: "オペレータをランダム選択して割り当てます。アサイン後に現在のスタイルと利用可能な他のスタイル情報を表示します。スタイル切り替えはsayツールのstyleパラメータで可能です（例: say({message: \"テスト\", style: \"ura\"})）。ランダムスタイル選択キャラクターは次回アサイン時に異なるスタイルが選ばれる場合があります。",
  inputSchema: {
    operator: z.string().optional().describe("指定するオペレータ名（英語表記、例: 'tsukuyomi', 'alma'など。省略時または空文字列時はランダム選択。日本語表記は無効）")
  }
}, async (args) => {
  const { operator } = args || {};
  
  // 引数バリデーション（空文字列はランダム選択として扱う）
  if (operator !== undefined && operator !== '' && operator !== null) {
    // 日本語文字（ひらがな、カタカナ、漢字）の検出
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error('オペレータ名は英語表記で指定してください（例: tsukuyomi, alma）。日本語は使用できません。');
    }
  }
  
  try {
    if (!operatorManager) {
      throw new Error('OperatorManager not initialized');
    }
    
    let assignResult;
    
    // オペレータ指定の有無に応じてアサイン
    if (operator && operator !== '' && operator !== null) {
      assignResult = await operatorManager.assignSpecificOperator(operator);
    } else {
      assignResult = await operatorManager.assignRandomOperator();
    }
    
    // キャラクター情報を取得
    const operatorConfig = await operatorManager.readJsonFile(operatorManager.operatorConfigFile, { characters: {} });
    const character = operatorConfig.characters?.[assignResult.operatorId];
    
    if (!character) {
      throw new Error(`キャラクター情報が見つかりません: ${assignResult.operatorId}`);
    }
    
    // スタイル情報を取得
    const availableStyles = Object.entries(character.available_styles || {})
      .filter(([_, style]) => style.enabled)
      .map(([styleId, style]) => ({
        id: styleId,
        name: style.name,
        personality: style.personality,
        speakingStyle: style.speaking_style
      }));
    
    // 結果を整形
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
      resultText += `\n💬 "${assignResult.greeting}"\n`;
    }
    
    return {
      content: [{
        type: "text",
        text: resultText
      }]
    };
    
  } catch (error) {
    throw new Error(`オペレータ割り当てエラー: ${error.message}`);
  }
});

server.registerTool("operator_release", {
  description: "現在のオペレータを解放します",
  inputSchema: {}
}, async () => {
  try {
    return new Promise((resolve, reject) => {
      const child = spawn("operator-manager", ["release"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            content: [{
              type: "text",
              text: stdout.trim()
            }]
          });
        } else {
          reject(new Error(`operator-manager release failed: ${stderr}`));
        }
      });
      
      child.on("error", (err) => {
        reject(new Error(`Failed to execute operator-manager: ${err.message}`));
      });
    });
  } catch (error) {
    throw new Error(`オペレータ解放エラー: ${error.message}`);
  }
});

server.registerTool("operator_status", {
  description: "現在のオペレータ状況を確認します",
  inputSchema: {}
}, async () => {
  try {
    return new Promise((resolve, reject) => {
      const child = spawn("operator-manager", ["status"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            content: [{
              type: "text",
              text: stdout.trim()
            }]
          });
        } else {
          reject(new Error(`operator-manager status failed: ${stderr}`));
        }
      });
      
      child.on("error", (err) => {
        reject(new Error(`Failed to execute operator-manager: ${err.message}`));
      });
    });
  } catch (error) {
    throw new Error(`オペレータ状況確認エラー: ${error.message}`);
  }
});

server.registerTool("operator_available", {
  description: "利用可能なオペレータ一覧を表示します",
  inputSchema: {}
}, async () => {
  try {
    return new Promise((resolve, reject) => {
      const child = spawn("operator-manager", ["available"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env
      });
      
      let stdout = "";
      let stderr = "";
      
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      child.on("close", (code) => {
        if (code === 0) {
          resolve({
            content: [{
              type: "text",
              text: stdout.trim()
            }]
          });
        } else {
          reject(new Error(`operator-manager available failed: ${stderr}`));
        }
      });
      
      child.on("error", (err) => {
        reject(new Error(`Failed to execute operator-manager: ${err.message}`));
      });
    });
  } catch (error) {
    throw new Error(`利用可能オペレータ確認エラー: ${error.message}`);
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
}, async (args) => {
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
    throw new Error(`音声出力エラー: ${error.message}`);
  }
});

// スタイル情報表示ツール
server.registerTool("operator_styles", {
  description: "現在のオペレータまたは指定したキャラクターの利用可能なスタイル一覧を表示します。キャラクターの基本情報、全スタイルの詳細（性格・話し方）、スタイル選択方法を確認できます。スタイル切り替えにはsayツールのstyleパラメータを使用してください。",
  inputSchema: {
    character: z.string().optional().describe("キャラクターID（省略時は現在のオペレータのスタイル情報を表示）")
  }
}, async (args) => {
  const { character } = args || {};
  
  try {
    if (!operatorManager) {
      throw new Error('OperatorManager not initialized');
    }
    
    let targetCharacter;
    let targetCharacterId;
    
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
      
      const operatorConfig = await operatorManager.readJsonFile(operatorManager.operatorConfigFile, { characters: {} });
      targetCharacter = operatorConfig.characters?.[currentOperator.operatorId];
      targetCharacterId = currentOperator.operatorId;
      
      if (!targetCharacter) {
        throw new Error(`現在のオペレータ '${currentOperator.operatorId}' のキャラクター情報が見つかりません`);
      }
    }
    
    // スタイル情報を取得
    const availableStyles = Object.entries(targetCharacter.available_styles || {})
      .filter(([_, style]) => style.enabled)
      .map(([styleId, style]) => ({
        id: styleId,
        name: style.name,
        personality: style.personality,
        speakingStyle: style.speaking_style
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
    throw new Error(`スタイル情報取得エラー: ${error.message}`);
  }
});

// サーバーの起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Say COEIROINK MCP Server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});