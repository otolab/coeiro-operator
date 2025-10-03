# Changesets

このディレクトリはChangesetツールによるバージョン管理のために使用されます。

## 使い方

### 変更を記録する

```bash
npm run changeset
```

変更内容に応じて：
- `patch` - バグ修正など後方互換性のある修正
- `minor` - 新機能の追加など後方互換性のある変更
- `major` - 破壊的変更

### バージョンを更新する

```bash
npm run changeset:version
```

### パッケージを公開する

```bash
npm run changeset:publish
```

## 自動リリース

mainブランチへのプッシュ時に自動的に：
1. リリースPRが作成される
2. PRをマージするとnpmに自動公開される