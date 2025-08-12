# MCPデバッグ環境ガイド

MCPサーバーの開発・デバッグを効率化するための統合デバッグ環境の使用方法について説明します。

## 概要

MCPデバッグ環境は以下の機能を提供します：

- **mcp-debug CLI** - ターゲットサーバー制御・リロード機能
- **子プロセス制御** - ターゲットサーバーを子プロセスとして管理・タイムアウト制御
- **制御コマンド処理** - `CTRL:` プレフィックスでのサーバー制御（mcp-debugが処理）
- **オプション分離** - `--` 区切りでmcp-debugと子プロセスのオプションを分離
- **出力チャネル分離** - MCP/Control/Debug/Error出力の分離
- **ログ蓄積機能** - デバッグ用ログの蓄積と取得
- **Echo Back MCPサーバー** - テスト用の純粋なMCPエコーバックサーバー
- **統合テストシステム** - 自動化されたテストスイート

## アーキテクチャ

```
[mcp-debug CLI] 
    ↓ 子プロセス起動・制御
[ターゲットサーバー（例：echo-server）]

- 制御コマンド（CTRL:*）→ mcp-debugが処理
- JSON-RPC・その他 → ターゲットサーバーに転送
```

**重要**: 制御コマンド（`CTRL:` プレフィックス）はmcp-debugが処理するため、ターゲットサーバーには届きません。ターゲットサーバーは純粋なMCPサーバーとして動作します。

## mcp-debug CLIの使用方法

### 基本的な使用方法

```bash
# 基本的な使用方法
node dist/mcp-debug/cli.js <target-server-file> [options] [-- <child-options>...]

# COEIRO OperatorのMCPサーバーをデバッグ（インタラクティブモード）
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug

# 自動リロード機能付きで起動
node dist/mcp-debug/cli.js --auto-reload dist/mcp/server.js -- --debug

# 子プロセスにオプションを渡す（'--'で区切り）
node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js -- --debug

# タイムアウト付きで起動（10秒後に自動終了）
node dist/mcp-debug/cli.js --timeout 10000 dist/mcp/server.js

# テスト用途での短時間実行（推奨）
node dist/mcp-debug/cli.js --timeout 10000 dist/mcp/server.js
```

### オプション

| オプション | 説明 |
|-----------|------|
| `--debug, -d` | デバッグモード（詳細ログ出力） |
| `--auto-reload, -r` | ファイル変更時の自動リロード |
| `--watch-path <path>` | 監視するパス（デフォルト：サーバーファイルのディレクトリ） |
| `--interactive, -i` | インタラクティブモード |
| `--timeout <ms>` | 子プロセス寿命タイムアウト（ミリ秒、デフォルト: 30000）**※テスト・デバッグ時は10000推奨** |
| `--command-timeout <ms>` | 制御コマンドタイムアウト（ミリ秒、デフォルト: 10000） |
| `--help, -h` | ヘルプ表示 |

### 子プロセスオプション分離

`--` を使用してmcp-debugのオプションと子プロセス向けオプションを分離できます：

```bash
# mcp-debugのタイムアウト vs 子プロセスのタイムアウト
node dist/mcp-debug/cli.js --timeout 10000 echo-server.js -- --timeout 5000

# 説明:
# --timeout 10000  → mcp-debugが子プロセスを10秒で終了
# -- --timeout 5000 → echo-serverが内部タイムアウトに5秒を使用
```

### インタラクティブモードでの制御

```bash
# インタラクティブモードで起動（子プロセスはデバッグモードなし）
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# または子プロセスでもデバッグモード有効
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug

# 利用可能なコマンド（プロンプトで入力）
status          # ターゲットサーバーの状態確認
restart         # ターゲットサーバーの再起動
help           # 全コマンドのヘルプ
clear          # 画面クリア
exit/quit/q    # CLI終了

# 制御コマンド直接実行
CTRL:target:status      # サーバー状態詳細
CTRL:target:restart     # サーバー再起動
CTRL:target:reload      # リロード＋再起動
CTRL:logs:stats        # ログ統計
```

## 開発Tips

### timeoutコマンドの代替として--timeoutオプションを使用

従来の`timeout`コマンドの代わりに、mcp-debugの`--timeout`オプションを使用できます：

