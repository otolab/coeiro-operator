# ChunkGenerationManager 仕様書

## 目的

**再生の遅延を防ぐためにバックグラウンドで生成処理を走らせる**

音声チャンクを並行して生成することで、再生時のレイテンシを削減し、スムーズなストリーミング再生を実現する。

## 責務

### 1. 並行チャンク生成の管理

- 複数のチャンクを同時に生成（並行処理）
- 最大並行数の制御（リソース管理）
- 生成完了順序に関係なく、論理順序（index順）で結果を提供

### 2. TaskQueueとの違い

| 観点 | TaskQueue | ChunkGenerationManager |
|------|-----------|------------------------|
| **処理方式** | 逐次実行（1つずつ） | 並行実行（複数同時） |
| **目的** | タスクのライフサイクル管理 | レイテンシ削減 |
| **責務** | Orchestrator | 並行生成制御 |
| **エラー処理** | OpenPromiseパターン | （要改善） |

## 機能要件

### 1. 並行制御

```typescript
interface GenerationOptions {
  maxConcurrency: number;        // 最大並行生成数（デフォルト: 2）
  delayBetweenRequests: number;  // リクエスト間隔（ms、デフォルト: 100ms）
  pauseUntilFirstComplete: boolean; // 初回チャンク完了まで並行生成をポーズ
  bufferAheadCount: number;      // 先読みチャンク数（未実装？要確認）
}
```

### 2. 処理フロー

```
[チャンク0, 1, 2, 3 がある場合]

1. チャンク0の生成開始（maxConcurrency=2の場合）
2. チャンク1の生成開始（並行）
3. チャンク0完了 → pauseUntilFirstComplete解除
4. チャンク2の生成開始（並行数制限内で）
5. チャンク1完了
6. チャンク3の生成開始
...

[結果の取得]
- getResult(0) → チャンク0の結果（完了まで待機）
- getResult(1) → チャンク1の結果（完了まで待機）
- 順序通りに取得される
```

### 3. エラー処理

**要件:**
- 一部のチャンクで生成エラーが発生しても、他のチャンクの生成は継続
- エラーはgetResult()呼び出し時にthrow
- **Unhandled Rejectionを発生させない**（現在の問題点）

### 4. メモリ管理

- 完了した結果は取得後にクリア
- 失敗したタスクのエラー情報も取得後にクリア
- clear()で全タスクをクリーンアップ

## 非機能要件

### 1. パフォーマンス

- 並行生成により、逐次生成と比較してレイテンシを削減
- リソース消費を制御するため、並行数を制限

### 2. 信頼性

- **Promiseのエラーハンドリングが確実に行われること**
- テスト環境でUnhandled Rejectionを発生させないこと
- エラー発生時も安全にクリーンアップできること

### 3. 保守性

- 複雑な状態管理を避ける
- 既存の実証済みパターン（OpenPromise等）を活用

## 現在の問題

### 1. Unhandled Rejection

**問題の本質:**
```typescript
// synthesizeFunction()が返すPromiseにcatchが設定されていない
const handledPromise = new Promise((resolve) => {
  this.synthesizeFunction(chunk, voiceConfig, speed)  // ← 元のPromise
    .then((result) => { ... })
    .catch((error) => { ... });
});
```

元のPromiseは独立して存在し、新しいPromiseでラップしてもcatchされない。

**影響:**
- テストでUnhandled Rejectionが検出される
- テスト自体は成功するが、警告が出る
- 本番環境でのエラーハンドリングに不安

### 2. 複雑な状態管理

```typescript
private activeTasks: Map<number, GenerationTask>;
private completedResults: Map<number, AudioResult>;
private failedTasks: Map<number, Error>;
private firstChunkCompleted: boolean;
```

複数の状態を管理しており、TaskQueueと類似した構造だが、OpenPromiseパターンを使っていない。

## 改善案（検討中）

### Option A: OpenPromiseパターンの適用

TaskQueueで実証済みの方法を適用：

```typescript
// 1. Promiseを先に作る
let resolveTask!: (result: AudioResult) => void;
let rejectTask!: (error: Error) => void;
const taskPromise = new Promise<AudioResult>((resolve, reject) => {
  resolveTask = resolve;
  rejectTask = reject;
});

// 2. 即座にcatchを設定
taskPromise.catch(() => {}); // Unhandled Rejection防止

// 3. 後から処理を実行し、外部から制御
this.synthesizeFunction(chunk, voiceConfig, speed)
  .then(resolveTask)
  .catch(rejectTask);
```

### Option B: 元のPromiseに即座にcatch設定

```typescript
const synthesisPromise = this.synthesizeFunction(chunk, voiceConfig, speed);
// 即座にcatchを設定してUnhandled Rejectionを防ぐ
synthesisPromise.catch(() => {});

const handledPromise = synthesisPromise
  .then((result) => { ... })
  .catch((error) => { ... });
```

### Option C: async/awaitで同期的に処理

```typescript
async startGeneration(...) {
  try {
    const result = await this.synthesizeFunction(chunk, voiceConfig, speed);
    this.onTaskCompleted(chunk.index, result);
  } catch (error) {
    this.onTaskFailed(chunk.index, error);
  }
}
```

ただし、並行処理の仕組みを見直す必要がある。

## 次のステップ

1. この仕様書をレビュー
2. 改善案の選択
3. 実装とテスト
4. 既存のアーキテクチャドキュメントへの統合

## 関連ドキュメント

- `architecture-analysis-final.md` - TaskQueue/Orchestratorの設計
- `architecture-improvement-proposal.md` - アーキテクチャ改善計画
- `research-report.play-synthesis-queue.v1.md` - OpenPromiseパターンの詳細
