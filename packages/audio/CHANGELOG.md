# @coeiro-operator/audio

## 1.1.0

### Minor Changes

- 3283bc7: 音声出力モジュールを speaker から @echogarden/audio-io へ完全移行
  - プリコンパイル済みバイナリによりビルド不要
  - CI/CD環境での安定動作を実現
  - コールバックベースAPIで低レイテンシを実現
  - コードのシンプル化（speaker互換コードを削除）

- 5f7b33e: feat: Issue #135 Phase 3 - 音声再生停止機能を実装

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

### Patch Changes

- Updated dependencies [5f7b33e]
  - @coeiro-operator/core@1.1.1

## 1.0.3

### Patch Changes

- Updated dependencies [cca5ff8]
- Updated dependencies [df99cad]
  - @coeiro-operator/core@1.1.0

## 1.0.2

### Patch Changes

- npm パッケージに dist ディレクトリが含まれない問題を修正
  - audio, common パッケージ: distディレクトリが公開されていなかった問題を修正
  - すべてのパッケージ: files フィールドを追加し、ビルド成果物を明示的に含めるよう改善
  - すべてのパッケージ: prepublishOnly スクリプトを追加し、公開前のビルドを保証
  - mcp パッケージ: 修正された依存関係（audio, common）を参照するよう更新

- Updated dependencies
  - @coeiro-operator/common@1.0.2
  - @coeiro-operator/core@1.0.2

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- Updated dependencies [f596a2d]
  - @coeiro-operator/common@1.0.1
  - @coeiro-operator/core@1.0.1