```bash
# ❌ 従来の方法（timeoutコマンド使用）
timeout 10s node dist/mcp-debug/cli.js dist/mcp/server.js

# ✅ 推奨方法（--timeoutオプション使用）
node dist/mcp-debug/cli.js --timeout 10000 dist/mcp/server.js

# ✅ コマンド送信も同様
echo 'CTRL:target:status' | node dist/mcp-debug/cli.js --timeout 10000 dist/mcp/server.js
```

**利点:**
- プラットフォーム非依存（Windows/Mac/Linux対応）
- より正確なタイムアウト制御
- graceful shutdownサポート
- ログ保持オプション

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

**重要**: Echo Back MCPサーバーは純粋なMCPサーバーです。制御コマンド（`CTRL:` プレフィックス）には対応しておらず、これらはmcp-debug CLIが処理します。

### 推奨起動方法（mcp-debug経由）

```bash
# mcp-debug経由での起動（推奨）
node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js

# デバッグモード付き
node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js -- --debug

# 短時間実行（10秒で自動終了、timeoutコマンド不要）
node dist/mcp-debug/cli.js --timeout 10000 dist/mcp-debug/test/echo-server.js

# 制御コマンドのテスト
echo 'CTRL:target:status' | node dist/mcp-debug/cli.js --timeout 10000 dist/mcp-debug/test/echo-server.js
```

### 直接起動（非推奨）

```bash
# 直接起動（制御コマンドは使用不可）
node dist/mcp-debug/test/echo-server.js

# デバッグモード（詳細ログ出力）
node dist/mcp-debug/test/echo-server.js --debug
```

**注意**: 直接起動した場合、制御コマンド機能は利用できません。

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

### ログシステムの詳細

#### ログレベル階層
```
quiet (0) < error (1) < warn (2) < info (3) < verbose (4) < debug (5)
```

#### プリセット設定詳細

| プリセット | 出力レベル | 蓄積レベル | 蓄積有効 | MCPモード | 用途 |
|-----------|------------|------------|----------|-----------|------|
| `mcpServer` | error | error | ❌ | ✅ | 本番MCPサーバー |
| `mcpServerWithAccumulation` | error | debug | ✅ | ✅ | デバッグ対応MCPサーバー |
| `cli` | info | info | ❌ | ❌ | CLIツール |
| `debug` | debug | debug | ✅ | ❌ | 開発・デバッグ |
| `quiet` | quiet | quiet | ❌ | ✅ | 静寂モード |

#### プログラマティック使用

```typescript
import { 
  DebugLogManager, 
  LoggerPresets, 
  getLogger 
} from './src/mcp-debug/logger/index.js';

// 1. プリセット設定
LoggerPresets.debug(); // デバッグモード有効

// 2. ロガー取得
const logger = getLogger('my-service');

// 3. ログ出力
logger.info('サービス開始', { port: 3000 });
logger.debug('デバッグ情報', { state: 'processing' });
logger.error('エラー発生', { error: new Error('Something went wrong') });

// 4. コンテキスト付きログ
const contextLogger = logger.withContext({ 
  requestId: 'req-123',
  userId: 'user-456' 
});
contextLogger.info('Request processed');
```

#### ログ取得・管理

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
console.log('Total entries:', stats.totalEntries);
console.log('By level:', stats.entriesByLevel);

// リアルタイムストリーミング
const streamId = accumulator.createStream(
  { level: ['error'] },
  (entry) => console.log('Real-time error:', entry.message)
);

// ストリーム停止
accumulator.destroyStream(streamId);
```

#### MCPツールでのログ取得

```bash
# ログエントリ取得
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_info","arguments":{"type":"logs"}},"id":1}' | node dist/mcp-debug/test/echo-server.js

# 統計情報取得
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_info","arguments":{"type":"stats"}},"id":2}' | node dist/mcp-debug/test/echo-server.js

# 制御コマンドでログ操作
echo 'CTRL:logs:stats' | node dist/mcp-debug/test/echo-server.js
echo 'CTRL:logs:get:limit=10:level=error,warn' | node dist/mcp-debug/test/echo-server.js
echo 'CTRL:logs:clear' | node dist/mcp-debug/test/echo-server.js
```

## 開発フロー

### 1. mcp-debug CLIを使った新機能開発（推奨）

```bash
# 1. 自動リロード付きでサーバー起動
node dist/mcp-debug/cli.js --auto-reload --interactive dist/mcp/server.js -- --debug

