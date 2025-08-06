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
npm run type-check
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
  - `development-tips.md`: 開発テクニック・Tips集

## 開発時の重要なテクニック

### MCPサーバーの再起動
コード変更後にMCPサーバーを再起動するには：
```bash
claude mcp remove coeiro-operator
claude mcp add coeiro-operator
```
この方法により変更が確実に反映されます。詳細は`docs/development-tips.md`を参照。

### 開発フロー
1. コード修正
2. `npm run build` でビルド
3. MCPサーバー再起動（上記コマンド）
4. Claude Codeでツール動作確認

これにより開発効率が大幅に向上します。