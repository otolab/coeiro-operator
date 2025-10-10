# @coeiro-operator/cli

## 1.1.0

### Minor Changes

- cca5ff8: オペレータ状態の保存場所を永続的な場所に変更
  - 保存場所を/tmpから~/.coeiro-operator/state/に変更
  - タイムアウト機能により永続保存が安全になった
  - システム再起動後もオペレータ状態が維持される

  BREAKING CHANGE: オペレータ状態ファイルの保存場所が変更されました。既存の/tmp内の状態は引き継がれません。

### Patch Changes

- Updated dependencies [cca5ff8]
  - @coeiro-operator/core@1.1.0
  - @coeiro-operator/audio@1.0.3

## 1.0.2

### Patch Changes

- Updated dependencies
  - @coeiro-operator/audio@1.0.2
  - @coeiro-operator/common@1.0.2
  - @coeiro-operator/core@1.0.2

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- db96813: Fix deprecation warnings by adding --no-deprecation flag to all bin scripts
- Updated dependencies [f596a2d]
  - @coeiro-operator/audio@1.0.1
  - @coeiro-operator/common@1.0.1
  - @coeiro-operator/core@1.0.1