# 2. インタラクティブモードで開発・テスト
> status              # 現在の状態確認
> restart             # 変更後の再起動
> CTRL:logs:stats     # ログ統計確認
> exit                # 終了

# 3. ファイル変更時は自動的にリロード
# → コード修正 → 自動リロード → すぐにテスト可能
```

### 2. Echo Backサーバーを使った基本動作確認

```bash
# 1. Echo Back サーバーで基本動作確認
echo 'CTRL:status' | node dist/mcp-debug/test/echo-server.js --debug

# 2. カスタムツールのテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":1}' | node dist/mcp-debug/test/echo-server.js

# 3. 統合テスト実行
node dist/mcp-debug/test/integration.test.js
```

### 3. 従来のデバッグ手法

```bash
# デバッグモードで詳細ログを確認
node dist/mcp/server.js --debug

# 制御コマンドでリアルタイム状態確認（非対応）
# Echo Backサーバーで代替：
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
   - `--timeout` オプションで子プロセス寿命を調整

4. **制御コマンドが届かない**
   - echo-serverには制御コマンドは届きません（仕様です）
   - 制御コマンドはmcp-debug CLIが処理します
   - 直接echo-serverを起動している場合はmcp-debug経由で起動してください

5. **出力チャネルが分離されない**
   - mcp-debug経由で起動していることを確認
   - デバッグモードでチャネル出力をテスト

6. **子プロセスオプションが効かない**
   - `--` でmcp-debugと子プロセスのオプションを分離してください
   - 例: `node dist/mcp-debug/cli.js server.js -- --child-option`

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

## 既存MCPサーバーへの適用

### COEIRO Operator MCPサーバーでの使用例

```typescript
import { LoggerPresets, getLogger } from './src/mcp-debug/logger/index.js';

// MCPサーバー起動時
LoggerPresets.mcpServerWithAccumulation(); // デバッグ対応
const logger = getLogger('coeiro-mcp');

// 音声合成処理での使用
logger.info('音声合成開始', { text: message, style: selectedStyle });
logger.debug('設定情報', { splitMode, bufferSize });

// エラー処理
try {
  await synthesizeText(text);
  logger.info('音声合成完了');
} catch (error) {
  logger.error('音声合成失敗', { error, text });
}
```

### 制御コマンドでのリアルタイム監視

```bash
# MCPサーバー状態確認
echo 'CTRL:status' | node dist/mcp/server.js

# 音声合成ログの確認
echo 'CTRL:logs:get:limit=20:level=info,error' | node dist/mcp/server.js

# エラーログのみ表示
echo 'CTRL:logs:get:level=error' | node dist/mcp/server.js
```

### デバッグツールの統合

MCPツールとして `debug_logs` を追加することで、Claude Code から直接ログにアクセス可能：

```typescript
// Claude Code からの呼び出し例
// MCP Tool: debug_logs
// Parameters: { action: "get", level: ["error", "warn"], limit: 50 }
```

## 実用的なデバッグワークフロー

### 1. mcp-debug CLIを使ったデバッグ

#### インタラクティブデバッグ（推奨）

```bash
# ステップ1: インタラクティブモードでmcp-debug CLI起動
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug

# ステップ2: インタラクティブコマンドでサーバー制御
> status                    # サーバー状態確認
> CTRL:target:restart      # サーバー再起動
> CTRL:logs:stats         # ログ統計表示
> exit                     # CLI終了
```

#### 自動リロード開発ワークフロー

```bash
# ファイル変更時に自動リロードでデバッグ
node dist/mcp-debug/cli.js dist/mcp/server.js --debug --auto-reload --watch-path ./src

# ソースファイル変更 → 自動リロード → すぐにテスト
# 開発効率が大幅に向上
```

#### タイムアウト制御とオプション分離

```bash
# 子プロセス寿命を制御（30秒でタイムアウト）
node dist/mcp-debug/cli.js --timeout 30000 dist/mcp/server.js

# mcp-debugと子プロセスのオプションを分離
node dist/mcp-debug/cli.js --debug --timeout 60000 dist/mcp/server.js -- --config custom.json

# echo-serverでのテスト例
node dist/mcp-debug/cli.js --interactive dist/mcp-debug/test/echo-server.js -- --debug
```

### 2. 従来の音声合成デバッグワークフロー

