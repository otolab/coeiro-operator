# Queue統一実装による CLI vs MCP 実行モード

## 概要

COEIRO Operatorは、SpeechQueueを基盤とした統一実装により、CLIツールとMCPサーバーで最適化された動作を提供します。すべての音声処理（ウォームアップ、音声合成、完了待機）がqueue経由で実行されます。

## Queue統一実装の設計

### 共通基盤：SpeechQueue
- **タスクタイプ**: `speech`, `warmup`, `completion_wait`
- **処理方式**: 順次キュー処理で一貫性を保証
- **柔軟性**: 同期・非同期実行を両方サポート

### CLI実行モード（queue統一版）
- **目的**: ユーザーが音声の完了を確認できる同期的な動作
- **メソッド**: `synthesizeText()` 
- **動作フロー**: 
  1. `enqueueWarmupAndWait()` - ドライバーウォームアップ
  2. `enqueueAndWait()` - 音声合成実行
  3. `enqueueCompletionWaitAndWait()` - 再生完了待機
- **特徴**: 全てqueue経由、同期的に完了を待機

### MCP実行モード（queue統一版）
- **目的**: Claude Codeの応答性を重視した非同期動作
- **メソッド**: `synthesizeTextAsync()` → `enqueue()`
- **動作フロー**: SpeechQueueにタスク投稿のみ
- **特徴**: 即座にレスポンス、ウォームアップ・完了待機なし

## 動作の特徴

### レスポンス時間
- **CLI**: 音声合成完了まで待機（数秒）
- **MCP**: 即座にレスポンス（< 100ms）

### レスポンス内容
- **CLI**: 完了後に結果を表示
- **MCP**: タスク投稿の確認のみ

### ログ出力
- 音声合成の完了ログは非同期で出力されます
- エラーが発生した場合も非同期でログに記録されます

## 利点

1. **高速なレスポンス**: Claude Codeの応答性向上
2. **並行実行**: 複数の音声合成タスクの同時実行が可能
3. **ユーザビリティ**: 長い音声でもツールがブロックされない
4. **システム安定性**: 音声合成エラーがMCPサーバーをブロックしない

## 注意点

- `say` の応答はキューへの追加を示すもので、再生完了を示すものではありません。
- `wait_for_task_completion` は個別 task ID を受け取らず、音声キュー全体を対象にします。既定の `remainingQueueLength: 0` では、キューが空で処理中タスクもない状態まで待ちます。0より大きい値は処理中タスクを含む完了待ちにはなりません。
- 待機の既定タイムアウトは30秒です。タイムアウト時は現在の状態を含む警告が通常のツール結果として返り、完了を意味しません。状態を `queue_status` で確認し、処理中または待機タスクが残っていれば再度待機してください。
- 待機が正常に終わっても、確認できるのはキュー処理が終了したことまでです。タスク処理中に発生したエラーはログに記録されますが、`wait_for_task_completion` はエラー一覧を返さないため、音声再生の成功までは保証できません。
- `wait_for_task_completion` はキューを予約・ロックしません。同じサーバーに別の呼び出し元が並行してタスクを追加する場合、待機完了後にキューが再び動き出す可能性があります。

## MCP Tasks protocol との違い

ここでいう「タスク」は COEIRO Operator 内部の SpeechQueue のタスクです。`say` は通常の MCP `tools/call` に対してアプリ内 task ID を含む tool result を返し、`wait_for_task_completion` や `queue_status` も通常の `tools/call` として提供します。MCP の task-augmented execution や `tasks/*` は使用していません。

SDK v2 移行後の `tools/list` では、v1 が返していた `execution.taskSupport: "forbidden"` が省略されます。MCP 2025-11-25 仕様では省略も forbidden を意味するため、通常の tool call と SpeechQueue の動作は変わりません。MCP 2026-07-28 仕様では Tasks は別 extension となっていますが、本サーバーはその extension を提供していません。

field の存在を前提とする独自 client からは JSON の形が変わって見えます。標準仕様に従う client は省略を task 非対応として扱えます。接続先の外部 client が field の存在を個別に確認しているかどうかは、このリポジトリからは確認できません。
