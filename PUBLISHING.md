# npm パッケージ公開手順

## 概要

coeiro-operatorは、npm workspacesを使用したモノレポ構成です。
Changesetを使用して各パッケージのバージョンを個別に管理し、GitHub Actionsで自動公開します。

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

## 自動リリースフロー（推奨）

### 1. 変更を記録

開発中の変更に対してChangesetを作成：

```bash
npm run changeset
```

プロンプトに従って：
1. 変更したパッケージを選択
2. バージョンタイプを選択（major/minor/patch）
3. 変更内容の説明を入力

### 2. コミット＆プッシュ

```bash
git add .changeset/
git commit -m "chore: add changeset for [feature/fix]"
git push
```

### 3. 自動リリース

mainブランチにマージされると：
1. GitHub Actionsが自動的にリリースPRを作成
2. PRをレビュー＆マージ
3. 自動的にnpmに公開される

## 手動公開（緊急時のみ）

### 1. 事前準備

```bash
# ビルドとテスト
npm run build:all
npm test

# npmログイン
npm login
```

### 2. バージョン更新

```bash
# Changesetを使ってバージョン更新
npm run changeset:version
```

### 3. 公開

```bash
# Changesetを使って公開
npm run changeset:publish
```

## 設定

### 必要なトークンの設定

#### 1. NPM_TOKEN の設定

GitHub Secretsに`NPM_TOKEN`を設定する必要があります：

1. npmでトークンを生成：
   ```bash
   npm token create
   ```

2. GitHubリポジトリの Settings > Secrets and variables > Actions
3. `NPM_TOKEN`という名前でトークンを追加

#### 2. GitHub Actions の権限設定

以下のいずれかの方法で設定：

**方法A: リポジトリ設定を変更（推奨）**
1. Settings > Actions > General
2. "Workflow permissions" セクション
3. "Read and write permissions" を選択
4. "Allow GitHub Actions to create and approve pull requests" にチェック

**方法B: Personal Access Token を使用**
1. GitHub Settings > Developer settings > Personal access tokens
2. `repo`と`workflow`権限を持つトークンを生成
3. リポジトリの Secrets に `PAT_TOKEN` として追加
4. release.yml の checkout でこのトークンを使用：
   ```yaml
   - uses: actions/checkout@v4
     with:
       token: ${{ secrets.PAT_TOKEN }}
   ```

### Changesetの設定

`.changeset/config.json`で以下が設定されています：
- `access`: "public" - スコープ付きパッケージを公開
- `updateInternalDependencies`: "patch" - 内部依存を自動更新
- `baseBranch`: "main" - メインブランチ

## バージョン管理ポリシー

### セマンティックバージョニング

- **patch** (1.0.0 → 1.0.1): バグ修正、後方互換性のある修正
- **minor** (1.0.0 → 1.1.0): 新機能追加、後方互換性のある変更
- **major** (1.0.0 → 2.0.0): 破壊的変更、後方互換性のない変更

### パッケージ個別管理

各パッケージは独立してバージョン管理されます：
- 変更があったパッケージのみバージョンが上がる
- 内部依存は自動的に更新される

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