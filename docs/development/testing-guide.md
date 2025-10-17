# Testing Guide

COEIRO Operatorプロジェクトのテスト構成とmcp-debug統合テストのガイドです。

## 🔗 関連ドキュメント

- [`docs/test-quality-guidelines.md`](./test-quality-guidelines.md) - テスト品質の基本原則とチェックリスト
- [`docs/development-tips.md`](./development-tips.md) - 開発プロセス全般

## テスト構成

### 🏗️ テスト分離アーキテクチャ

プロジェクトは2つの独立したテストスイートに分離されています：

1. **COEIRO Operator Core Tests**: メインのCOEIRO Operator機能のテスト
2. **MCP Debug Environment Tests**: MCPデバッグ環境自体のテスト

### 📁 テストディレクトリ構成

```
packages/
├── audio/src/
│   ├── *.test.ts                  # 音声処理テスト
│   └── integration.test.ts        # 統合テスト
├── core/src/
│   └── operator/
│       ├── index.test.ts          # OperatorManagerテスト
│       ├── character-info-service.test.ts  # キャラクター情報
│       ├── config-manager.test.ts # 設定管理
│       ├── file-operation-manager.test.ts # KVストレージ
│       └── dynamic-config.test.ts # 動的設定
├── mcp/src/
│   └── server.test.ts             # MCPサーバーテスト
├── mcp-debug/src/test/
│   ├── integration.test.ts        # Echo Backサーバー
│   ├── jest-e2e.test.ts           # JSON-RPC処理
│   ├── cli-wrapper.test.ts        # CLIラッパー
│   └── coeiro-operator-e2e.test.ts # 統合E2E
└── common/src/
    └── logger.test.ts             # ログシステム
```


## 🚀 テスト実行方法

### 基本テスト実行

```bash
# 全テスト実行（分離された両プロジェクト）
pnpm test:all

# COEIRO Operatorのみ
pnpm test:coeiro

# MCPデバッグ環境のみ
pnpm test:mcp-debug

# 従来方式（単一プロジェクト）
pnpm test
```

### 📢 テスト出力制御

テストはデフォルトでサイレントモード（最小限の出力）で実行されます。詳細な出力が必要な場合は環境変数 `TEST_VERBOSE` を使用します。

```bash
# サイレントモード（デフォルト）
pnpm test

# 詳細モード（個別テストとログ出力を表示）
TEST_VERBOSE=true pnpm test

# 特定パッケージの詳細出力
TEST_VERBOSE=true pnpm test:audio
```

#### 出力モードの違い

| モード | 環境変数 | 出力内容 |
|---|---|---|
| サイレント | 未設定または `TEST_VERBOSE=false` | テストファイル名と総計のみ |
| 詳細 | `TEST_VERBOSE=true` | 個別テスト名、実行時間、ログ出力 |

#### パッケージごとの設定

各パッケージの `package.json` で `test` スクリプトに `--silent` オプションが設定されています：

```json
{
  "scripts": {
    "test": "vitest --silent",
    "test:watch": "vitest --watch"
  }
}
```

### カバレッジ付きテスト

```bash
# 分離されたプロジェクトでカバレッジ計測
pnpm test:projects:coverage

# COEIRO Operatorのカバレッジ
pnpm test:coeiro -- --coverage

# MCPデバッグ環境のカバレッジ
pnpm test:mcp-debug -- --coverage
```

### 特定テストの実行

```bash
# mcp-debug統合機能を活用したCOEIRO Operatorテスト
pnpm test:mcp-debug:enhanced

# 従来のe2eテスト
pnpm test:e2e
```

## 🆕 mcp-debug統合テストの特徴

### COEIRO Operator統合テスト

**新機能**: 実際のCOEIRO Operator MCPサーバーをmcp-debugの統合機能で制御してテスト

```typescript
// 使用例
await testRunner.startCOEIROOperatorWithDebug(['--auto-reload']);
await testRunner.sendControlCommand('CTRL:target:restart');
```

