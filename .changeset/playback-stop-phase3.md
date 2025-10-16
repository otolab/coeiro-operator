---
"@coeiro-operator/audio": minor
"@coeiro-operator/mcp": minor
"@coeiro-operator/core": patch
"@coeiro-operator/cli": patch
---

feat: Issue #135 Phase 3 - 音声再生停止機能を実装

## 🎯 新機能
- AudioPlayerにチャンク境界停止機能を追加
  - `stopPlayback()`メソッドで安全な音声停止を実現
  - 現在のチャンクは完了させ、次のチャンクから停止
- SpeechQueueとAudioPlayerの停止連携を実装
  - `clearSpeechQueue()`で全タスククリア時に再生も停止
- playback_stop MCPツールを追加
  - 現在再生中の音声をチャンク境界で停止

## 🧪 テスト改善
- Speakerエラーハンドリングテストを修正
- stdin処理のE2Eテスト（6ケース）を追加
- テスト出力制御機能（TEST_VERBOSE環境変数）を追加

## 🐛 修正
- OperatorManagerのTypeScript any型警告を修正
- メモリリーク対策：イベントリスナーを`on`から`once`に変更
- 並行再生のデッドコード（playStreamingAudioParallel）を削除