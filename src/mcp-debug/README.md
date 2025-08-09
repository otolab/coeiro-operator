# MCP Debug Environment

MCPサーバーのテスト・デバッグ環境を提供するモジュール群です。将来的に独立したパッケージとして分離可能な設計になっています。

## ディレクトリ構成

```
src/mcp-debug/
├── server.ts                    # 拡張MCPサーバー（エントリーポイント）
├── control/                     # 制御機能
│   ├── handler.ts              # 制御コマンドハンドラー
│   ├── commands.ts             # コマンド定義・実装
│   └── types.ts               # 制御関連の型定義
├── logger/                      # ログ機能
│   ├── index.ts               # ログ機能（旧utils/logger.ts）
│   ├── accumulator.ts         # ログ蓄積・管理機能
│   └── types.ts              # ログ関連の型定義
├── output/                      # 出力管理
│   ├── manager.ts             # 出力管理システム
│   └── channels.ts           # 出力チャネル管理
└── test/                        # テスト関連
    ├── client.ts             # テストクライアント
    └── helpers.ts           # テストヘルパー
```

## 機能概要

### 制御コマンド（control/）
- `CTRL:status` - サーバー状況確認
- `CTRL:restart:graceful` - graceful restart
- `CTRL:mode:debug|production` - 動作モード切り替え
- `CTRL:logs:get|clear|stream` - ログ操作
- `CTRL:health` - ヘルスチェック

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

### テスト環境（test/）
- インタラクティブテストクライアント
- 自動テストスイート
- 負荷テスト機能

## 使用方法

### 基本的な起動
```bash
node dist/mcp-debug/server.js
```

### デバッグモードでの起動
```bash
node dist/mcp-debug/server.js --debug
```

### テストクライアントの使用
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