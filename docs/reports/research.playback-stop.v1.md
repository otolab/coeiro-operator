# 音声再生停止機能 調査メモ

## 調査日時
2025年1月16日

## 調査目的
音声再生停止機能の実装可能性と必要な変更箇所の特定

## 調査ログ

### 既存の調査結果から
- Issue #135 Phase 2は完了（タスクID指定キャンセル機能）
- Phase 3候補として再生停止機能が挙げられている
- 課題：AudioPlayerがSpeakerインスタンスへの参照を保持していない

## 調査対象ファイル

### 1. ドキュメント調査結果

#### docs/architecture/audio-system.md
- Speakerライブラリ: Native Node.js audio output使用
- フォーマット: 16bit PCM, 48kHz, モノラル
- Transform Streamアーキテクチャ採用
- パイプライン: resampleTransform → lowpassTransform → noiseReductionTransform → streamSpeaker
- 再生停止機能に関する記載なし

#### docs/architecture/speech-queue-system.md
- SpeechQueueシステムで音声タスクを管理
- キュー状態取得: getSpeechQueueStatus()
- キュークリア: clearSpeechQueue() - Phase 2で拡張済み
- 再生停止機能に関する記載なし

### 2. AudioPlayerの実装調査結果

#### packages/audio/src/audio-player.ts
- **playPCMData()メソッド** (行568-609)
  - 毎回新しいSpeakerインスタンスを作成 (行579: `await this.createSpeaker()`)
  - 使い終わったら自動的にcloseイベントで破棄 (行584-586)
  - Speakerインスタンスへの参照は保持されない（ローカル変数のみ）

- **processAudioStreamPipeline()メソッド** (行215-262)
  - ストリーミング処理でもSpeakerインスタンスを新規作成 (行219)
  - パイプライン完了後に自動でclose
  - インスタンスへの参照は保持されない

- **createSpeaker()メソッド** (行429-560)
  - Speakerの設定を行い、新しいインスタンスを返す
  - テスト環境ではモックSpeakerを返す
  - 本番環境では実際のSpeakerを動的インポート

- **cleanup()メソッド** (行816-831)
  - Speaker関連の処理なし
  - Echogardenのフラグリセットのみ

**重要な発見**: 現在のアーキテクチャではSpeakerインスタンスへの永続的な参照がないため、再生停止機能の実装には大幅な改修が必要

### 3. node-speakerライブラリの調査結果

#### package.json
- バージョン: `speaker@0.5.5` (optionalDependencies)
- WritableStreamベースの実装

#### Speakerインスタンスのメソッド（モック実装から推測）
- **write()**: PCMデータを書き込み
- **end()**: ストリームを終了し、closeイベントを発火
- **destroy()**: ストリームを強制終了（リソース解放用）
  - error引数を渡すとerrorイベントも発火
  - 即座にcloseイベントを発火
- **pipe()/unpipe()**: Stream連携用

**destroyメソッドが再生停止に使用可能**と判断

### 4. 既存実装の調査結果

#### テストファイル
- 停止関連のテスト実装なし（stop/cancel/abort関連のコードなし）
- MockSpeakerではdestroyメソッドが定義されている

#### MCPツール
- queue_clearツールの説明: 「現在再生中の音声は停止しません」と明記
- キュークリアと再生停止は独立した機能として設計されている