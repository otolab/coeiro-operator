# MCP Debug Environment

MCPサーバーのテスト・デバッグ環境を提供するモジュール群です。**テスト対象のMCPサーバーコードを内部から呼び出し、制御コマンドでコントロールしたり、ログ収集を行うことで、効率的なテスト・デバッグ**を実現します。

## ディレクトリ構成

```
src/mcp-debug/
├── cli.ts                       # CLIインターフェース（エントリーポイント）
├── wrapper/                     # ターゲットサーバー統合機能
│   ├── target-server-wrapper.ts  # テスト対象サーバーラッパー
│   └── module-reloader.ts        # 動的モジュール再読み込み（rewire代替）
├── control/                     # 制御機能
│   ├── handler.ts              # 制御コマンドハンドラー
│   ├── commands.ts             # 基本コマンド定義・実装
│   ├── target-server-commands.ts # ターゲットサーバー専用コマンド
│   └── types.ts               # 制御関連の型定義
├── logger/                      # ログ機能
│   ├── index.ts               # ログ機能（旧utils/logger.ts）
│   ├── accumulator.ts         # ログ蓄積・管理機能
│   └── types.ts              # ログ関連の型定義
├── output/                      # 出力管理
│   ├── manager.ts             # 出力管理システム
│   └── channels.ts           # 出力チャネル管理
├── server.ts                    # 従来の独立MCPサーバー（非推奨）
└── test/                        # テスト関連
    ├── client.ts             # テストクライアント
    └── helpers.ts           # テストヘルパー
```

## 機能概要

### ✨ 新機能：ターゲットサーバー統合（wrapper/）
- **内部からの制御**: テスト対象MCPサーバーを内部から起動・制御
- **動的再読み込み**: ファイル変更時の自動再読み込み（rewire代替）
- **標準入出力キャプチャ**: MCPメッセージ・エラーログの分離収集
- **ライブデバッグ**: リアルタイムでのサーバー状態監視

### 制御コマンド（control/）
#### 基本制御コマンド
- `CTRL:status` - サーバー状況確認
- `CTRL:restart:graceful` - graceful restart
- `CTRL:mode:debug|production` - 動作モード切り替え
- `CTRL:logs:get|clear|stream` - ログ操作
- `CTRL:health` - ヘルスチェック

#### ターゲットサーバー専用コマンド
- `CTRL:target:status` - ターゲットサーバーの詳細状況
- `CTRL:target:start|stop|restart` - ターゲットサーバーの制御
- `CTRL:target:reload` - モジュール再読み込み
- `CTRL:target:watch:start|stop` - ファイル監視制御
- `CTRL:target:send:command` - カスタムコマンド送信

### ログ機能（logger/）
- 全レベルのログ蓄積（MCPモード対応）
- リアルタイムログストリーミング
- フィルタリング・検索機能
- メモリ効率的な管理

### 出力管理（output/）
- MCP Response（JSON-RPC）
- Control Response（制御応答）
- Debug Output（デバッグ出力）
- チャネル分離による競合回避

## 使用方法

### 🚀 推奨：CLIインターフェース

#### 基本的な起動
```bash
# COEIRO Operator MCPサーバーをテスト
node dist/mcp-debug/cli.js ./dist/mcp/server.js

# TypeScriptファイルも直接指定可能
node dist/mcp-debug/cli.js ./src/mcp/server.ts
```

#### デバッグモード + 自動リロード
```bash
# ファイル変更時の自動再読み込み有効
node dist/mcp-debug/cli.js ./src/mcp/server.ts --debug --auto-reload

# カスタム監視パスを指定
node dist/mcp-debug/cli.js ./src/mcp/server.ts --auto-reload --watch-path ./src
```

#### 使用例
```bash
# インタラクティブモードでCOEIRO Operatorをテスト
node dist/mcp-debug/cli.js ./dist/mcp/server.js --debug --auto-reload

# 起動後の操作例
> status                    # ターゲットサーバーの状態確認
> restart                   # ターゲットサーバーの再起動
> CTRL:target:reload        # モジュール再読み込み
> CTRL:logs:get:limit=10    # 最新10件のログ取得
> help                      # 全コマンド一覧
> exit                      # 終了
```

### 従来方式（非推奨）

#### 独立MCPサーバー
```bash
node dist/mcp-debug/server.js
node dist/mcp-debug/server.js --debug
```

#### テストクライアント
```bash
node dist/mcp-debug/test/client.js --interactive
```

## 分離可能性

このモジュールは以下の方針で設計されており、将来的に独立パッケージとして分離可能です：

1. **依存関係の最小化**: 外部依存を最小限に抑制
2. **インターフェース分離**: 明確なAPI境界の定義
3. **設定の外部化**: 設定ファイルによる動作制御
4. **プラグイン対応**: 機能の拡張・カスタマイズ

## 技術仕様

- TypeScript対応
- Node.js stdin/stdout ベースの通信
- JSON-RPCプロトコル準拠
- メモリ効率的なログ管理
- graceful shutdown対応