**テストカバレッジ**:
- ✅ 統合デバッグ環境での起動・制御
- ✅ ターゲットサーバーの再起動・ヘルスチェック
- ✅ オペレータ機能の統合テスト
- ✅ 動的再読み込み機能のテスト
- ✅ エラー処理とレジリエンス
- ✅ パフォーマンス監視

### MCPデバッグ環境テスト

**対象**: mcp-debug統合環境自体の機能テスト

- **CLIラッパーテスト** (`cli-wrapper.test.ts`): `mcp-debug <target>.ts` の動作
- **Echo Backサーバーテスト** (`integration.test.ts`): JSON-RPC処理
- **出力チャネル分離テスト** (`jest-e2e.test.ts`): MCP/Control/Debug分離

## 📊 テスト実行時間

| テストスイート | 実行時間目安 | 特徴 |
|---|---|---|
| COEIRO Operator Core | 30-60秒 | 単体・統合テスト |
| MCP Debug Enhanced | 60-120秒 | 実サーバー統合テスト |
| MCP Debug Environment | 30-90秒 | デバッグ環境自体のテスト |

## 🛠️ テスト開発ガイドライン

### COEIRO Operatorのテスト作成

```typescript
// ❌ 従来方式（直接実行）
const serverProcess = spawn('node', ['dist/mcp/server.js']);

// ✅ 推奨方式（mcp-debug統合）
const testRunner = new CoeirocoperatorMCPDebugTestRunner();
await testRunner.startCOEIROOperatorWithDebug(['--debug']);
```

### MCPデバッグ環境のテスト作成

```typescript
// Echo Backサーバーを使用したテスト
const testRunner = new McpE2ETestRunner();
await testRunner.startEchoServer(true); // デバッグモード
```

## 🔧 トラブルシューティング

### よくある問題

1. **テストタイムアウト**
   ```bash
   # より長いタイムアウトで実行
   pnpm test:mcp-debug:enhanced -- --testTimeout=30000
   ```

2. **ポート競合**
   ```bash
   # テスト前にプロセスを確認
   lsof -ti:50032 | xargs kill -9
   ```

3. **ビルドエラー**
   ```bash
   # ビルド後にテスト実行
   pnpm build && pnpm test:all
   ```

### デバッグモード

```bash
# 詳細ログでテスト実行
DEBUG=* pnpm test:mcp-debug:enhanced

# TEST_VERBOSEと組み合わせて使用
TEST_VERBOSE=true DEBUG=* pnpm test

# 特定ファイルのみ
pnpm test src/core/say/mcp-debug-enhanced.test.ts -- --verbose

# Vitestのレポーター指定（TEST_VERBOSEを上書き）
pnpm test -- --reporter=verbose
```

## 📈 パフォーマンス最適化

### テスト並列実行

```bash
# Jest並列実行（デフォルト）
pnpm test:projects -- --maxWorkers=4

# 逐次実行（メモリ制約時）
pnpm test:projects -- --runInBand
```

### CI/CD設定

```yaml
# GitHub Actions例
- name: Run separated tests
  run: |
    pnpm test:coeiro
    pnpm test:mcp-debug
    pnpm test:mcp-debug:enhanced
```

## 🎯 メリット

### テスト分離による利点

- 🚀 **開発効率**: 関心のあるテストのみ実行可能
- 🔍 **デバッグ容易性**: 問題の切り分けが簡単
- 📊 **カバレッジ精度**: 各コンポーネントの品質可視化
- ⚡ **CI最適化**: 並列実行による時間短縮

### mcp-debug統合の利点

- 🎮 **リアルタイム制御**: 実サーバーの動的操作
- 🔄 **ライブリロード**: ファイル変更の即座反映
- 📈 **詳細監視**: パフォーマンス・ログの統合収集
- 🛡️ **レジリエンステスト**: エラー処理の包括的検証

このテスト構成により、**COEIRO Operatorの品質保証とmcp-debugの開発効率**が大幅に向上します。