```bash
# ステップ1: デバッグモードでMCPサーバー起動
node dist/mcp/server.js --debug

# ステップ2: オペレータ割り当て
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{"operator":"ai_shuka"}},"id":1}' | node dist/mcp/server.js --debug

# ステップ3: 並行生成状態確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"parallel_generation_control","arguments":{"action":"status"}},"id":2}' | node dist/mcp/server.js --debug

# ステップ4: 音声合成テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"デバッグテストです。"}},"id":3}' | node dist/mcp/server.js --debug

# ステップ5: ログ統計確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_logs","arguments":{"action":"stats"}},"id":4}' | node dist/mcp/server.js --debug
```

### 2. 並行生成パフォーマンステスト

```bash
# 逐次生成でのベースライン測定
echo '{"name":"parallel_generation_control","arguments":{"action":"disable"}}' | node dist/mcp/server.js --debug
echo '{"name":"say","arguments":{"message":"パフォーマンステスト用の長いテキストです。複数の文を含んでいます。..."}}' | node dist/mcp/server.js --debug

# 並行生成での改善効果確認
echo '{"name":"parallel_generation_control","arguments":{"action":"enable"}}' | node dist/mcp/server.js --debug
echo '{"name":"say","arguments":{"message":"パフォーマンステスト用の長いテキストです。複数の文を含んでいます。..."}}' | node dist/mcp/server.js --debug

# 統計比較
echo '{"name":"parallel_generation_control","arguments":{"action":"status"}}' | node dist/mcp/server.js --debug
```

### 3. Echo Back MCPサーバーでの基本テスト

**重要**: echo-serverは純粋なMCPサーバーのため、mcp-debug経由でテストしてください。

```bash
# mcp-debug経由でのEcho Backサーバー動作確認（推奨）
node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js -- --debug

# 制御コマンドテスト（mcp-debugが処理）
echo 'CTRL:target:status' | node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js

# JSON-RPCツールテスト（echo-serverが処理）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"テスト"}},"id":1}' | node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js

# 非推奨：直接起動（制御コマンド機能なし）
# node dist/mcp-debug/test/echo-server.js --debug
```

### 4. 自動統合テスト

```bash
# 包括的なMCPデバッグテスト
node dist/mcp-debug/test/integration.test.js

# COEIRO Operator統合テスト
./test-coeiro-mcp-debug.sh
```

### 5. トラブルシューティング手順

#### 音声が再生されない場合
```bash
# 1. サーバー接続確認
echo '{"name":"operator_status","arguments":{}}' | node dist/mcp/server.js --debug

# 2. オペレータ確認
echo '{"name":"operator_available","arguments":{}}' | node dist/mcp/server.js --debug

# 3. デバッグログ確認
echo '{"name":"debug_logs","arguments":{"action":"get","level":["error","warn"],"limit":10}}' | node dist/mcp/server.js --debug
```

#### 並行生成が動作しない場合
```bash
# 1. 現在の設定確認
echo '{"name":"parallel_generation_control","arguments":{"action":"status"}}' | node dist/mcp/server.js --debug

# 2. 有効化
echo '{"name":"parallel_generation_control","arguments":{"action":"enable"}}' | node dist/mcp/server.js --debug

# 3. 複数チャンクテスト
echo '{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。これは三番目の文です。"}}' | node dist/mcp/server.js --debug
```

## 拡張方法

### 新しい制御コマンド追加

1. `src/mcp-debug/control/commands.ts` に実装
2. `src/mcp-debug/control/handler.ts` にルーティング追加
3. テストケース作成

### 新しいMCPツール追加

1. Echo Backサーバーの `handleToolsList` にスキーマ追加
2. `handleToolsCall` に処理ロジック追加
3. 統合テストに検証ケース追加

### 既存MCPサーバーでの段階的導入

1. **ログシステムのみ導入**
   ```typescript
   import { LoggerPresets } from './src/mcp-debug/logger/index.js';
   LoggerPresets.mcpServerWithAccumulation();
   ```

2. **制御コマンド追加**
   ```typescript
   import { ControlHandler } from './src/mcp-debug/control/handler.js';
   const controlHandler = new ControlHandler();
   ```

3. **デバッグツール統合**
   ```typescript
   // debug_logs ツールをMCPツールリストに追加
   ```

この環境により、MCPサーバーの開発とデバッグが大幅に効率化されます。