# @coeiro-operator/mcp

## 1.4.4

### Patch Changes

- Updated dependencies [9687dca]
  - @coeiro-operator/audio@1.2.4

## 1.4.3

### Patch Changes

- 92e3092: fix: sayツールでvoice形式を正しくパース、不正な形式でエラーハンドリングを改善

  Issue #179, #180の修正: `alma:裏`のような不正なvoice形式でMCPサーバーがクラッシュする問題、およびvoice指定時に別キャラのstyleが使えない問題を修正しました。

  **変更内容:**
  1. **voice文字列のパース処理を追加**
     - `characterId:styleName`形式に対応
     - コロン(`:`)で分割し、characterIdとstyleNameを抽出
     - 不正な形式（コロンが複数など）を検出してエラー
  2. **エラーメッセージの改善**
     - 不正なvoice形式の場合、使用可能な形式を明示
     - キャラクターが存在しない場合のエラーを明確化
     - 存在しないstyleを指定した場合、そのキャラクターの利用可能なstyleを表示
  3. **スタイル検証の改善（Issue #180対応）**
     - voice指定時、そのキャラクターのstyleを検証
     - 現在のオペレータではなく、指定されたキャラクターのstyleをチェック
     - 例: `operator_assign=tsukuyomi`の状態で`voice="alma"` + `style="のーまる"`が使用可能に
  4. **クラッシュ防止の強化（Issue #179の本質的な要件）**
     - `voice-resolver.ts`で`selectedStyle`がundefinedになるケースを明示的に処理
     - 非null assertion (`!`) を削除し、ガード節でエラーをthrow
     - `speaker.styles`が空配列の場合のクラッシュを防止
     - `server.ts`で`Character`型に存在しない`name`フィールドの参照を修正

  **使用例:**

  ```typescript
  // 正常な形式
  say({ message: 'こんにちは', voice: 'alma' });
  say({ message: 'こんにちは', voice: 'alma:のーまる' });

  // Issue #180: voice指定時に別キャラのstyleを使用
  // operator_assign=tsukuyomiの状態で
  say({ message: 'こんにちは', voice: 'alma', style: 'のーまる' }); // ✅ almaの「のーまる」が使用される

  // エラーになる形式（適切なメッセージを表示）
  say({ message: 'こんにちは', voice: 'alma:裏:extra' }); // → "不正なvoice形式です"
  say({ message: 'こんにちは', voice: 'nonexistent' }); // → "キャラクター 'nonexistent' が見つかりません"
  ```

  **テスト:**
  - voice形式のパーステストを追加
  - 不正な形式のエラーテストを追加
  - Issue #180のシナリオテストを追加（voice指定時のstyle検証）

  refs #179, #180

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

- Updated dependencies [ef7153f]
- Updated dependencies [9175d6e]
  - @coeiro-operator/audio@1.2.3
  - @coeiro-operator/core@1.2.3

## 1.4.2

### Patch Changes

- Updated dependencies [b89cd4a]
  - @coeiro-operator/core@1.2.2
  - @coeiro-operator/audio@1.2.2

## 1.4.1

### Patch Changes

- Updated dependencies [ce450dc]
  - @coeiro-operator/core@1.2.1
  - @coeiro-operator/audio@1.2.1

## 1.4.0

### Minor Changes

- b74f15a: Commander.jsの導入によるCLI引数解析の改善
  - 手動の引数解析をcommander.jsライブラリに置き換え
  - 自動ヘルプメッセージ生成
  - 型安全性の向上
  - より良いバリデーション機能
  - コード保守性の大幅な向上

## 1.3.0

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
  - @coeiro-operator/audio@1.2.0
  - @coeiro-operator/core@1.2.0

## 1.2.0

### Minor Changes

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

- 8188dc2: デフォルトのオペレータ選択を真のランダムに変更
  - MCPツールの説明文を改善し、引数なし実行（ランダム選択）をデフォルトとして強調
  - 未割り当て時のガイダンスメッセージから特定キャラクターへの誘導を削除
  - ランダム選択が通常の使い方であることを明示

- Updated dependencies [3283bc7]
- Updated dependencies [5f7b33e]
  - @coeiro-operator/audio@1.1.0
  - @coeiro-operator/core@1.1.1

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

### Patch Changes

- Updated dependencies [cca5ff8]
- Updated dependencies [df99cad]
  - @coeiro-operator/core@1.1.0
  - @coeiro-operator/audio@1.0.3

## 1.0.3

### Patch Changes

- npm パッケージに dist ディレクトリが含まれない問題を修正
  - audio, common パッケージ: distディレクトリが公開されていなかった問題を修正
  - すべてのパッケージ: files フィールドを追加し、ビルド成果物を明示的に含めるよう改善
  - すべてのパッケージ: prepublishOnly スクリプトを追加し、公開前のビルドを保証
  - mcp パッケージ: 修正された依存関係（audio, common）を参照するよう更新

- Updated dependencies
  - @coeiro-operator/audio@1.0.2
  - @coeiro-operator/common@1.0.2
  - @coeiro-operator/core@1.0.2

## 1.0.2

### Patch Changes

- npm レジストリで破損した 1.0.1 パッケージを修正
  - 1.0.1 のパブリッシュ時に発生した integrity checksum エラーを修正
  - pnpm 移行により今後の並列パブリッシュ問題を防止
  - パッケージの再パブリッシュにより正常なバージョンを提供

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- db96813: Fix deprecation warnings by adding --no-deprecation flag to all bin scripts
- Updated dependencies [f596a2d]
  - @coeiro-operator/audio@1.0.1
  - @coeiro-operator/common@1.0.1
  - @coeiro-operator/core@1.0.1
