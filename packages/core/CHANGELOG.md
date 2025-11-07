# @coeiro-operator/core

## 1.2.3

### Patch Changes

- 9175d6e: 句読点ポーズ設定を簡素化し一貫性を向上
  - `PunctuationPauseSettings`から`enabled`フラグを削除（各値を0にすることで無効化可能）
  - `PunctuationPauseSettings`から`baseMorasPerSecond`を削除（VoiceConfigから取得するため不要）
  - `pauseMoras`ネストを削除し、フラットな構造に変更
  - 型定義、実装コード、テスト、ドキュメントを一貫した仕様に統一

  **変更前:**

  ```typescript
  punctuationPause: {
    enabled: true,
    pauseMoras: { period: 2.0 },
    baseMorasPerSecond: 7.5
  }
  ```

  **変更後:**

  ```typescript
  punctuationPause: {
    period: 2.0,
    exclamation: 1.5,
    question: 1.8,
    comma: 0.8
  }
  ```

  この変更により、よりシンプルで直感的な設定が可能になりました。

## 1.2.2

### Patch Changes

- b89cd4a: fix: 同一キャラクター再割り当て時のスタイル変更が反映されない問題を修正

  既に割り当て済みのキャラクターに対して異なるスタイルを指定して再度 `operator_assign` を実行した場合、セッションファイルが更新されず古いスタイル情報が残り続ける問題を修正しました。

  **修正内容:**
  - `OperatorManager.assignSpecificOperator()` の早期リターン処理で、スタイルが変更されている場合はセッションファイルを更新するロジックを追加
  - スタイル変更時に `🔄 [ASSIGN] スタイル変更` ログを出力

  **影響:**
  - 同じキャラクターで異なるスタイルを指定した場合、正しくスタイルが切り替わるようになります
  - その後の `say()` 呼び出しで指定したスタイルが正しく使用されます

## 1.2.1

### Patch Changes

- ce450dc: ターミナル背景画像設定をシンプル化
  - 新しい設定構造 `imagePaths` で統一管理
    - string値: ファイルパス指定
    - null/false: 画像無効（APIも使わない）
    - 未定義: APIから自動取得
  - 旧設定（`backgroundImages`、`operatorImage`）からの自動移行をサポート
  - より直感的な設定で「ファイル優先、なければAPI」の動作を実現

  破壊的変更なし（後方互換性維持）

## 1.2.0

### Minor Changes

- 06c7ffe: 発話速度調整機能の実装とリファクタリング

  ## 新機能

  ### 柔軟な速度指定
  - **未指定**: 話者固有の自然な速度（speed=1.0）
  - **絶対速度（rate）**: WPM単位での速度指定（例: 200 WPM）
  - **相対速度（factor）**: 倍率での速度指定（例: 1.5倍速）

  ### CLI対応

  ```bash
  # WPM指定
  say "こんにちは" --rate 200

  # パーセント指定（相対速度）
  say "こんにちは" --rate "150%"

  # 話者固有速度
  say "こんにちは"
  ```

  ### MCP API対応

  ```json
  {
    "rate": 200, // WPM指定
    "factor": 1.5 // 倍率指定
  }
  ```

  ## 改善内容

  ### シンプルな内部表現

  ```typescript
  interface SpeedSpecification {
    rate?: number; // 絶対速度（WPM）
    factor?: number; // 相対速度（倍率）
  }
  ```

  ### 設定構造の改善
  - `audio.defaultRate` に速度設定を統一
  - operator設定から速度関連を分離

  ## Breaking Changes
  - `operator.rate` 設定は削除されました
    - 代わりに `audio.defaultRate` を使用してください
  - `SpeedSpecification` インターフェースが変更されました
    - mode/value形式から rate/factor形式へ

  ## 技術的改善
  - 過度な抽象化を排除（config-helpers.ts削除）
  - 設定アクセスをTypeScriptの基本機能に統一
  - レイヤー間の責務を明確に分離
    - CLI層: 文字列パース
    - 内部処理層: 数値計算のみ

## 1.1.1

### Patch Changes

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
