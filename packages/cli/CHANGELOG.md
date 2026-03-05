# @coeiro-operator/cli

## 1.5.4

### Patch Changes

- Updated dependencies [371cb15]
  - @coeiro-operator/core@1.4.3
  - @coeiro-operator/audio@1.3.4

## 1.5.3

### Patch Changes

- @coeiro-operator/core@1.4.2
- @coeiro-operator/audio@1.3.3

## 1.5.2

### Patch Changes

- Updated dependencies [3c0c732]
  - @coeiro-operator/audio@1.3.2

## 1.5.1

### Patch Changes

- Updated dependencies [a0b1e1d]
  - @coeiro-operator/core@1.4.1
  - @coeiro-operator/audio@1.3.1

## 1.5.0

### Minor Changes

- 4c25a96: iTmux/tmux環境での複数セッション対応
  - セッションID取得を非同期関数化し、tmux環境ではコマンドを動的に実行
  - `getSessionId()` を独立した非同期関数としてexport
  - `OperatorManager` のconstructorで `sessionId` を受け取るように変更
  - 環境変数の優先順位: ITMUX_PROJECT → TMUX（動的取得） → ITERM_SESSION_ID → TERM_SESSION_ID → PID
  - 名前空間衝突を防ぐため、セッションIDにプレフィックスを追加 (例: `ITMUX_PROJECT:coeiro_operator`, `TMUX:myproject_0`)
  - `TerminalBackground` も `initialize()` メソッドでセッションIDを非同期取得

  refs #215

### Patch Changes

- 9a38874: 使われていないワークフローファイルを削除
  - release.ymlを削除（緊急時用バックアップワークフローは不要）
  - release-branch.yml内の無効化されたcreate-release-prジョブを削除

- Updated dependencies [9a38874]
- Updated dependencies [4c25a96]
  - @coeiro-operator/core@1.4.0
  - @coeiro-operator/audio@1.3.0

## 1.4.5

### Patch Changes

- 91a1fe8: npm Trusted Publishingに対応

  リリースワークフローでnpmのTrusted Publishing（Provenance）を使用するように変更しました。これによりより安全なパッケージ公開が可能になります。

- Updated dependencies [91a1fe8]
  - @coeiro-operator/core@1.3.3
  - @coeiro-operator/audio@1.2.10

## 1.4.4

### Patch Changes

- Updated dependencies [e028653]
  - @coeiro-operator/core@1.3.2
  - @coeiro-operator/audio@1.2.9

## 1.4.3

### Patch Changes

- Updated dependencies [88cea0a]
  - @coeiro-operator/audio@1.2.8

## 1.4.2

### Patch Changes

- 25bd21a: console.logをloggerに統一してログレベル管理を改善

  全てのconsole.logをloggerに置き換え、ログレベルの統一管理を実現しました。

  **変更内容:**
  - MCPサーバー起動時の不要なログ出力を削除
  - packages/core: console.log → logger.debug に置き換え
  - packages/cli: console.log → logger.info、console.error → logger.error に置き換え
  - ログレベル設定による出力制御が可能に

  **影響範囲:**
  - テストファイルとデバッグツールは対象外（console.log維持）
  - 独立したツール（setup-python-env.cjs）は対象外

- Updated dependencies [25bd21a]
  - @coeiro-operator/core@1.3.1
  - @coeiro-operator/audio@1.2.7

## 1.4.1

### Patch Changes

- Updated dependencies [8707181]
  - @coeiro-operator/audio@1.2.6

## 1.4.0

### Minor Changes

- f979ff0: キャラクター登録・測定機能をCLIに追加

  operator-managerコマンドに3つの新しいコマンドを追加しました:
  - `list-unmeasured [--json]`: 未計測のSpeaker/Styleを表示
  - `add-character <characterId> <speakerName>`: キャラクターを新規登録
  - `measure <characterId> [--style=スタイル名] [--dry-run]`: 話速を測定して設定を更新

  主な変更:
  - ConfigManager.updateCharacterConfig(): スタイルマージ機能を追加
  - OperatorManager.detectUnregisteredSpeakers(): 未登録Speaker検出機能
  - OperatorManager.measureCharacterSpeechRate(): 話速測定機能（登録済みキャラクター用）
  - SpeechRateMeasurer: 話速測定ロジックを独立したクラスに分離

### Patch Changes

- Updated dependencies [f979ff0]
- Updated dependencies [f5e8483]
  - @coeiro-operator/core@1.3.0
  - @coeiro-operator/audio@1.2.5

## 1.3.4

### Patch Changes

- Updated dependencies [9687dca]
  - @coeiro-operator/audio@1.2.4

## 1.3.3

### Patch Changes

- Updated dependencies [ef7153f]
- Updated dependencies [9175d6e]
  - @coeiro-operator/audio@1.2.3
  - @coeiro-operator/core@1.2.3

## 1.3.2

### Patch Changes

- Updated dependencies [b89cd4a]
  - @coeiro-operator/core@1.2.2
  - @coeiro-operator/audio@1.2.2

## 1.3.1

### Patch Changes

- Updated dependencies [ce450dc]
  - @coeiro-operator/core@1.2.1
  - @coeiro-operator/audio@1.2.1

## 1.3.0

### Minor Changes

- b74f15a: Commander.jsの導入によるCLI引数解析の改善
  - 手動の引数解析をcommander.jsライブラリに置き換え
  - 自動ヘルプメッセージ生成
  - 型安全性の向上
  - より良いバリデーション機能
  - コード保守性の大幅な向上

## 1.2.1

### Patch Changes

- 7969a16: operator-managerコマンドが動作しない問題を修正

  import.meta.urlの比較が原因でCLIが起動しない問題を修正。
  npmでインストールされた場合、シンボリックリンク経由で実行されるため、
  パスが一致せず実行されない問題があった。

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
  - @coeiro-operator/audio@1.2.0
  - @coeiro-operator/core@1.2.0

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

## 1.0.2

### Patch Changes

- Updated dependencies
  - @coeiro-operator/audio@1.0.2
  - @coeiro-operator/common@1.0.2
  - @coeiro-operator/core@1.0.2

## 1.0.1

### Patch Changes

- f596a2d: Add README documentation for all packages and update MCP usage examples
- db96813: Fix deprecation warnings by adding --no-deprecation flag to all bin scripts
- Updated dependencies [f596a2d]
  - @coeiro-operator/audio@1.0.1
  - @coeiro-operator/common@1.0.1
  - @coeiro-operator/core@1.0.1
