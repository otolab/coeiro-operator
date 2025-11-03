---
"coeiro-operator": patch
"@coeiro-operator/mcp-debug": minor
---

MCP初期化プロトコルの改善とベストプラクティスガイド追加

## @coeiro-operator/mcp-debug

### 新機能
- tools/listリクエストのサポート追加
  - MCPProtocolHandler.listTools()メソッド追加
  - MCPDebugClient.getTools()メソッド追加
- 通知ハンドラー機能の追加
  - notifications/tools/list_changed対応

### Breaking Changes
- MCPServiceE2ETester.getAvailableTools()を非同期メソッドに変更
  - 旧: getAvailableTools(): string[]
  - 新: async getAvailableTools(): Promise<string[]>

### 改善
- capabilities と tools/list の違いを正しく実装
- listChanged が機能宣言であることを明確化
- 型安全性の向上（MCPToolsListResponse使用）

### ドキュメント
- MCP Protocol Best Practices Guide 新規作成
- 初期化プロトコルの正しい理解を解説
- よくある誤解と解決方法を網羅

## coeiro-operator (root)

### ドキュメント
- mcp-debugの改善に伴うドキュメント整備