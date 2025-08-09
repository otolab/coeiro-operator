# MCPデバッグ環境ガイド

MCPサーバーの開発・デバッグを効率化するための統合デバッグ環境の使用方法について説明します。

## 概要

MCPデバッグ環境は以下の機能を提供します：

- **制御コマンド処理** - `CTRL:` プレフィックスでのサーバー制御
- **出力チャネル分離** - MCP/Control/Debug/Error出力の分離
- **ログ蓄積機能** - デバッグ用ログの蓄積と取得
- **Echo Back MCPサーバー** - テスト用のエコーバックサーバー
- **統合テストシステム** - 自動化されたテストスイート

## セットアップ

### ビルド

```bash
npm run build
```

### テスト実行

統合テストスイートで全機能をテスト：

```bash
# 自動テスト実行
node dist/mcp-debug/test/integration.test.js

# または専用スクリプト
bash scripts/test-mcp-debug.sh
```

## Echo Back MCPサーバー

### 起動方法

```bash
# 通常モード
node dist/mcp-debug/test/echo-server.js

# デバッグモード（詳細ログ出力）
node dist/mcp-debug/test/echo-server.js --debug
```

### 制御コマンド

サーバーは`CTRL:`プレフィックスの制御コマンドに対応：

```bash
# サーバー状態確認
echo 'CTRL:status' | node dist/mcp-debug/test/echo-server.js

# ヘルスチェック
echo 'CTRL:health' | node dist/mcp-debug/test/echo-server.js

# モード変更
echo 'CTRL:mode:debug' | node dist/mcp-debug/test/echo-server.js

# ログ統計取得
echo 'CTRL:logs:stats' | node dist/mcp-debug/test/echo-server.js
```

### MCPツール

以下のMCPツールが利用可能：

#### 1. echo ツール
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "echo",
    "arguments": {
      "message": "テストメッセージ",
      "delay": 100
    }
  },
  "id": 1
}
```

#### 2. debug_info ツール
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "debug_info",
    "arguments": {
      "type": "stats"  // logs, stats, status
    }
  },
  "id": 2
}
```

#### 3. test_output ツール
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "test_output",
    "arguments": {
      "channel": "debug",  // mcp, control, debug, error
      "message": "テスト出力"
    }
  },
  "id": 3
}
```

## 出力チャネル

### 1. MCP出力 (stdout)
JSON-RPC準拠のレスポンス
```json
{"jsonrpc":"2.0","result":{"content":[{"type":"text","text":"Echo: テスト"}]},"id":1}
```

### 2. Control出力 (stdout)
制御コマンドレスポンス
```
CTRL_RESPONSE:status:ok:{"mode":"production","uptime":123}
```

### 3. Debug出力 (stderr)
デバッグ情報（デバッグモード時のみ）
```
2025-08-09T07:30:00.000Z DEBUG [control] Processing command: status
```

### 4. Error出力 (stderr)
エラーメッセージ
```
2025-08-09T07:30:00.000Z ERROR [mcp] Tool call failed: invalid arguments
```

## ログシステム

### 設定プリセット

```typescript
import { LoggerPresets } from './src/mcp-debug/logger/index.js';

// MCPサーバー用（エラーのみ出力、ログ蓄積なし）
LoggerPresets.mcpServer();

// MCPサーバー用（ログ蓄積あり）
LoggerPresets.mcpServerWithAccumulation();

// デバッグ用（全ログ出力・蓄積）
LoggerPresets.debug();

// CLI用
LoggerPresets.cli();

// 静寂モード
LoggerPresets.quiet();
```

### ログ取得

```typescript
import { DebugLogManager } from './src/mcp-debug/logger/index.js';

const manager = DebugLogManager.getInstance();
const accumulator = manager.getAccumulator();

// ログエントリ取得
const entries = accumulator.getEntries({
  level: ['error', 'warn'],
  limit: 50,
  since: '2025-08-09T00:00:00Z'
});

// 統計情報取得
const stats = accumulator.getStats();
```

## 開発フロー

### 1. 新機能開発時

```bash
# 1. Echo Back サーバーで基本動作確認
echo 'CTRL:status' | node dist/mcp-debug/test/echo-server.js --debug

# 2. カスタムツールのテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":1}' | node dist/mcp-debug/test/echo-server.js

# 3. 統合テスト実行
node dist/mcp-debug/test/integration.test.js
```

### 2. デバッグ時

```bash
# デバッグモードで詳細ログを確認
node dist/mcp-debug/test/echo-server.js --debug

# 制御コマンドでリアルタイム状態確認
echo 'CTRL:logs:get:limit=10' | node dist/mcp-debug/test/echo-server.js
```

### 3. テスト作成時

統合テストを参考に新しいテストケースを作成：

```typescript
// src/mcp-debug/test/integration.test.ts を参考
private async testNewFeature(): Promise<TestResult> {
  const startTime = Date.now();
  this.clearOutput();

  try {
    // テストロジック
    await this.sendCommand('CTRL:new_command');
    
    // 結果検証
    const hasResponse = this.output.controlResponses.some(r => 
      r.includes('new_command:ok')
    );

    return {
      name: 'New Feature Test',
      success: hasResponse,
      message: hasResponse ? 'Success' : 'Failed',
      duration: Date.now() - startTime
    };
  } catch (error) {
    return {
      name: 'New Feature Test',
      success: false,
      message: `Test failed: ${(error as Error).message}`,
      duration: Date.now() - startTime
    };
  }
}
```

## トラブルシューティング

### よくある問題

1. **ESModule import エラー**
   - `.js` 拡張子が必要です
   - `import.meta.url` を `require.main` の代わりに使用

2. **ログが表示されない**
   - デバッグモード（`--debug`）で起動
   - ログレベルを確認

3. **テストタイムアウト**
   - サーバー起動を確認
   - `init:ok` メッセージを待機

4. **出力チャネルが分離されない**
   - OutputManagerの設定を確認
   - デバッグモードでチャネル出力をテスト

### ログ設定の調整

```typescript
import { DebugLogManager } from './src/mcp-debug/logger/index.js';

const manager = DebugLogManager.getInstance();
manager.configure({
  level: 'debug',          // 出力レベル
  accumulateLevel: 'info', // 蓄積レベル
  accumulate: true,        // 蓄積有効
  maxEntries: 2000        // 最大蓄積数
});
```

## パフォーマンス考慮事項

- **ログ蓄積**: 大量のログ出力時はメモリ使用量に注意
- **デバッグモード**: 本番環境では無効化
- **ストリーミング**: 不要なログストリームは破棄

## 拡張方法

### 新しい制御コマンド追加

1. `src/mcp-debug/control/commands.ts` に実装
2. `src/mcp-debug/control/handler.ts` にルーティング追加
3. テストケース作成

### 新しいMCPツール追加

1. Echo Backサーバーの `handleToolsList` にスキーマ追加
2. `handleToolsCall` に処理ロジック追加
3. 統合テストに検証ケース追加

この環境により、MCPサーバーの開発とデバッグが大幅に効率化されます。