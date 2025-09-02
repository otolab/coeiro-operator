# COEIRO Operator デバッグガイド

COEIRO Operatorの開発・デバッグ・トラブルシューティングのための包括的なガイドです。

## 📋 目次

1. [デバッグ環境のセットアップ](#デバッグ環境のセットアップ)
2. [MCPサーバーのデバッグ](#mcpサーバーのデバッグ)
3. [音声システムのデバッグ](#音声システムのデバッグ)
4. [オペレータシステムのデバッグ](#オペレータシステムのデバッグ)
5. [一般的な問題と解決策](#一般的な問題と解決策)
6. [高度なデバッグテクニック](#高度なデバッグテクニック)

## デバッグ環境のセットアップ

### 環境変数

```bash
# デバッグモード有効化
export COEIRO_DEBUG=true
export COEIRO_LOG_LEVEL=debug

# ログ出力先指定（オプション）
export COEIRO_LOG_FILE=/tmp/coeiro-debug.log
```

### デバッグビルド

```bash
# TypeScriptソースマップ付きビルド
npm run build

# 開発モード（ウォッチモード）
npm run dev
```

## MCPサーバーのデバッグ

### mcp-debugツールの使用

mcp-debugは、MCPサーバーの開発・デバッグのための専用ツールです。

#### 基本的な使い方

```bash
# 非インタラクティブモード（パイプ入力）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# インタラクティブモード
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# デバッグログ付き
node dist/mcp-debug/cli.js --debug dist/mcp/server.js
```

#### インタラクティブモードのコマンド

```
> status     # サーバー状態を確認
> tools      # 利用可能なツール一覧
> exit       # 終了
```

#### デバッグ出力の確認

```bash
# 状態遷移を追跡
node dist/mcp-debug/cli.js --debug dist/mcp/server.js 2>&1 | grep "State transition"

# エラーのみ表示
node dist/mcp-debug/cli.js --debug dist/mcp/server.js 2>&1 | grep "Error"
```

### 直接MCPサーバー実行

開発中のコード変更をテストする最も簡単な方法：

```bash
# 初期化テスト
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}},"id":1}' | \
  node dist/mcp/server.js

# ツール実行テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト"}},"id":2}' | \
  node dist/mcp/server.js
```

### プロトコルトレース

```bash
# すべての通信をファイルに記録
node dist/mcp/server.js 2>protocol-trace.log

# リアルタイムでプロトコルを監視
node dist/mcp/server.js 2>&1 | tee protocol.log | grep '"method"'
```

## 音声システムのデバッグ

### 音声合成デバッグ

```bash
# デバッグモードで音声合成
COEIRO_DEBUG=true say-coeiroink "テスト音声です"

# チャンク分割の確認
COEIRO_DEBUG=true say-coeiroink --chunk-mode punctuation "これは最初の文です。これは二番目の文です。"

# バッファサイズのテスト
say-coeiroink --buffer-size 256 "低レイテンシテスト"
say-coeiroink --buffer-size 4096 "高品質テスト"
```

### 並行生成システムのデバッグ

```bash
# 並行生成ログの確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"parallel_generation_control","arguments":{"action":"status"}},"id":1}' | \
  node dist/mcp/server.js --debug

# 並行数を変更してテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"parallel_generation_control","arguments":{"action":"update_options","options":{"maxConcurrency":1}}},"id":2}' | \
  node dist/mcp/server.js
```

### 音声出力の問題診断

```bash
# スピーカーデバイスの確認
node -e "const Speaker = require('speaker'); const s = new Speaker(); console.log(s);"

# WAVファイル出力でテスト（音声デバイスを迂回）
say-coeiroink -o test.wav "音声出力テスト"
file test.wav  # ファイル形式確認
```

## オペレータシステムのデバッグ

### オペレータ状態の確認

```bash
# 現在の状態を確認
operator-manager status

# 詳細ログ付き
COEIRO_DEBUG=true operator-manager status

# セッション状態の確認（一時ファイル）
hostname_clean=$(hostname | sed 's/[^a-zA-Z0-9]/_/g')
cat /tmp/coeiroink-operators-${hostname_clean}.json | jq '.'
```

### オペレータ割り当てデバッグ

```bash
# セッションIDの確認
echo $TERM_SESSION_ID

# 異なるセッションをシミュレート
TERM_SESSION_ID=test_session_1 operator-manager assign
TERM_SESSION_ID=test_session_2 operator-manager assign

# 割り当て状況確認
operator-manager status
```

### スタイル関連の問題

```bash
# 利用可能なスタイル確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}' | \
  node dist/mcp/server.js | jq '.result.content[0].text'

# COEIROINKサーバーから直接確認
curl -X GET "http://localhost:50032/v1/speakers" | jq '.'
```

## 一般的な問題と解決策

### 問題: MCPツールが最新のコードを反映しない

**原因**: Claude Code起動時のMCPサーバーインスタンスが古い

**解決策**:
```bash
# 開発中はmcp-debugを使用
node dist/mcp-debug/cli.js dist/mcp/server.js

# または直接実行
node dist/mcp/server.js
```

### 問題: 音声が再生されない

**診断手順**:
```bash
# 1. COEIROINKサーバー確認
curl -X GET "http://localhost:50032/v1/speakers"

# 2. 音声合成APIテスト
curl -X POST "http://localhost:50032/v1/synthesis" \
  -H "Content-Type: application/json" \
  -d '{"text":"テスト","speaker_uuid":"speaker-uuid-here"}'

# 3. スピーカーモジュール確認
npm ls speaker
```

### 問題: オペレータが重複して割り当てられる

**診断**:
```bash
# アクティブオペレータ確認（一時ファイル）
hostname_clean=$(hostname | sed 's/[^a-zA-Z0-9]/_/g')
cat /tmp/coeiroink-operators-${hostname_clean}.json | jq '.sessions'

# 全クリア
operator-manager clear

# 再割り当て
operator-manager assign
```

## 高度なデバッグテクニック

### メモリリーク検出

```bash
# メモリ使用量の監視
node --expose-gc dist/mcp/server.js &
PID=$!

while true; do
  ps -o pid,vsz,rss -p $PID
  sleep 5
done

# ヒープダンプ取得
node --inspect dist/mcp/server.js
# Chrome DevToolsで接続してヒープスナップショット取得
```

### パフォーマンスプロファイリング

```bash
# CPU プロファイリング
node --prof dist/mcp/server.js
node --prof-process isolate-*.log > profile.txt

# 実行時間測定
time echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"パフォーマンステスト"}},"id":1}' | \
  node dist/mcp/server.js
```

### ネットワークデバッグ

```bash
# COEIROINKとの通信を監視
tcpdump -i lo0 -A 'port 50032'

# HTTPリクエストの詳細確認
curl -v -X POST "http://localhost:50032/v1/synthesis" \
  -H "Content-Type: application/json" \
  -d '{"text":"テスト","speaker_uuid":"uuid"}'
```

### ログレベル制御

```javascript
// コード内でのログレベル変更
import { logger } from './utils/logger.js';

// 特定モジュールのみデバッグ
logger.setLevel('debug', 'speech-queue');
logger.setLevel('info', 'operator-manager');
```

## デバッグ用設定ファイル

### ~/.coeiro-operator/debug-config.json

```json
{
  "debug": {
    "enabled": true,
    "logLevel": "debug",
    "logFile": "/tmp/coeiro-debug.log",
    "preserveLogs": true,
    "maxLogSize": "10MB"
  },
  "performance": {
    "measureTiming": true,
    "profileMemory": true,
    "slowThreshold": 1000
  },
  "mcp": {
    "traceProtocol": true,
    "dumpRequests": true,
    "dumpResponses": true
  }
}
```

## VSCode デバッグ設定

### .vscode/launch.json

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug MCP Server",
      "program": "${workspaceFolder}/dist/mcp/server.js",
      "args": ["--debug"],
      "env": {
        "COEIRO_DEBUG": "true",
        "COEIRO_LOG_LEVEL": "debug"
      },
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug mcp-debug",
      "program": "${workspaceFolder}/dist/mcp-debug/cli.js",
      "args": ["--debug", "--interactive", "dist/mcp/server.js"],
      "console": "integratedTerminal"
    }
  ]
}
```

## CI/CDでのデバッグ

### GitHub Actions でのデバッグ

```yaml
- name: Debug Information
  if: failure()
  run: |
    echo "=== Node Version ==="
    node --version
    echo "=== NPM Version ==="
    npm --version
    echo "=== Build Output ==="
    ls -la dist/
    echo "=== Test Logs ==="
    cat test-results.log || true
    echo "=== MCP Debug Trace ==="
    cat protocol-trace.log || true
```

## 関連ドキュメント

- [mcp-debug テスト機能](./mcp-debug/testing-features.md)
- [MCPプロトコル仕様](./mcp-debug/mcp-protocol-specification.md)
- [トラブルシューティング](./troubleshooting.md)
- [開発Tips](./development-tips.md)