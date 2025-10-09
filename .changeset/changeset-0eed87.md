---
"@coeiro-operator/core": minor
---

オペレータ状態の保存場所を永続的な場所に変更

- 保存場所を/tmpから~/.coeiro-operator/state/に変更
- タイムアウト機能により永続保存が安全になった
- システム再起動後もオペレータ状態が維持される

BREAKING CHANGE: オペレータ状態ファイルの保存場所が変更されました。既存の/tmp内の状態は引き継がれません。