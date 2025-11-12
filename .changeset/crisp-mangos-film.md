---
"@coeiro-operator/core": patch
---

OperatorManagerのリファクタリング（Phase 1-6）

OperatorManagerの責務を分離し、コードの保守性を向上させました。

主な変更:
- DI パターンの導入（ConfigManager、CharacterInfoServiceを注入）
- setup()関数による統一された初期化パターン
- 委譲メソッドの削除（getCharacterInfo、selectStyle）
- Speaker管理をCharacterInfoServiceに移動
- ディレクトリ構成の整理（character/、config/サブディレクトリ）

効果:
- OperatorManagerが596行から472行に削減（21%減）
- 3層アーキテクチャ（Speaker、Character、Operator）の明確化
- 責務の分離とコードの見通しの向上
