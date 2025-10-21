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
# 単一リクエストの送信
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# 複数のリクエストを順次実行
cat << 'EOF' | node dist/mcp-debug/cli.js dist/mcp/server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト"}},"id":3}
EOF
```

**重要な仕様**:
- **順次処理**: 複数のリクエストは、前のリクエストが完了してから次が実行されます
- **エラー処理**: 各リクエストは独立して処理され、1つが失敗しても次のリクエストは実行されます
- **出力先**: 起動メッセージは標準エラー出力、JSON-RPCレスポンスは標準出力に返されます

```bash
# レスポンスのみを取得（起動メッセージを抑制）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{...},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js 2>/dev/null
```

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

## MCPサーバー開発時の重要事項

### Claude CodeのMCPサーバーキャッシュ

Claude Codeは起動時にMCPサーバーを一度だけロードし、メモリにキャッシュします。これにより以下の開発上の制約が生じます：

```bash
# 期待する動作
1. コードを編集
2. pnpm build
3. 変更が反映される

# 実際の動作（Claude Code内で実行した場合）
1. コードを編集
2. pnpm build
3. mcp__your_server__tool を実行
   → 古いコード（起動時のキャッシュ）が実行される
```

この問題を回避するため、開発・テスト時はmcp-debugを使用してください。mcp-debugは毎回新しいプロセスを起動するため、最新のコードが実行されます。

## 実用例

### MCPサーバーコード更新後のテスト

```bash
# 1. ビルド
pnpm build

# 2. 特定のMCPツールをテスト（最新コードで実行される）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}' | \
node dist/mcp-debug/cli.js dist/mcp/server.js

# 3. インタラクティブモードでデバッグ
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug
```

### 複数のツールを順次テスト

#### 方法1: 1つのパイプで複数リクエスト（推奨）

```bash
# 1回の起動で複数のツールをテスト
cat << 'EOF' | node dist/mcp-debug/cli.js dist/mcp/server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト"}},"id":3}
EOF
```

**メリット**:
- MCPサーバーの起動が1回だけなので高速
- 順次実行が保証される
- レスポンスの順序が保証される

#### 方法2: 個別のパイプで実行

```bash
# テスト用シェルスクリプト例
cat << 'EOF' > test-mcp.sh
#!/bin/bash
# オペレータ状態確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# スタイル情報取得
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":2}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js
EOF

chmod +x test-mcp.sh
./test-mcp.sh
```

**デメリット**:
- 各コマンドでMCPサーバーを再起動するため遅い
- 状態が保持されない（オペレータ割り当てなど）

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

### 複数リクエストでエラーが発生する

**以前の問題（修正済み）**:
v1.0.0より前のバージョンでは、複数リクエストを同時に送信すると「Server not ready. Current state: processing」エラーが発生していました。

**現在の動作（v1.0.0以降）**:
複数のリクエストは自動的にキューイングされ、順番に処理されます：

```bash
# 正常に動作（3つのリクエストが順次実行される）
cat << 'EOF' | node dist/mcp-debug/cli.js dist/mcp/server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"request 1"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"request 2"}},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"request 3"}},"id":3}
EOF
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