---
"@coeiro-operator/mcp-debug": patch
---

型安全性を大幅に改善

- sendRequest/callToolメソッドをジェネリクス対応に変更
- MCPプロトコルの標準型定義を追加・エクスポート
- ToolCallResultをジェネリクス対応に変更
- 型安全な使用例ドキュメントを追加

これにより、テストコードでany型を使う必要がなくなり、型安全にMCPサーバーのテストが記述できるようになりました。
