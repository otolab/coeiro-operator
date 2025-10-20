# タスクキュー実装：Orchestrationパターン

TaskQueueは単なるキューではなく、Orchestratorパターンを実装している。

## OpenPromiseパターンによるPromise制御

TaskQueueでは、Promiseの制御ハンドル（resolve/reject）を外部に保持する「OpenPromiseパターン」を採用している。これにより：
- Promiseの制御を外部から行える
- エラーハンドリングを確実に設定できる
- Unhandled Rejectionを防げる

実装は `src/queue/task-queue.ts:32-46` を参照。ChunkGenerationManagerでも同パターンの適用が必要。

## エラー伝播の仕組み

エラーは以下の経路で伝播する（6ステップ）：

1. **AudioSynthesizer** (`audio-synthesizer.ts`) - HTTP 500エラー発生 → throw
2. **AudioStreamController** (`audio-stream-controller.ts`) - AsyncGenerator内でcatch & re-throw
3. **AudioPlayer** (`audio-player.ts`) - `for await`内で自動的に例外として伝播
4. **SynthesisProcessor** (`synthesis-processor.ts`) - processCallback内でエラー発生
5. **TaskQueue** (`queue/task-queue.ts`) - try-catchでcatch → errors配列に保存 → task.reject(error) → task.promise.catch()でUnhandled Rejection防止
6. **waitCompletion** (`index.ts`) - errors配列から最初のエラーをthrow

この仕組みにより、深い階層のエラーも確実に上位に伝播し、Unhandled Rejectionを防ぐ。

## 非同期処理のタイミング

TaskQueue.enqueue()は`setTimeout(0)`で非同期実行を遅延し、イベントループの次のタイミングで処理を開始する（`queue/task-queue.ts:51-57`）。これにより：

**同期処理フェーズ:**
- `SayCoeiroink.synthesize()` → `SpeechQueue.enqueueSpeech()` → `TaskQueue.enqueue()`
- OpenPromiseパターンでPromise作成
- `setTimeout(0)`で非同期処理をスケジュール
- taskPromiseを即座に返す

**非同期処理フェーズ（イベントループ次回）:**
- `TaskQueue.processQueue()` - whileループで順次処理
- `processCallback = SynthesisProcessor.process()` → 音声合成（generator） → 音声再生
- 成功: task.resolve() / 失敗: task.reject(error) + promise.catch()

この2フェーズ構造により、呼び出し元をブロックせずに順次処理を実現している。
