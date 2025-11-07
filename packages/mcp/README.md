# @coeiro-operator/mcp

COEIROINK音声合成のMCP（Model Context Protocol）サーバー

Claude Codeで音声対話機能を実現するMCPサーバーです。

## インストール

### 方法1: グローバルインストール（推奨）

```bash
# インストール
npm install -g @coeiro-operator/mcp

# MCPサーバーを登録
claude mcp add coeiro-operator
```

### 方法2: npxで直接実行

`claude_desktop_config.json`に直接追加：

```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "npx",
      "args": ["-y", "--package", "@coeiro-operator/mcp", "coeiro-operator"]
    }
  }
}
```

※ `npx -y --package "@coeiro-operator/mcp" coeiro-operator`でパッケージを自動インストールして`coeiro-operator`コマンドを実行します

## 提供される機能

### 音声合成

- `say` - テキストを音声で読み上げ
- `operator_assign` - オペレータ（音声キャラクター）の割り当て
- `operator_release` - オペレータの解放
- `operator_status` - 現在のオペレータ状態確認
- `operator_available` - 利用可能なオペレータ一覧
- `operator_styles` - 音声スタイル一覧

### ユーザー辞書

- `dictionary_register` - 単語の読み方を登録

### デバッグ

- `debug_logs` - デバッグログの取得
- `parallel_generation_control` - 並行生成制御

## 使用例（Claude Codeでの会話）

```
ユーザー: こんにちはと音声で言って

Claude Code: [say ツールを使用して「こんにちは」を音声出力]

ユーザー: つくよみちゃんに切り替えて

Claude Code: [operator_assign ツールでtsukuyomiに切り替え]

ユーザー: ひそひそ声でお疲れ様と言って

Claude Code: [say ツールでstyle: "ひそひそ"を指定して音声出力]
```

※ MCPツールはClaude Codeが自動的に判断して使用します

## 動作要件

- Node.js 18以上
- COEIROINK本体が起動済み（http://localhost:50032）
- Claude Code（MCPクライアント）

## 詳細

完全なドキュメントは [GitHub](https://github.com/otolab/coeiro-operator) を参照してください。

## ライセンス

MIT