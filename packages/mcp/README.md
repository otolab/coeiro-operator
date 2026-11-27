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

## MCP tool metadata と音声キュー

SDK v2 への移行により、`tools/list` の各 tool から `execution.taskSupport: "forbidden"` が省略されます。MCP 2025-11-25 仕様では、この field の省略も task-augmented execution 非対応を意味します。通常の `tools/call` による機能や、COEIRO Operator が MCP Tasks を提供しない点に変更はありません。

`say` の応答に含まれる task ID は、音声再生キューが発行するアプリ内 ID です。MCP の Tasks protocol とは別の仕組みで、`wait_for_task_completion` や `queue_status` も通常の `tools/call` で利用します。MCP 2026-07-28 の Tasks extension はこのサーバーでは実装していません。

MCP 仕様に従う client は、field の省略を task execution 非対応として扱えます。JSON 内で `execution` の存在を直接調べている独自 client は、field がない場合も非対応として扱うようにしてください。リポジトリでは Claude Code / Claude Desktop を利用例として案内していますが、実際に接続している外部 client の種類・版や独自実装の利用状況までは把握していません。

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

- Node.js 20以上
- COEIROINK本体が起動済み（http://localhost:50032）
- Claude Code（MCPクライアント）

## 詳細

完全なドキュメントは [GitHub](https://github.com/otolab/coeiro-operator) を参照してください。

## ライセンス

MIT
