# リリースフロー

## 概要
このドキュメントは、coeiro-operatorプロジェクトにおけるchangesetを使った自動リリースフローの手順を説明します。

## 重要な仕様
- **mainへのマージではnpm公開されません**
- **release/*ブランチのマージ時のみnpm公開されます**
- **ブランチ名のバージョンがルートパッケージのバージョンになります**
- これにより意図しない公開を防ぎます

## 前提条件
- mainブランチへのpush権限があること
- npmパブリッシュ権限があること
- GitHub Secretsに `NPM_TOKEN` が設定済みであること

## モノレポにおける重要な前提知識

### changesetとprivateパッケージの関係

**changesetの管理対象**:
- `"private": false` のパッケージ（各子パッケージ）のみ
- 各パッケージの `package.json` の `version`
- 各パッケージの `CHANGELOG.md`

**changesetの管理対象外**:
- `"private": true` のパッケージ（rootパッケージ）
- rootパッケージの `package.json` の `version`

### モノレポのバージョン管理

このプロジェクトはモノレポ構造のため、各パッケージが独立したバージョンを持ちます：

| パッケージ | npm公開 | バージョン管理 |
|-----------|---------|---------------|
| coeiro-operator（ルート） | ❌ 公開されない | release/x.x.xブランチ名から決定 |
| @coeiro-operator/audio | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/cli | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/common | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/core | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/mcp | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/mcp-debug | ✅ 公開される | changesetで独立管理 |
| @coeiro-operator/term-bg | ✅ 公開される | changesetで独立管理 |

### rootパッケージのバージョン管理

モノレポのrootパッケージは `"private": true` で公開しないため、changesetはバージョンを管理しません。

**そのため、以下の手順が必要**:
1. リリースブランチ名 `release/x.x.x` でバージョンを指定
2. GitHub Actionsがブランチ名からバージョンを抽出
3. rootの `package.json` を自動的に更新

**rootバージョンの意味**:
- プロジェクト全体のバージョンを表す
- Gitタグ（`v1.2.3`）のバージョンとして使用
- GitHub Releaseのバージョンとして使用

**バージョン番号の例**:
`release/1.3.3` をリリースした場合：
- **ルートパッケージ**: 1.3.3（npm非公開、タグのみ）
- **@coeiro-operator/core**: 1.2.0 → 1.2.1（patchの場合）
- **@coeiro-operator/cli**: 1.3.2 → 1.3.3（依存関係による）

**注意**: ルートのバージョン（1.3.3）と個別パッケージのバージョン（1.2.1など）は**必ずしも一致しません**。これは正常な動作です。

### rootバージョンの決定ルール

子パッケージのバージョンアップを確認して、最大の変更レベルをrootに適用します:

| 子パッケージの変更 | rootバージョンの更新 | 例 |
|---|---|---|
| patch, patch | patch + 1 | `1.2.3` → `1.2.4` |
| minor, patch | minor + 1, patch = 0 | `1.2.3` → `1.3.0` |
| minor, minor | minor + 1, patch = 0 | `1.2.3` → `1.3.0` |
| major, minor, patch | major + 1, minor = 0, patch = 0 | `1.2.3` → `2.0.0` |

**注意**: rootのminorバージョンは上がりやすい傾向があります（子パッケージのいずれかがminor以上の変更を含む場合）。

**判断手順**:
1. `npx changeset status` で各パッケージの変更レベルを確認
2. 最大の変更レベル（major > minor > patch）を採用
3. そのレベルに応じてrootバージョンを決定

## リリースフロー概要

```
[機能開発] → [PRマージ] → [リリース準備] → [リリースPR] → [パブリッシュ]
    ↓           ↓              ↓               ↓              ↓
changeset    mainに蓄積    release/x.x.x   自動作成      自動実行
  追加                       ブランチ
```

## 1. 日常的な開発フロー（Changeset作成）

### 1.1 機能開発時の作業

```bash
# 1. 機能ブランチを作成
git checkout -b feature/new-awesome-feature

# 2. コードを実装

# 3. テストを実行
pnpm test

# 4. changesetを追加（重要！）
node scripts/create-changeset.js \
  --packages "@coeiro-operator/audio:minor" \
  --message "Add new feature"
```

**注意**: コード変更を含むPRは**Changesetがないとマージできません**（CIでチェックされます）

### Changeset作成コマンド

#### 基本形式
```bash
node scripts/create-changeset.js \
  --packages "<package-name>:<version-type>" \
  --message "<変更内容の説明>"
```

#### パラメータ
- `--packages`: パッケージ名とバージョンタイプをコロンで区切る
  - 複数パッケージの場合はカンマ区切り
  - 例: `"@coeiro-operator/core:minor,@coeiro-operator/mcp:patch"`
- `--message`: 変更内容の説明（改行可能）

#### 実例

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
  --packages "@coeiro-operator/core:major" \
  --message "設定ファイルの場所を変更

BREAKING CHANGE: 設定ファイルの場所が変更されました"
```

### バージョンタイプ

| タイプ | 変更 | 使用場面 |
|--------|------|----------|
| patch | 1.0.0→1.0.1 | バグ修正 |
| minor | 1.0.0→1.1.0 | 新機能、破壊的変更（0.x.xの場合） |
| major | 1.0.0→2.0.0 | 破壊的変更（1.x.x以降） |

### 1.2 changesetファイルのコミット

生成されるchangesetファイル (`.changeset/shiny-cats-dance.md`):
```markdown
---
"@coeiro-operator/audio": minor
---

Add new feature
```

```bash
# changesetファイルをコミット
git add .changeset/*.md
git commit -m "feat: add new feature"

# PRを作成
git push origin feature/new-awesome-feature
gh pr create --title "feat: add new feature" --body "..."
```

### 1.3 PRレビューとマージ

```bash
# レビュー承認後、mainにマージ
gh pr merge 123 --squash

# または、GitHub UIでマージ
```

**重要**:
- changesetファイルはmainブランチに蓄積されます
- 複数のPRがマージされると、複数のchangesetファイルが蓄積されます
- リリース時にこれらがまとめて処理されます

## 2. リリース準備

### 2.1 未リリース変更の確認

```bash
# mainブランチに移動
git checkout main
git pull origin main

# 未リリースの変更を確認
npx changeset status
```

**出力例**:
```
@coeiro-operator/audio: minor
  - Add user authentication feature
  - Improve error handling

@coeiro-operator/cli: patch
  - Fix bug in validation logic
```

### 2.2 rootバージョンの決定

`changeset status` の出力から、各パッケージのバージョンアップを確認します。

**手順**:
1. 各パッケージの変更レベルを確認（major / minor / patch）
2. 最大の変更レベルを採用
3. rootバージョンを決定

**例1: patch変更のみ**
```
@coeiro-operator/audio: patch
@coeiro-operator/cli: patch
```
→ rootバージョン: `1.2.3` → `1.2.4` (patch + 1)

**例2: minorとpatchの混在**
```
@coeiro-operator/audio: minor
@coeiro-operator/cli: patch
```
→ rootバージョン: `1.2.3` → `1.3.0` (minor + 1, patch = 0)

**例3: major変更を含む**
```
@coeiro-operator/core: major
@coeiro-operator/mcp: minor
@coeiro-operator/cli: patch
```
→ rootバージョン: `1.2.3` → `2.0.0` (major + 1, minor = 0, patch = 0)

**判断基準**:
- 最大の変更レベル（major > minor > patch）をrootに適用
- セマンティックバージョニングに従う
- **注意**: rootのminorは上がりやすい（いずれかのパッケージがminor以上を含む場合）

### 2.3 リリースブランチの作成

**作成タイミング**:
- ユーザーから明確なリリース指示があったとき
- 定期リリース日が決まっている場合はその日
- 緊急修正が必要な場合は即座に

#### 自動化版（推奨）

```bash
# mainから最新を取得
git checkout main && git pull

# リリースブランチ作成＆プッシュ
# ⚠️ 重要: ブランチ名のバージョンがルートパッケージのバージョンになります
git checkout -b release/1.3.0
git push -u origin release/1.3.0

# 🤖 以下は自動実行されます:
# - changeset versionの適用
# - ルートpackage.jsonをブランチ名のバージョン(1.3.0)に更新
# - Version Packagesコミット
# - PRの自動作成
```

**重要**: ブランチ名は `release/` プレフィックス + バージョン番号の形式にすること

**リリースブランチをpushすると自動的に**:
1. GitHub Actionsが起動
2. changesetを処理してバージョン・CHANGELOGを更新
3. リリースPRが自動作成される

#### 手動版（自動化が動作しない場合）

```bash
# mainから最新を取得
git checkout main && git pull

# リリースブランチ作成
# ⚠️ 重要: ブランチ名のバージョンがルートパッケージのバージョンになります
git checkout -b release/1.3.0

# Changesetの確認
npx changeset status

# バージョン更新とCHANGELOG生成
npx changeset version

# ルートpackage.jsonのバージョンをブランチ名に合わせて更新
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '1.3.0';  // ブランチ名のバージョンと一致させる
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# 更新をコミット
git add -A && git commit -m "Version Packages"

# プッシュ
git push -u origin release/1.3.0

# PRを作成
gh pr create --base main --title "Release v1.3.0" \
  --body "## 🚀 Release v1.3.0

⚠️ **Merging this PR will automatically publish to npm**"
```

## 3. 自動リリースPR作成

### 3.1 GitHub Actionsの自動実行

`release/1.3.0` ブランチへのpushにより、GitHub Actionsが自動実行されます:

1. **changesetファイルの存在確認**
   - `.changeset/` ディレクトリ内のchangesetファイルを確認
   - changesetがない場合は処理をスキップ

2. **changesetの処理**
   - `changeset version` を実行
   - 各パッケージの `CHANGELOG.md` を更新
   - 各パッケージの `package.json` の `version` を更新
   - changesetファイルを削除

3. **rootパッケージのバージョン更新**
   - ブランチ名 `release/1.3.0` からバージョン `1.3.0` を抽出
   - root `package.json` の `version` フィールドを `1.3.0` に更新
   - **注意**: changesetはprivateパッケージ（root）のバージョンを管理しないため、手動更新が必要

4. **変更のコミット・push**
   - すべての変更を `Version Packages` コミットでまとめる
   - リリースブランチにpush

5. **リリースPRの作成**
   - タイトル: `Release v1.3.0`
   - 本文: リリース情報
   - ベースブランチ: `main`

### 3.2 リリースPRの確認

```bash
# 作成されたリリースPRを確認
gh pr view <PR番号>

# または、GitHub UIで確認
# https://github.com/otolab/coeiro-operator/pulls
```

**確認事項**:
- [ ] 各パッケージのCHANGELOG.mdが正しく更新されているか
- [ ] 各パッケージのバージョンが正しいか
- [ ] rootのpackage.jsonのバージョンが正しいか（リリースブランチ名と一致）
- [ ] changesetファイルが削除されているか
- [ ] **CHANGELOGの内容を確認（GitHub Releaseに使用される）**

**CHANGELOGの確認方法**:
```bash
# リリースPRのファイル差分を確認
gh pr diff <PR番号> | grep -A 20 "^+## "

# または、各パッケージのCHANGELOGを直接確認
git checkout release/1.3.0
git pull origin release/1.3.0
cat packages/*/CHANGELOG.md | grep -A 10 "^## 1.3.0"
```

これらのCHANGELOGがGitHub Releaseの本文として使用されます。

### 3.3 リリースPRの修正（必要な場合）

```bash
# リリースブランチをチェックアウト
git checkout release/1.3.0
git pull origin release/1.3.0

