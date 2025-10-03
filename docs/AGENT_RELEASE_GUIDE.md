# AIエージェント向けリリースガイド

## 必須ルール

**すべてのコード変更に対してChangesetの作成が必須です。**

## 変更時のChangeset作成手順（必須）

### 1. 変更内容の分析

変更を行った後、以下を確認：

```bash
# 変更されたファイルを確認
git status

# 変更内容を確認
git diff
```

### 2. 影響パッケージの特定

変更されたファイルから影響するパッケージを特定：

- `packages/audio/*` → `@coeiro-operator/audio`
- `packages/cli/*` → `@coeiro-operator/cli`
- `packages/common/*` → `@coeiro-operator/common`
- `packages/core/*` → `@coeiro-operator/core`
- `packages/mcp/*` → `@coeiro-operator/mcp`
- `packages/mcp-debug/*` → `@coeiro-operator/mcp-debug`
- `packages/term-bg/*` → `@coeiro-operator/term-bg`

### 3. バージョンタイプの決定

#### 判断基準

**patch を選択する場合**:
- バグ修正
- タイポ修正
- ドキュメント更新
- パフォーマンス改善（API変更なし）
- 依存関係の更新（breaking changeなし）

**minor を選択する場合**:
- 新機能追加
- 新しいオプション追加
- 新しいコマンド追加
- 後方互換性のある機能拡張

**major を選択する場合**:
- 関数シグネチャの変更
- 設定項目の名前変更
- デフォルト動作の変更
- 必須パラメータの追加
- ファイル形式の変更

### 4. Changeset作成コマンドの実行（必須）

以下のコマンドを必ず実行：

```bash
npm run changeset:add -- \
  --packages [パッケージ名:バージョンタイプ] \
  --message "[変更の説明]"
```

**注意**: `npm run changeset`（対話型）は使用禁止。必ずスクリプトを使用すること。

### 実例集

#### ケース1: バグ修正

状況: audioパッケージでメモリリークを修正

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/audio:patch \
  --message "Fix memory leak in audio streaming mode"
```

#### ケース2: 新機能追加

状況: 音声速度制御機能を追加（audioとcliに影響）

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:minor \
  --message "Add voice speed control feature with --speed flag"
```

#### ケース3: 破壊的変更

状況: 設定ファイルの形式を変更

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/core:major \
  --message "BREAKING: Change config file format from JSON to YAML"
```

#### ケース4: 複数パッケージの更新

状況: 共通ライブラリの更新で複数パッケージに影響

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/common:minor,@coeiro-operator/core:patch,@coeiro-operator/audio:patch \
  --message "Update logger with structured logging support"
```

### 5. 作成されたChangesetの確認

```bash
# 作成されたファイルを確認
ls -la .changeset/

# 内容を確認
cat .changeset/changeset-*.md

# Changesetのステータスを確認
npx changeset status
```

### 6. コミット

```bash
git add .changeset/
git commit -m "chore: add changeset for [機能名]"
```

## ユーザーとの対話例

**ユーザー**: 「音声速度を調整できるようにしたよ」

**エージェント**: 「音声速度調整機能を追加したのですね。どのパッケージが影響を受けていますか？」

1. audioパッケージで速度調整のロジックを実装 → minor
2. cliパッケージに--speedオプションを追加 → minor

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:minor \
  --message "Add voice speed control feature with configurable speed option"
```

**ユーザー**: 「メモリリークを直した」

**エージェント**: 「バグ修正ですね。どのパッケージで修正しましたか？」

audioパッケージのストリーミング処理を修正 → patch

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/audio:patch \
  --message "Fix memory leak in streaming mode by properly cleaning up buffers"
```

## チェックリスト

Changesetを作成する前に確認：

- [ ] 変更内容を理解している
- [ ] 影響するパッケージを特定した
- [ ] バージョンタイプを適切に判断した
- [ ] 変更の説明が明確である
- [ ] 破壊的変更の場合、"BREAKING:"を含めた

## トラブルシューティング

### Changesetを作り間違えた場合

```bash
# 最新のChangesetファイルを削除
rm .changeset/changeset-*.md

# 再作成
npm run changeset:add -- ...
```

### 複数の変更を1つにまとめたい場合

複数の関連する変更は1つのChangesetにまとめることができます：

```bash
npm run changeset:add -- \
  --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:minor,@coeiro-operator/core:patch \
  --message "Add voice speed control across multiple packages"
```

### バージョンタイプに迷った場合

迷ったら安全側に倒す：
- patch vs minor → minor を選択
- minor vs major → ユーザーに確認

## 自動化のヒント

エージェントは以下のパターンを認識できます：

- "Fix", "Fixed", "Bugfix" → patch
- "Add", "Added", "New" → minor
- "Breaking", "BREAKING", "Change API" → major
- "Update", "Improve" → 内容による（通常patch）
- "Refactor" → patch（API変更なしの場合）