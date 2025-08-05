#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { spawn } from "child_process";
import { z } from "zod";
import { SayCoeiroink } from "./say/index.js";

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

// 初期化を非同期で実行
(async () => {
  try {
    const config = await loadConfig();
    sayCoeiroink = new SayCoeiroink(config);
    console.error("SayCoeiroink initialized with config");
  } catch (error) {
    console.error("Failed to initialize SayCoeiroink:", error.message);
    sayCoeiroink = new SayCoeiroink(); // デフォルト設定でフォールバック
  }
})();

// operator-manager操作ツール
server.registerTool("operator_assign", {
  description: "オペレータをランダム選択して割り当てます（冪等性があるため事前の状況確認は不要）",
  inputSchema: {
    operator: z.string().optional().describe("指定するオペレータ名（英語表記、例: 'Alice', 'Bob'など。省略時または空文字列時はランダム選択。日本語表記は無効）")
  }
}, async (args) => {
  const { operator } = args || {};
  
  
  // 引数バリデーション（空文字列はランダム選択として扱う）
  if (operator !== undefined && operator !== '' && operator !== null) {
    // 日本語文字（ひらがな、カタカナ、漢字）の検出
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(operator)) {
      throw new Error('オペレータ名は英語表記で指定してください（例: Alice, Bob）。日本語は使用できません。');
    }
  }
  
  try {
    // まず現在の状態をチェック
    const statusResult = await new Promise((resolve, reject) => {
      const statusChild = spawn("operator-manager", ["status"], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env
      });
      
      let stdout = "";
      let stderr = "";
      
      statusChild.stdout.on("data", (data) => {
        stdout += data.toString();
      });
      
      statusChild.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      
      statusChild.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`status check failed: ${stderr}`));
        }
      });
      
      statusChild.on("error", (err) => {
        reject(new Error(`Failed to check status: ${err.message}`));
      });
    });
    
    // 既存のオペレータがある場合の処理
    if (statusResult && !statusResult.includes("オペレータが割り当てられていません")) {
      // 指定オペレータがある場合のみ切り替え処理を行う
      if (operator && operator !== '' && operator !== null) {
        // 指定オペレータに切り替え
        return new Promise((resolve, reject) => {
          const assignChild = spawn("operator-manager", ["assign", operator], {
            stdio: ["pipe", "pipe", "pipe"],
            env: process.env
          });
          
          let stdout = "";
          let stderr = "";
          
          assignChild.stdout.on("data", (data) => {
            stdout += data.toString();
          });
          
          assignChild.stderr.on("data", (data) => {
            stderr += data.toString();
          });
          
          assignChild.on("close", (code) => {
            if (code === 0) {
              resolve({
                content: [{
                  type: "text",
                  text: stdout.trim()
                }]
              });
            } else {
              reject(new Error(`operator-manager assign failed: ${stderr}`));
            }
          });
          
          assignChild.on("error", (err) => {
            reject(new Error(`Failed to execute operator-manager: ${err.message}`));
          });
        });
      } else {
        // ランダム選択が指定された場合でも、既存オペレータを返すのではなく新しいランダム選択を実行
        // 既存のオペレータを返す処理は削除し、下のランダム選択処理に任せる
      }
    }
    
    // 新規アサインの場合
    const assignArgs = (operator && operator !== '' && operator !== null) ? ["assign", operator] : ["assign"];
    return new Promise((resolve, reject) => {
      const child = spawn("operator-manager", assignArgs, {
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
          reject(new Error(`operator-manager assign failed: ${stderr}`));
        }
      });
      
      child.on("error", (err) => {
        reject(new Error(`Failed to execute operator-manager: ${err.message}`));
      });
    });
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