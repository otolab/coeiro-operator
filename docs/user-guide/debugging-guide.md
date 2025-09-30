# COEIRO Operator デバッグガイド

COEIRO Operatorの開発・デバッグのための実用的なガイドです。

## MCPサーバーのデバッグ

### mcp-debugツール

```bash
# インタラクティブモード
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# パイプ入力での実行
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js
```

### 直接実行（開発時推奨）

```bash
# MCPサーバー直接実行
node dist/mcp/server.js --debug
```

## 設定ファイルの場所

- `~/.coeiro-operator/config.json` - 統一設定ファイル
- `/tmp/coeiroink-operators-<hostname>.json` - セッション状態（一時ファイル、最大4時間）

## トラブルシューティング

### MCPツールが最新のコードを反映しない

Claude Code起動時のMCPサーバーインスタンスが古いため。開発中は直接実行またはmcp-debugを使用。

### 音声が再生されない

1. COEIROINKサーバーの動作確認: `curl -X GET "http://localhost:50032/v1/speakers"`
2. 音声出力の動作確認: `say-coeiroink "テスト"`

## 関連ドキュメント

- [mcp-debug テスト機能](../mcp-debug/testing-features.md)
- [開発Tips](../development/development-tips.md)