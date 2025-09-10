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

### 📁 テストディレクトリ構成 (統合アーキテクチャ対応)

```
src/
├── core/                           # COEIRO Operatorコアテスト
│   ├── say/
│   │   ├── *.test.ts              # 単体テスト
│   │   ├── integration.test.ts    # 統合テスト
│   │   └── mcp-debug-enhanced.test.ts  # 🆕 mcp-debug統合テスト
│   └── operator/                   # 🔄 統合アーキテクチャ (2025年8月更新)
│       ├── index.test.ts          # 🆕 OperatorManager統合テスト
│       ├── character-info-service.test.ts  # キャラクター情報サービス
│       ├── config-manager.test.ts # 基本設定管理
│       ├── file-operation-manager.test.ts # 汎用KVストレージ + ロック機能
│       └── dynamic-config.test.ts # 動的設定・VoiceProvider統合
├── mcp/
│   └── server.test.ts             # MCPサーバーテスト
├── mcp-debug/                     # MCPデバッグ環境テスト
│   └── test/
│       ├── integration.test.ts    # Echo Backサーバーテスト
│       ├── jest-e2e.test.ts       # JSON-RPC処理テスト
│       ├── cli-wrapper.test.ts    # 🆕 CLIラッパーテスト
│       └── coeiro-operator-e2e.test.ts # 🆕 ターゲットサーバーラッパーテスト
└── utils/
    └── logger.test.ts             # ログシステムテスト
```

#### 統合アーキテクチャのテスト構成変更点
- **削除されたテスト**: 11ファイル → 5ファイル (55%削減)
  - 旧デバッグテスト、重複テスト、統合されたテストファイル
- **新構成**: ソースファイル1:1対応構成で管理性向上
- **統合テスト**: `index.test.ts` でOperatorManager全体機能をカバー

## 🚀 テスト実行方法

### 基本テスト実行

```bash
# 全テスト実行（分離された両プロジェクト）
npm run test:all

# COEIRO Operatorのみ
npm run test:coeiro

# MCPデバッグ環境のみ
npm run test:mcp-debug

# 従来方式（単一プロジェクト）
npm test
```

### カバレッジ付きテスト

```bash
# 分離されたプロジェクトでカバレッジ計測
npm run test:projects:coverage

# COEIRO Operatorのカバレッジ
npm run test:coeiro -- --coverage

# MCPデバッグ環境のカバレッジ
npm run test:mcp-debug -- --coverage
```

### 特定テストの実行

```bash
# mcp-debug統合機能を活用したCOEIRO Operatorテスト
npm run test:mcp-debug:enhanced

# 従来のe2eテスト
npm run test:e2e
```

## 🆕 mcp-debug統合テストの特徴

### COEIRO Operator統合テスト (`mcp-debug-enhanced.test.ts`)

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
   npm run test:mcp-debug:enhanced -- --testTimeout=30000
   ```

2. **ポート競合**
   ```bash
   # テスト前にプロセスを確認
   lsof -ti:50032 | xargs kill -9
   ```

3. **ビルドエラー**
   ```bash
   # ビルド後にテスト実行
   npm run build && npm run test:all
   ```

### デバッグモード

```bash
# 詳細ログでテスト実行
DEBUG=* npm run test:mcp-debug:enhanced

# 特定ファイルのみ
npm test src/core/say/mcp-debug-enhanced.test.ts -- --verbose
```

## 📈 パフォーマンス最適化

### テスト並列実行

```bash
# Jest並列実行（デフォルト）
npm run test:projects -- --maxWorkers=4

# 逐次実行（メモリ制約時）
npm run test:projects -- --runInBand
```

### CI/CD設定

```yaml
# GitHub Actions例
- name: Run separated tests
  run: |
    npm run test:coeiro
    npm run test:mcp-debug
    npm run test:mcp-debug:enhanced
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