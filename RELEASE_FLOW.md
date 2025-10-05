# リリースフロー

## 必須手順

### 1. 開発時（Changeset作成）

```bash
# 変更後、必ずChangesetを作成
pnpm changeset:add -- \
  --packages @coeiro-operator/audio:minor \
  --message "Add new feature"

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
git checkout -b release/1.0.1
git push -u origin release/1.0.1

# 🤖 以下は自動実行されます:
# - changeset versionの適用
# - Version Packagesコミット
# - PRの自動作成
```

#### 手動版（自動化が動作しない場合）

```bash
# mainから最新を取得
git checkout main && git pull

# リリースブランチ作成
git checkout -b release/1.0.1

# Changesetの確認
npx changeset status

# バージョン更新とCHANGELOG生成
npx changeset version

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
2. **マージ = 自動npm公開**

## バージョンタイプ

| タイプ | 変更 | 使用場面 |
|--------|------|----------|
| patch | 1.0.0→1.0.1 | バグ修正 |
| minor | 1.0.0→1.1.0 | 新機能 |
| major | 1.0.0→2.0.0 | 破壊的変更 |

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