# CHANGELOG等を手動修正
vim packages/audio/CHANGELOG.md

# コミット・push
git add packages/audio/CHANGELOG.md
git commit -m "docs: update changelog"
git push origin release/1.3.0

# PRが自動的に更新される
```

## 4. リリースPRのマージとパブリッシュ

### 4.1 リリースPRのマージ

```bash
# リリースPRをmainにマージ
gh pr merge <リリースPR番号> --squash

# または、GitHub UIでマージ
```

**重要**:
- **release/*ブランチのPRをマージ = 自動npm公開**
- 通常のPRマージでは公開されません
- release/*ブランチからのPRのみが公開トリガーです
- マージ方法は squash または merge を推奨
- rebase は避ける（changesetの追跡が複雑になる）

### 4.2 自動パブリッシュの実行

リリースPRがマージされると、GitHub Actionsが自動実行されます:

1. **ビルド**
   - `pnpm install --frozen-lockfile`
   - `pnpm build:all`

2. **npmパブリッシュ**
   - `pnpm publish -r --no-git-checks`
   - 各パッケージがnpmにパブリッシュされる
   - 依存順序に従って自動的に公開される

3. **Gitタグのpush**
   - タグ名: `v1.3.0`（rootパッケージのバージョン）
   - `git push origin --tags` でタグをpush
   - mainブランチへのコミットは行わない

4. **GitHub Releaseの作成**
   - リリース名: `Release v1.3.0`
   - タグ: `v1.3.0`
   - 本文: **各パッケージのCHANGELOGから該当バージョンを抽出して結合**

### 4.3 パブリッシュの確認

```bash
# npmでのパブリッシュ確認
npm view @coeiro-operator/audio version
npm view @coeiro-operator/cli version
npm view @coeiro-operator/core version

