---
"@coeiro-operator/cli": minor
"@coeiro-operator/core": minor
---

キャラクター登録・測定機能をCLIに追加

operator-managerコマンドに3つの新しいコマンドを追加しました:

- `list-unmeasured [--json]`: 未計測のSpeaker/Styleを表示
- `add-character <characterId> <speakerName>`: キャラクターを新規登録
- `measure <characterId> [--style=スタイル名] [--dry-run]`: 話速を測定して設定を更新

主な変更:
- ConfigManager.updateCharacterConfig(): スタイルマージ機能を追加
- OperatorManager.detectUnregisteredSpeakers(): 未登録Speaker検出機能
- OperatorManager.measureCharacterSpeechRate(): 話速測定機能（登録済みキャラクター用）
- SpeechRateMeasurer: 話速測定ロジックを独立したクラスに分離
