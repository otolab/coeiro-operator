# トラブルシューティングガイド

COEIRO Operatorの一般的な問題と解決方法を説明します。

## 音声出力の問題

### 音声が出力されない

1. COEIROINKサーバーの動作確認: `curl -X GET "http://localhost:50032/v1/speakers"`
2. 音声出力テスト: `say-coeiroink "テスト"`

### 音声レイテンシが高い

設定ファイル（`~/.coeiro-operator/coeiroink-config.json`）で調整：
```json
{
  "audio": {
    "latencyMode": "ultra-low",
    "bufferSize": 256
  }
}
```

## オペレータ管理の問題

### オペレータが割り当てられない

```bash
# 状況確認
operator-manager status
operator-manager available

# 全クリア
operator-manager clear

# 再割り当て
operator-manager assign
```

## MCPサーバー問題

### 開発中のコードが反映されない

Claude Code起動時のMCPサーバーインスタンスが古いため。開発時は：

```bash
# mcp-debugで直接テスト
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# または直接実行
node dist/mcp/server.js
```

## インストール問題

### ネイティブモジュールビルドエラー

**macOS:**
```bash
xcode-select --install
npm rebuild
```

**Linux:**
```bash
sudo apt-get install build-essential libasound2-dev
npm rebuild
```

## 関連ドキュメント

- [デバッグガイド](../user-guide/debugging-guide.md)
- [開発Tips](../development/development-tips.md)