# Gitタグの確認
git fetch --tags
git tag -l "v1.3.*"

# GitHub Releaseの確認
gh release view v1.3.0

# または、GitHub UIで確認
# https://github.com/otolab/coeiro-operator/releases
```

**GitHub Releaseの内容確認**:
1. GitHub Releaseページを開く
2. 各パッケージのCHANGELOGが正しく含まれているか確認
3. リリースノートが意図通りか確認

## トラブルシューティング

### changesetファイルが認識されない

```bash
# .changeset/ディレクトリの確認
ls -la .changeset/

# changesetの状態を確認
npx changeset status
```

### リリースPRが作成されない

- GitHub Actionsのログを確認
- `release/*` ブランチ名が正しいか確認
- `GITHUB_TOKEN` 権限を確認（Read and write permissions）

### npmパブリッシュが失敗する

```bash
# npm tokenの有効性を確認
npm whoami --registry https://registry.npmjs.org

# package.jsonのnameとversionを確認
cat packages/*/package.json | grep -E '(name|version)'

# publishConfigを確認
cat packages/*/package.json | grep -A 3 publishConfig
```

### Gitタグが作成されない

- リリースPRが正常にマージされたか確認
- `release-branch.yml` の条件式を確認
- Git push権限を確認

## 設定

### NPM_TOKEN

GitHub Secrets に `NPM_TOKEN` を設定：

```bash
npm token create
```

Settings > Secrets and variables > Actions:
1. "New repository secret"をクリック
2. Name: `NPM_TOKEN`
3. Secret: npmトークンをペースト
4. "Add secret"をクリック

### GitHub Actions権限

Settings > Actions > General:
- "Read and write permissions" を選択
- "Allow GitHub Actions to create and approve pull requests" を有効化

## チェックリスト

### リリース前チェックリスト
- [ ] すべてのテストがパスしている
- [ ] CIが成功している
- [ ] changesetがすべてのPRに追加されている
- [ ] ドキュメントが更新されている（必要な場合）
- [ ] 破壊的変更がある場合、マイグレーションガイドを作成

### リリース時チェックリスト
- [ ] 正しいバージョン番号でリリースブランチを作成
- [ ] リリースPRのCHANGELOGを確認
- [ ] リリースPRのバージョン番号を確認
- [ ] リリースPRをmainにマージ

### リリース後チェックリスト
- [ ] npmでパッケージが公開されたことを確認
- [ ] Gitタグが作成されたことを確認
- [ ] GitHub Releaseが作成されたことを確認
- [ ] ドキュメントサイトが更新されている（該当する場合）
- [ ] リリースをチームに通知

## 参考資料

- エージェント向けガイド: `prompts/release-guide.md`
- Changeset設定: `.changeset/config.json`
- GitHub Actions: `.github/workflows/release-version.yml`, `.github/workflows/release-branch.yml`

---

**最終更新**: 2025年12月3日
