# 開発テクニック・メモ

## MCP サーバー開発

### MCPサーバーの再起動方法

開発中にMCPサーバーの変更を反映させるには、Claude Codeで以下のコマンドを使用：

```bash
# 現在のMCPサーバーを削除
claude mcp remove coeiro-operator

# 再度MCPサーバーを追加（最新のコードで起動）
claude mcp add coeiro-operator
```

**利点：**
- プロセスの完全な再起動により、コード変更が確実に反映される
- キャッシュされた設定やモジュールがクリアされる
- 開発中のデバッグに有効

**使用タイミング：**
- TypeScriptファイルを変更した後
- 設定ファイル（.mcp.json等）を変更した後
- MCPツールの動作に問題がある場合
- モジュールの依存関係を変更した後

### 開発フロー例

```bash
# 1. コード修正
npm run build

# 2. MCPサーバー再起動
claude mcp remove coeiro-operator
claude mcp add coeiro-operator

# 3. 動作確認
# Claude Codeでoperator_assignやsayツールをテスト
```

この方法により、開発効率が大幅に向上し、変更の反映漏れを防ぐことができる。

## その他の開発テクニック

### ビルドとテストの自動化
```bash
# 変更検出とビルド
npm run build && npm run type-check && npm test
```

### デバッグ用ログ出力
MCPサーバーでは標準エラー出力がClaude Codeに表示されるため：
```typescript
console.error('デバッグ情報:', data);
```

### プロセス確認
```bash
# MCPサーバープロセスの確認
ps aux | grep "node dist/index.js"
```