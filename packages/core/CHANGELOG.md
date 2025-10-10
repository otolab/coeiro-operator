# @coeiro-operator/core

## 1.1.0

### Minor Changes

- cca5ff8: オペレータ状態の保存場所を永続的な場所に変更
  - 保存場所を/tmpから~/.coeiro-operator/state/に変更
  - タイムアウト機能により永続保存が安全になった
  - システム再起動後もオペレータ状態が維持される

  BREAKING CHANGE: オペレータ状態ファイルの保存場所が変更されました。既存の/tmp内の状態は引き継がれません。

- df99cad: オペレータ状態の保存場所を永続的な場所に変更
  - 保存場所を/tmpから~/.coeiro-operator/state/に変更
  - タイムアウト機能により永続保存が安全になった
  - システム再起動後もオペレータ状態が維持される

  BREAKING CHANGE: オペレータ状態ファイルの保存場所が変更されました。既存の/tmp内の状態は引き継がれません。

## 1.0.2

### Patch Changes

- Updated dependencies
  - @coeiro-operator/common@1.0.2
  - @coeiro-operator/term-bg@1.0.1

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- Updated dependencies [f596a2d]
  - @coeiro-operator/common@1.0.1
