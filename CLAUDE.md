# COEIRO Operator プロジェクト用設定

## MCP Tools ガイド

code-bugs MCPツールの詳細な使用方法については、以下のファイルを参照してください：

- [MCP Tools 使用ガイド](./prompts/mcp-tools-usage-guide.md)
  - @prompts/mcp-tools-usage-guide.md

このファイルには以下の情報が含まれています：
- 利用可能なMCPサーバーの概要
- 各ツールの詳細な引数と使用例
- 解析タイプの説明
- 典型的なワークフローとベストプラクティス

## コマンド実行環境

### テスト実行
```bash
npm test
```

### リント・型チェック
```bash
npm run lint
npm run typecheck
```

### ビルド
```bash
npm run build
```

## プロジェクト構成

- `src/operator/`: オペレータ管理機能
- `src/say/`: 音声出力機能  
- `prompts/`: システムプロンプトとガイド
- `docs/`: プロジェクトドキュメント