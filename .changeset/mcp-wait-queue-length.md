---
"@coeiro-operator/mcp": patch
"@coeiro-operator/audio": patch
---

wait_for_task_completionにremainingQueueLengthオプションを追加（イベントベース実装）

`wait_for_task_completion`ツールに、キューが指定数になったときに待ちを解除する`remainingQueueLength`オプションを追加しました。

**使用例:**
```typescript
// キューが1個になったら解除
wait_for_task_completion({ remainingQueueLength: 1 })

// すべてのタスクが完了するまで待機（既存の動作）
wait_for_task_completion({ remainingQueueLength: 0 })
wait_for_task_completion()
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
