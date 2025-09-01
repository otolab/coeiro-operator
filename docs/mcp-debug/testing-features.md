# mcp-debug テスト機能

## 概要

mcp-debugは、MCPサーバーの開発・デバッグ・テストを支援する包括的なツールセットです。MCPプロトコルの仕様に準拠したテストを実現します。

## テスト機能一覧

### 1. プロトコル準拠性テスト

#### 初期化シーケンステスト

```bash
# 正しい初期化シーケンスの検証
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}},"id":1}' | \
  node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js
```

検証項目：
- ✅ initialize リクエストへの適切なレスポンス
- ✅ サーバー機能（capabilities）の返却
- ✅ initialized 通知の送信
- ✅ READY状態への遷移

### 2. リクエスト/レスポンス相関テスト

#### ID追跡テスト

```bash
# 複数のリクエストを送信してID相関を確認
cat << 'EOF' | node dist/mcp-debug/cli-v2.js dist/mcp/server.js
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool1","arguments":{}},"id":100}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool2","arguments":{}},"id":200}
EOF
```

検証項目：
- ✅ 各リクエストIDが対応するレスポンスに含まれる
- ✅ 並行リクエストの正しい処理
- ✅ 順序に依存しない処理

### 3. 状態管理テスト

#### サーバー状態遷移テスト

```bash
# インタラクティブモードで状態を確認
node dist/mcp-debug/cli-v2.js --interactive dist/mcp/server.js

> status  # 現在の状態を表示
> tools   # 利用可能なツール一覧
```

状態遷移の検証：
```
Uninitialized → Initializing → Ready → Processing → Ready
```

### 4. エラーハンドリングテスト

#### 不正なリクエスト

```bash
# 存在しないメソッド
echo '{"jsonrpc":"2.0","method":"invalid_method","params":{},"id":1}' | \
  node dist/mcp-debug/cli-v2.js dist/mcp/server.js
```

期待される結果：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32601,
    "message": "Method not found"
  }
}
```

### 5. タイムアウトテスト

#### リクエストタイムアウト

```bash
# 5秒でタイムアウト
node dist/mcp-debug/cli-v2.js \
  --request-timeout 5000 \
  dist/mcp/server.js
```

検証項目：
- ✅ 指定時間でタイムアウト
- ✅ 適切なエラーメッセージ
- ✅ リソースのクリーンアップ

### 6. 並行処理テスト

#### バッチリクエスト

```bash
# 複数ツールの同時実行
cat test-batch.json | node dist/mcp-debug/cli-v2.js dist/mcp/server.js
```

test-batch.json:
```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_available","arguments":{}},"id":2}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":3}
```

### 7. ストリーミングテスト

#### 長時間実行ツール

```bash
# ストリーミング出力の確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"長いテキスト..."}},"id":1}' | \
  node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js
```

検証項目：
- ✅ ストリーミング出力の処理
- ✅ バッファリングの適切な処理
- ✅ 改行区切りメッセージの処理

## Echo Serverを使った基本テスト

### Echo Serverの機能

テスト用のシンプルなMCPサーバー実装：

```bash
# Echo Server起動
node dist/mcp-debug/test/echo-server.js --debug
```

提供ツール：
- `echo`: メッセージをエコーバック
- `delay`: 指定時間待機
- `error`: エラーを発生

### 基本的なテストシナリオ

```bash
# 1. 正常系テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello"}},"id":1}' | \
  node dist/mcp-debug/cli-v2.js dist/mcp-debug/test/echo-server.js

# 2. 遅延テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"delay","arguments":{"ms":2000}},"id":2}' | \
  node dist/mcp-debug/cli-v2.js --request-timeout 5000 dist/mcp-debug/test/echo-server.js

# 3. エラーテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"error","arguments":{"message":"Test error"}},"id":3}' | \
  node dist/mcp-debug/cli-v2.js dist/mcp-debug/test/echo-server.js
```

## デバッグモード

### 詳細ログ出力

```bash
# --debugフラグで詳細ログを出力
node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js
```

出力内容：
- 状態遷移ログ
- リクエスト/レスポンスの詳細
- プロセスイベント
- エラースタックトレース

### ログフィルタリング

```bash
# 状態遷移のみ表示
node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js 2>&1 | \
  grep "State transition"

# エラーのみ表示
node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js 2>&1 | \
  grep "Error"
```

## CI/CD統合

### 自動テストスクリプト

```bash
#!/bin/bash
# test-mcp-server.sh

set -e

echo "Testing MCP Server..."

# 1. Initialize test
INIT_RESULT=$(echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}},"id":1}' | \
  timeout 5 node dist/mcp-debug/cli-v2.js dist/mcp/server.js 2>/dev/null)

if ! echo "$INIT_RESULT" | jq -e '.result.capabilities' > /dev/null; then
  echo "❌ Initialization failed"
  exit 1
fi

# 2. Tool execution test
TOOL_RESULT=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":2}' | \
  timeout 5 node dist/mcp-debug/cli-v2.js dist/mcp/server.js 2>/dev/null)

if ! echo "$TOOL_RESULT" | jq -e '.result' > /dev/null; then
  echo "❌ Tool execution failed"
  exit 1
fi

echo "✅ All tests passed"
```

### GitHub Actions統合

```yaml
name: MCP Server Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
      - run: ./test-mcp-server.sh
```

## パフォーマンステスト

### レスポンスタイム測定

```bash
# 100回のリクエストを送信して統計を取得
for i in {1..100}; do
  time echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":'$i'}' | \
    node dist/mcp-debug/cli-v2.js dist/mcp/server.js 2>/dev/null
done | awk '{sum+=$1; count++} END {print "Average:", sum/count, "seconds"}'
```

### メモリ使用量監視

```bash
# プロセスのメモリ使用量を監視
node dist/mcp-debug/cli-v2.js --interactive dist/mcp/server.js &
PID=$!

while kill -0 $PID 2>/dev/null; do
  ps -o pid,vsz,rss,comm -p $PID
  sleep 1
done
```

## トラブルシューティング

### よくある問題と解決策

| 問題 | 原因 | 解決策 |
|-----|------|--------|
| タイムアウトエラー | サーバー起動が遅い | `--timeout`値を増やす |
| ID相関エラー | IDの重複 | ユニークなIDを使用 |
| 状態遷移エラー | 不正な操作順序 | 初期化シーケンスを確認 |
| JSONパースエラー | 不正なJSON形式 | JSONバリデーターで確認 |

### デバッグテクニック

1. **状態の確認**
   ```bash
   # インタラクティブモードで状態を監視
   > status
   ```

2. **ログレベルの調整**
   ```bash
   # 最大詳細度でログ出力
   COEIRO_DEBUG=true node dist/mcp-debug/cli-v2.js --debug dist/mcp/server.js
   ```

3. **プロトコルトレース**
   ```bash
   # すべての通信をファイルに記録
   node dist/mcp-debug/cli-v2.js dist/mcp/server.js 2>protocol.log
   ```