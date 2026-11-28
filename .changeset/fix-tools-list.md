---
"@coeiro-operator/mcp-debug": patch
---

CLI の tool 一覧表示が、サーバーの `tools/list` 応答を使うよう修正

### 詳細
- interactive shortcut はページネーションを含む tool 一覧を表示
- JSON-RPC `tools/list` は要求されたページの応答を返す
