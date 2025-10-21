# mcp-debug

MCPサーバーの開発・テストを効率化するためのデバッグツール

## 概要

mcp-debugは、MCPサーバーを子プロセスとして起動し、JSON-RPCリクエストの送受信をサポートするデバッグツールです。開発中のMCPサーバーのテストを簡単に行えます。

## インストール

```bash
# プロジェクト内で使用（ビルド済みの場合）
node dist/mcp-debug/cli.js [options] <target-server>

# 開発中の場合
pnpm build
node dist/mcp-debug/cli.js [options] <target-server>
```

## 基本的な使い方

### 非インタラクティブモード（推奨）

JSON-RPCリクエストをパイプで送信：

```bash
# 単一リクエスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# 複数リクエスト（順次実行）
cat << 'EOF' | node dist/mcp-debug/cli.js dist/mcp/server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool1","arguments":{}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool2","arguments":{}},"id":2}
EOF
```

### インタラクティブモード

対話的にコマンドを実行：

```bash
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# 利用可能なコマンド：
# status - サーバー状態を表示
# tools - 利用可能なツール一覧
# exit - 終了
```

## オプション

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `--interactive, -i` | インタラクティブモード | TTYの場合true |
| `--timeout <ms>` | プロセス起動タイムアウト | 30000 |
| `--request-timeout <ms>` | リクエストタイムアウト | 10000 |
| `--debug, -d` | デバッグログ出力 | false |
| `--help, -h` | ヘルプ表示 | - |
| `--` | 以降の引数を子プロセスに渡す | - |

## 使用例

### MCPツールのテスト

```bash
# echoツールのテスト（echo-server.jsを使用）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/echo-server.js

# 複数のツール呼び出しを順次実行
cat << 'EOF' | node dist/mcp-debug/cli.js dist/echo-server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"first"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"second"}},"id":2}
EOF
```

### 子プロセスへの引数渡し

```bash
# -- 以降の引数は子プロセスに渡される
node dist/mcp-debug/cli.js dist/mcp/server.js -- --config custom.json --debug
```

## 重要な仕様

### 順次処理保証

複数のリクエストを送信した場合、以下の動作が保証されます：

1. **キューイング**: リクエストは内部キューに保存される
2. **順次実行**: 前のリクエストが完了してから次が実行される
3. **エラー独立性**: 1つのリクエストがエラーでも次は実行される

### 出力先

- **標準出力**: JSON-RPCレスポンス
- **標準エラー出力**: 起動メッセージ、デバッグログ

```bash
# レスポンスのみ取得（起動メッセージを抑制）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{...},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js 2>/dev/null
```

## 開発時の注意

### Claude CodeのMCPキャッシュ問題

Claude Codeは起動時にMCPサーバーをキャッシュするため、コード変更が反映されません：

```bash
# ❌ Claude Code内でMCPツールを実行
# → 古いコード（キャッシュ）が実行される

# ✅ mcp-debugを使用
# → 毎回新しいプロセスで最新コードが実行される
```

開発中は必ずmcp-debugを使用してテストしてください。

## トラブルシューティング

### "Server not ready" エラー

v1.0.0以降では自動的にキューイングされるため、このエラーは発生しません。
古いバージョンを使用している場合は更新してください。

### タイムアウトエラー

リクエストタイムアウトを調整：

```bash
node dist/mcp-debug/cli.js --request-timeout 60000 dist/mcp/server.js
```

## 詳細ドキュメント

- [使用ガイド](../../docs/mcp-debug/mcp-debug-guide.md)
- [アーキテクチャ](../../docs/mcp-debug/architecture.md)
- [MCPプロトコル仕様](../../docs/mcp-debug/mcp-protocol-specification.md)