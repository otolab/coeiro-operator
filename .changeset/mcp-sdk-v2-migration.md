---
"@coeiro-operator/mcp": minor
"@coeiro-operator/mcp-debug": minor
---

MCP TypeScript SDK v2 へ移行し、Node.js の最低要件を 20 以上に引き上げます。`tools/list` では v1 が明示していた `execution.taskSupport: "forbidden"` が省略されます。MCP 2025-11-25 の既定値も forbidden のため、通常の `tools/call` に機能差はありません。アプリ内の音声キュー task と `wait_for_task_completion` も引き続き利用できます。field の存在に依存する独自 client は、省略時を task 非対応として扱ってください。未登録 tool の応答形式と公開 JSON Schema は現行仕様を維持します。
