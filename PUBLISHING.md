# npm パッケージ公開手順

## 概要

coeiro-operatorは、npm workspacesを使用したモノレポ構成です。
複数の相互依存するパッケージから構成されており、適切な順序での公開が必要です。

## パッケージ構成

### 依存関係の階層

```
@coeiro-operator/common (依存なし)
    ↓
@coeiro-operator/term-bg (依存なし)
    ↓
@coeiro-operator/core (common, term-bgに依存)
    ↓
@coeiro-operator/audio (common, coreに依存)
    ↓
@coeiro-operator/cli (common, core, audioに依存)
@coeiro-operator/mcp (common, core, audioに依存)
    ↓
@coeiro-operator/mcp-debug (依存なし - 開発ツール)
```

## 公開前の準備

### 1. ビルドとテスト

```bash
# クリーンビルド
npm run build:all

# 全テストの実行
npm test

# E2Eテストの実行
npm run test:e2e
```

### 2. バージョンの確認

```bash
# 現在のバージョンを確認
npm run version:check

# バージョンを更新する場合（全パッケージ同時）
npm version patch --workspaces --no-git-tag-version
# または
npm version minor --workspaces --no-git-tag-version
# または
npm version major --workspaces --no-git-tag-version
```

### 3. npmレジストリへのログイン

```bash
npm login
```

## 公開方法

### オプション1: 一括公開（推奨）

依存関係を考慮して、npmが自動的に適切な順序で公開します：

```bash
# ドライラン（実際には公開しない）
npm run publish:dry

# 実際に公開
npm run publish:all
```

### オプション2: 個別公開（依存順）

依存関係に問題がある場合は、以下の順序で個別に公開：

```bash
# 1. 依存関係がないパッケージ
npm publish -w @coeiro-operator/common --access public
npm publish -w @coeiro-operator/term-bg --access public

# 2. coreパッケージ
npm publish -w @coeiro-operator/core --access public

# 3. audioパッケージ
npm publish -w @coeiro-operator/audio --access public

# 4. CLIとMCPパッケージ
npm publish -w @coeiro-operator/cli --access public
npm publish -w @coeiro-operator/mcp --access public

# 5. 開発ツール（オプション）
npm publish -w @coeiro-operator/mcp-debug --access public
```

### オプション3: メインパッケージのみ公開

エンドユーザー向けにメインパッケージのみを公開する場合：

```bash
# メインパッケージを公開
npm publish --access public
```

## 公開後の確認

### 1. npmレジストリでの確認

```bash
# 公開されたパッケージの確認
npm view @coeiro-operator/common
npm view @coeiro-operator/core
npm view @coeiro-operator/audio
npm view @coeiro-operator/cli
npm view @coeiro-operator/mcp
npm view @coeiro-operator/term-bg
npm view @coeiro-operator/mcp-debug
```

### 2. インストールテスト

```bash
# 新しいディレクトリでインストールテスト
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install coeiro-operator

# または個別パッケージ
npm install @coeiro-operator/mcp
```

## トラブルシューティング

### 公開エラーが発生した場合

1. **認証エラー**: `npm login`を再実行
2. **権限エラー**: パッケージ名が既に使用されていないか確認
3. **依存関係エラー**: 内部パッケージのバージョンが正しく設定されているか確認

### バージョン管理

- すべてのパッケージは同じバージョン番号を維持することを推奨
- 内部依存関係は`^1.0.0`形式で指定（メジャーバージョンの互換性を保証）

## リリースフロー

1. featureブランチで開発
2. mainブランチにマージ
3. release/x.x.xブランチを作成
4. バージョン番号を更新
5. ビルドとテストを実行
6. npmに公開
7. GitHubでリリースタグを作成

## 注意事項

- **初回公開時**: すべてのスコープ付きパッケージに`--access public`が必要
- **依存順序**: 内部パッケージの依存関係を考慮した順序での公開が重要
- **ドライラン**: 本番公開前に必ず`--dry-run`で確認

## 関連コマンド

```bash
# パッケージ情報の確認
npm ls --workspaces

# 依存関係の確認
npm explain <package-name>

# パッケージのアンパブリッシュ（72時間以内のみ）
npm unpublish <package-name>@<version>
```