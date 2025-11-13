---
"@coeiro-operator/audio": patch
---

audio層のVoiceConfig削除とSpeakSettings統一リファクタリング

VoiceConfig型を削除してSpeakSettingsに統一し、audio層の設計を簡素化しました。
Character解決とspeed計算の責任をSayCoeiroinkに移動することで、各層の責務を明確化しています。

主な変更:
- VoiceConfig型を削除、SpeakSettings型に統一
- ProcessingOptions型を導入して音声生成と処理制御を分離
- SynthesisProcessor.process()をSpeakSettings + ProcessingOptions形式に変更
- voice-resolver.ts削除（Character解決をSayCoeiroinkに移動）
- speed-utils.tsをSpeakerRateInfo型に変更（VoiceConfigから独立）

設計改善:
- audio層はSpeakSettingsのみを受け取るシンプルな構造に
- CLI/MCP層がCharacter解決とSpeakSettings作成を担当
- 型の責務が明確化され、依存関係が整理された

影響範囲:
- 9ファイルの実装変更、632行削減
- 5ファイルのテスト更新（全156テストがパス）
