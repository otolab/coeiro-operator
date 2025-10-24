# リリースフロー

## 重要な仕様
- **mainへのマージではnpm公開されません**
- **release/*ブランチのマージ時のみnpm公開されます**
- **ブランチ名のバージョンがルートパッケージのバージョンになります**
- これにより意図しない公開を防ぎます

## バージョン決定の仕組み

### 重要：モノレポのバージョン管理

このプロジェクトはモノレポ構造のため、各パッケージが独立したバージョンを持ちます：

| パッケージ | npm公開 | バージョン管理 |
|-----------|---------|---------------|
| coeiro-operator（ルート） | ❌ 公開されない | release/x.x.xブランチ名から決定 |
| @coeiro-operator/core | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/cli | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/audio | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/mcp | ✅ 公開される | changesetで独立管理 |
| その他パッケージ | ✅ 公開される | changesetで独立管理 |

### バージョン番号の例

`release/1.3.3`をリリースした場合：
- **ルートパッケージ**: 1.3.3（npm非公開、タグのみ）
- **@coeiro-operator/core**: 1.2.0 → 1.2.1（patchの場合）
- **@coeiro-operator/cli**: 1.3.2 → 1.3.3（依存関係による）

**注意**: ルートのバージョン（1.3.3）と個別パッケージのバージョン（1.2.1など）は**必ずしも一致しません**。これは正常な動作です。

## 必須手順

### 1. 開発時（Changeset作成）

```bash
# 変更後、必ずChangesetを作成
node scripts/create-changeset.js \
  --packages "@coeiro-operator/audio:minor" \
  --message "Add new feature"

# または複数パッケージの場合
node scripts/create-changeset.js \
  --packages "@coeiro-operator/audio:minor,@coeiro-operator/cli:patch" \
  --message "Add new feature and fix CLI bug"

# コミット＆PR
git add .
git commit -m "feat: 新機能追加"
gh pr create --base main
```

**注意**: コード変更を含むPRはChangesetがないとマージできません（CIでチェック）

### 2. リリース時（release/*ブランチ）

#### 自動化版（推奨）

```bash
# mainから最新を取得
git checkout main && git pull

# リリースブランチ作成＆プッシュ
# ⚠️ 重要: ブランチ名のバージョンがルートパッケージのバージョンになります
git checkout -b release/1.0.1
git push -u origin release/1.0.1

# 🤖 以下は自動実行されます:
# - changeset versionの適用
# - ルートpackage.jsonをブランチ名のバージョン(1.0.1)に更新
# - Version Packagesコミット
# - PRの自動作成
```

#### 手動版（自動化が動作しない場合）

```bash
# mainから最新を取得
git checkout main && git pull

# リリースブランチ作成
# ⚠️ 重要: ブランチ名のバージョンがルートパッケージのバージョンになります
git checkout -b release/1.0.1

# Changesetの確認
npx changeset status

# バージョン更新とCHANGELOG生成
npx changeset version

# ルートpackage.jsonのバージョンをブランチ名に合わせて更新
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '1.0.1';  // ブランチ名のバージョンと一致させる
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 更新をコミット
git add -A && git commit -m "Version Packages"

# プッシュ
git push -u origin release/1.0.1

# PRを作成
gh pr create --base main --title "Release v1.0.1" \
  --body "## 🚀 Release

⚠️ **Merging this PR will automatically publish to npm**"
```

### 3. 公開（自動）

1. リリースPRをレビュー
2. **release/*ブランチのPRをマージ = 自動npm公開**
   - 通常のPRマージでは公開されません
   - release/*ブランチからのPRのみが公開トリガーです

## Changeset作成の詳細

### コマンド形式

```bash
node scripts/create-changeset.js \
  --packages "<package-name>:<version-type>" \
  --message "<変更内容の説明>"
```

### パラメータ
- `--packages`: パッケージ名とバージョンタイプをコロンで区切る
  - 複数パッケージの場合はカンマ区切り
  - 例: `"@coeiro-operator/core:minor,@coeiro-operator/mcp:patch"`
- `--message`: 変更内容の説明（改行可能）

### 実例

```bash
# 単一パッケージのminorアップデート
node scripts/create-changeset.js \
  --packages "@coeiro-operator/core:minor" \
  --message "新機能を追加しました"

# 複数パッケージの更新
node scripts/create-changeset.js \
  --packages "@coeiro-operator/audio:minor,@coeiro-operator/cli:patch" \
  --message "音声機能を追加し、CLIのバグを修正"

# 破壊的変更の場合
node scripts/create-changeset.js \
  --packages "@coeiro-operator/core:minor" \
  --message "設定ファイルの場所を変更

BREAKING CHANGE: 設定ファイルの場所が変更されました"
```

## バージョンタイプ

| タイプ | 変更 | 使用場面 |
|--------|------|----------|
| patch | 1.0.0→1.0.1 | バグ修正 |
| minor | 1.0.0→1.1.0 | 新機能、破壊的変更（0.x.xの場合） |
| major | 1.0.0→2.0.0 | 破壊的変更（1.x.x以降） |

## 設定

### NPM_TOKEN

GitHub Secrets に `NPM_TOKEN` を設定：

```bash
npm token create
```

### GitHub Actions権限

Settings > Actions > General:
- "Allow GitHub Actions to create and approve pull requests" を有効化

## 詳細

- エージェント向けガイド: `prompts/release-guide.md`
- Changeset設定: `.changeset/config.json`