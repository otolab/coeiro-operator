# mcp-debug 使用ガイド

mcp-debugは、MCPサーバーの開発・テストを効率化するためのデバッグツールです。

## 概要

mcp-debugは、MCPサーバーを子プロセスとして起動し、以下の機能を提供します：

- **透過的なプロキシ**: JSON-RPCリクエストをターゲットサーバーに転送し、レスポンスを返す
- **制御コマンド**: `CTRL:` プレフィックスの特殊コマンドでサーバー制御
- **タイムアウト制御**: 子プロセスの自動終了機能
- **インタラクティブモード**: 対話的なテスト環境

## 基本的な使い方

### 非インタラクティブモード（パイプ処理）

JSON-RPCリクエストを標準入力から受け取り、MCPサーバーに転送します：

```bash
# JSON-RPCリクエストをパイプで送信
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}' | \
node dist/mcp-debug/cli.js dist/mcp/server.js

# タイムアウト付き（推奨）
echo '{...}' | node dist/mcp-debug/cli.js --timeout 5000 dist/mcp/server.js
```

**注意**: 非インタラクティブモードでは、起動メッセージは標準エラー出力に表示されます。
JSON-RPCレスポンスは標準出力に返されます。

### インタラクティブモード

対話的にコマンドを実行できます：

```bash
# インタラクティブモード起動
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# 利用可能なショートカット
status    # サーバー状態確認
restart   # サーバー再起動  
help      # ヘルプ表示
exit      # 終了
```

### オプション

| オプション | 説明 | デフォルト |
|-----------|------|------------|
| `--interactive, -i` | インタラクティブモード | false |
| `--timeout <ms>` | 子プロセス自動終了時間 | 30000 |
| `--debug, -d` | デバッグログ出力 | false |
| `--auto-reload, -r` | ファイル変更時の自動リロード | false |
| `--` | 以降のオプションを子プロセスに渡す | - |

## 実用例

### MCPサーバーコード更新後のテスト

```bash
# 1. ビルド
npm run build

# 2. 特定のMCPツールをテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}' | \
node dist/mcp-debug/cli.js dist/mcp/server.js

# 3. インタラクティブモードでデバッグ
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug
```

**重要**: Claude Code起動中のMCPツールでは編集したコードの変更が反映されません。開発・テスト時は必ずmcp-debugを使用してください。

### 複数のツールを順次テスト

```bash
# テスト用シェルスクリプト例
cat << 'EOF' > test-mcp.sh
#!/bin/bash
# オペレータ状態確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js --timeout 3000 dist/mcp/server.js

# スタイル情報取得
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":2}' | \
  node dist/mcp-debug/cli.js --timeout 3000 dist/mcp/server.js
EOF

chmod +x test-mcp.sh
./test-mcp.sh
```

## トラブルシューティング

### mcp-debugで出力が表示されない

非インタラクティブモードでは、起動メッセージは標準エラー出力に表示されます：
- JSON-RPCレスポンス → 標準出力
- 起動メッセージ・デバッグログ → 標準エラー出力

```bash
# 標準エラー出力を抑制してレスポンスのみ取得
echo '{"jsonrpc":"2.0","method":"tools/call","params":{...},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js 2>/dev/null
```

### タイムアウトが効かない

`--timeout`オプションは子プロセスの寿命を制御します。制御コマンドのタイムアウトとは別です：

```bash
# 子プロセスを5秒で終了
node dist/mcp-debug/cli.js --timeout 5000 dist/mcp/server.js
```

## 詳細ドキュメント

mcp-debugの詳細な仕様・アーキテクチャ・拡張方法については以下を参照：

- **[src/mcp-debug/README.md](../src/mcp-debug/README.md)** - mcp-debug完全マニュアル
- **[scripts/test-mcp-debug.sh](../scripts/test-mcp-debug.sh)** - テストスクリプト例