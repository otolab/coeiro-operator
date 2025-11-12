# @coeiro-operator/audio

## 1.2.5

### Patch Changes

- Updated dependencies [f979ff0]
- Updated dependencies [f5e8483]
  - @coeiro-operator/core@1.3.0

## 1.2.4

### Patch Changes

- 9687dca: fix: waitForQueueLengthでtargetLength>0の場合に待機が解除されない問題を修正

  Issue #182の修正: `waitForQueueLength(targetLength)`で`targetLength > 0`を指定しても、キューが目標長になったときに待機が解除されなかった問題を修正しました。

  **問題:**
  `taskCompleted`イベント発火時に、まだ`currentProcessPromise`がnullになっていないため、`isProcessing = true`のままで条件を満たさなかった。

  **修正内容:**
  - targetLength=0: 完全に空で処理中でない場合に解除（従来通り）
  - targetLength>0: キューが目標長以下になった時点で即座に解除

  **影響を受けるパッケージ:**
  - @coeiro-operator/mcp: `wait_for_task_completion`ツールの`remainingQueueLength`オプションが正常に動作するようになります

  refs #182

## 1.2.3

### Patch Changes

- ef7153f: wait_for_task_completionにremainingQueueLengthオプションを追加（イベントベース実装）

  `wait_for_task_completion`ツールに、キューが指定数になったときに待ちを解除する`remainingQueueLength`オプションを追加しました。

  **使用例:**

  ```typescript
  // キューが1個になったら解除
  wait_for_task_completion({ remainingQueueLength: 1 });

  // すべてのタスクが完了するまで待機（既存の動作）
  wait_for_task_completion({ remainingQueueLength: 0 });
  wait_for_task_completion();
  ```

  **実装内容:**
  - `remainingQueueLength`パラメータを追加（デフォルト: 0）
  - 0の場合は既存の動作（全タスク完了まで待機）
  - **イベントベース実装**: ポーリングを避け、TaskQueueのイベント(`taskCompleted`, `queueEmpty`)を使用
  - TaskQueueにEventEmitterを継承させ、`waitForQueueLength()`メソッドを追加
  - SayCoeiroinkに`waitForQueueLength()`を公開
  - タイムアウト・エラーメッセージも残数に応じて適切に表示

  **技術詳細:**
  - TaskQueueに`taskCompleted`イベント（タスク完了時）と`queueEmpty`イベント（キュー空時）を追加
  - `waitForQueueLength(targetLength)`メソッドでイベントリスナーを登録し、条件達成で解決
  - ポーリング不要で効率的な待機を実現

  refs #182

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

- Updated dependencies [9175d6e]
  - @coeiro-operator/core@1.2.3

## 1.2.2

### Patch Changes

- Updated dependencies [b89cd4a]
  - @coeiro-operator/core@1.2.2

## 1.2.1

### Patch Changes

- Updated dependencies [ce450dc]
  - @coeiro-operator/core@1.2.1

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

### Patch Changes

- Updated dependencies [06c7ffe]
  - @coeiro-operator/core@1.2.0

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
