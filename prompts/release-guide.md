# リリースガイド（エージェント用）

## 必須: Changeset作成

すべてのコード変更後に実行：

```bash
npm run changeset:add -- \
  --packages [パッケージ名:バージョンタイプ] \
  --message "[変更の説明]"
```

## バージョンタイプ

- **patch**: バグ修正、ドキュメント更新
- **minor**: 新機能追加（後方互換あり）
- **major**: 破壊的変更、API変更

## パッケージ対応表

| ディレクトリ | パッケージ名 |
|------------|-------------|
| packages/audio/* | @coeiro-operator/audio |
| packages/cli/* | @coeiro-operator/cli |
| packages/common/* | @coeiro-operator/common |
| packages/core/* | @coeiro-operator/core |
| packages/mcp/* | @coeiro-operator/mcp |
| packages/mcp-debug/* | @coeiro-operator/mcp-debug |
| packages/term-bg/* | @coeiro-operator/term-bg |

## 例

```bash
# バグ修正
npm run changeset:add -- \
  --packages @coeiro-operator/audio:patch \
  --message "Fix memory leak"

# 新機能
npm run changeset:add -- \
  --packages @coeiro-operator/audio:minor,@coeiro-operator/cli:minor \
  --message "Add voice speed control"

# 破壊的変更
npm run changeset:add -- \
  --packages @coeiro-operator/core:major \
  --message "BREAKING: Change config format"
```

## 判断に迷ったら

- patch vs minor → **minor**
- minor vs major → **ユーザーに確認**
- 変更の説明には "Fix", "Add", "Update", "BREAKING" を使用