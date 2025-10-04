# mcp-debug ドキュメント

MCPサーバー開発のためのデバッグツールとプロトコル仕様に関するドキュメント集です。

## 📚 ドキュメント一覧

### [MCP プロトコル仕様](./mcp-protocol-specification.md)
MCPプロトコルの詳細仕様と実装ガイド：
- JSON-RPC 2.0ベースのメッセージ形式
- 初期化シーケンス
- ライフサイクル管理
- エラーハンドリング
- 実装チェックリスト

### [テスト機能](./testing-features.md)
mcp-debugが提供する包括的なテスト機能：
- プロトコル準拠性テスト
- リクエスト/レスポンス相関テスト
- 状態管理テスト
- エラーハンドリングテスト
- パフォーマンステスト
- CI/CD統合

### [アーキテクチャ設計](./architecture.md)
mcp-debugの内部設計と実装詳細：
- コンポーネント設計（StateManager、RequestTracker等）
- データフロー
- エラーハンドリング戦略
- 並行性と同期
- メモリ管理
- 拡張性とテスタビリティ

### [E2Eテストモード](./e2e-testing.md)
プログラマティックなMCPサーバーテスト：
- MCPServiceE2ETesterクラス
- withMCPServerヘルパー
- E2EAssertionsアサーション
- 並行実行サポート
- Jestとの統合
- CI/CDでの使用例

## 🚀 クイックスタート

### 基本的な使い方

```bash
# MCPサーバーのテスト（非インタラクティブ）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"tool_name","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# インタラクティブモード
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js

# デバッグモード
node dist/mcp-debug/cli.js --debug dist/mcp/server.js
```

### E2Eテストモード（プログラマティック）

```typescript
import { withMCPServer } from 'coeiro-operator/mcp-debug';

await withMCPServer(
  { serverPath: 'dist/mcp/server.js' },
  async (tester) => {
    const result = await tester.callTool('operator_status');
    console.log(result);
  }
);
```

### Echo Serverでの練習

```bash
# Echo Serverでプロトコルの動作を確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js
```

## 開発者向け情報

### なぜmcp-debugが必要か

Claude CodeのMCPサーバー実行には、開発時に問題となる重要な特性があります。

Claude Codeは起動時にMCPサーバーを一度だけロードし、そのコードをメモリにキャッシュします。これは本番環境では効率的ですが、開発中は以下の問題を引き起こします：

- コードを編集して`pnpm build`を実行しても、変更が反映されない
- `mcp__`プレフィックスのツールは常にキャッシュされた古いコードを実行する
- 変更を反映させるにはClaude Code全体を再起動する必要がある

mcp-debugはこの問題を解決するために作られました：

1. **キャッシュ問題の回避**
   - 毎回新しいプロセスとして起動するため、最新のビルド結果を実行
   - Claude Codeの再起動が不要

2. **開発効率の向上**
   - コード編集 → ビルド → 即テストのサイクルが可能
   - 変更の即座の確認

3. **デバッグ支援**
   - stderrログの表示
   - プロトコル準拠の検証
   - 状態遷移の追跡

### v2アーキテクチャの利点

旧実装の問題点を解決：

| 旧実装 | v2実装 |
|-------|--------|
| 1秒の固定待機 | イベントベースの待機 |
| Fire-and-forget | async/awaitパターン |
| ID相関なし | RequestTrackerによる管理 |
| 責務混在 | 明確な責務分離 |
| 状態管理なし | StateManagerによる管理 |

## 📖 関連ドキュメント

- [mcp-debug-guide.md](./mcp-debug-guide.md) - 基本的な使用ガイド
- [../../src/mcp-debug/README.md](../../src/mcp-debug/README.md) - 実装の詳細
- [MCP公式仕様](https://modelcontextprotocol.io/specification) - プロトコル仕様

## 🔍 トラブルシューティング

問題が発生した場合は、以下を確認してください：

1. **デバッグログの確認**
   ```bash
   node dist/mcp-debug/cli.js --debug dist/mcp/server.js 2>debug.log
   ```

2. **状態遷移の追跡**
   ```bash
   grep "State transition" debug.log
   ```

3. **タイムアウトの調整**
   ```bash
   --timeout 60000        # プロセス起動タイムアウト
   --request-timeout 30000 # リクエストタイムアウト
   ```

## 📝 貢献

mcp-debugの改善に貢献する場合：

1. アーキテクチャ設計書を確認
2. テスト機能でテストを実行
3. プロトコル仕様に準拠した実装

詳細は[architecture.md](./architecture.md)を参照してください。