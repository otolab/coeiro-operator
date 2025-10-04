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
      "args": ["-y", "@coeiro-operator/mcp"]
    }
  }
}
```

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

## 使用例（Claude Code内）

```javascript
// 音声で挨拶
await say({ message: "こんにちは" });

// オペレータを指定
await operator_assign({ operator: "tsukuyomi" });

// スタイル付き音声
await say({
  message: "お疲れ様でした",
  style: "ひそひそ"
});
```

## 動作要件

- Node.js 18以上
- COEIROINK本体が起動済み（http://localhost:50032）
- Claude Code（MCPクライアント）

## 詳細

完全なドキュメントは [GitHub](https://github.com/otolab/coeiro-operator) を参照してください。

## ライセンス

MIT