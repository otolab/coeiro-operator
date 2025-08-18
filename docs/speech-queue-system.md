# SpeechQueue統一実装システム

## 概要

SpeechQueueシステムは、COEIRO OperatorのQueue統一実装の中核となる音声タスク管理システムです。CLI/MCP実行モードの違いを統一的に処理し、同期/非同期実行を適切に制御します。

## アーキテクチャ

### 基本設計思想

```
【従来のアーキテクチャ】
CLI → synthesizeTextInternal() → 直接音声処理
MCP → synthesizeTextInternal() → 直接音声処理

【Queue統一実装】
CLI → synthesizeText() → SpeechQueue → 音声処理 (同期完了)
MCP → synthesizeTextAsync() → SpeechQueue → 音声処理 (非同期キューイング)
```

### コンポーネント構成

```typescript
class SpeechQueue {
  // タスクキューと実行制御
  private speechQueue: SpeechTask[]
  private isProcessing: boolean
  private taskIdCounter: number

  // CLI/MCP実行モード別メソッド
  enqueue()            // MCP用: 非同期キューイング
  enqueueAndWait()     // CLI用: 同期実行

  // タスクタイプ別処理
  enqueueWarmup()           // ウォームアップタスク
  enqueueCompletionWait()   // 完了待機タスク
}
```

## タスクタイプシステム

### サポートされるタスクタイプ

| タスクタイプ | 説明 | 使用場面 |
|-------------|------|----------|
| `speech` | 音声合成タスク | 全実行モード |
| `warmup` | ウォームアップタスク | CLI実行時 |
| `completion_wait` | 完了待機タスク | CLI実行時 |

### タスク構造

```typescript
interface SpeechTask {
  id: number                    // 一意のタスクID
  type: SpeechTaskType         // タスクタイプ
  text: string                 // 対象テキスト
  options: SynthesizeOptions   // 音声合成オプション
  timestamp: number            // 作成タイムスタンプ
  resolve?: () => void         // CLI用完了通知コールバック
  reject?: (error: Error) => void // CLI用エラー通知コールバック
}
```

## 実行モード別動作

### CLI実行モード（同期処理）

**呼び出し**: `synthesizeText()`

**処理フロー**:
1. **ウォームアップタスク**: `enqueueWarmupAndWait()`
2. **音声合成タスク**: `enqueueAndWait(text, options)`  
3. **完了待機タスク**: `enqueueCompletionWaitAndWait()`

**特徴**:
- 各タスクの完了を同期的に待機
- ユーザーが完了を確認できる
- ファイル出力時はウォームアップ・完了待機をスキップ

```typescript
// CLI実行例
const result = await sayCoeiroink.synthesizeText("こんにちは", {
  voice: "test-voice"
});
// ここで音声再生が完全に終了している
```

### MCP実行モード（非同期キューイング）

**呼び出し**: `synthesizeTextAsync()`

**処理フロー**:
1. **音声合成タスクのみ**: `enqueue(text, options)`
2. **即座にレスポンス**: `{ success: true, taskId: number }`
3. **背景で非同期実行**: キュー処理が継続

**特徴**:
- Claude Codeの応答性を最優先
- ウォームアップや完了待機なし  
- バックグラウンド実行

```typescript
// MCP実行例
const result = await sayCoeiroink.synthesizeTextAsync("こんにちは", {
  voice: "test-voice"
});
// { success: true, taskId: 12345 }
// 音声再生は背景で継続実行
```

## キュー処理システム

### 処理ループ

```typescript
private async processQueue(): Promise<void> {
  if (this.isProcessing || this.speechQueue.length === 0) {
    return;
  }

  this.isProcessing = true;
  
  while (this.speechQueue.length > 0) {
    const task = this.speechQueue.shift()!;
    try {
      await this.processCallback(task);
      if (task.resolve) task.resolve();
    } catch (error) {
      if (task.reject) task.reject(error as Error);
      logger.error(`タスク実行エラー: ${error}`);
    }
  }
  
  this.isProcessing = false;
}
```

### エラーハンドリング

- **CLI実行**: エラー時にPromiseが reject される
- **MCP実行**: エラーログ出力のみ、キュー処理は継続
- **タスク独立性**: 1つのタスクエラーが他に影響しない

## APIレスポンス構造の変更

### 従来のレスポンス（削除済み）

```typescript
// 従来（削除済み）
{
  success: boolean;
  mode: string;           // 'streaming' | 'normal' | 'file'
  outputFile?: string;    // ファイル出力時のパス
}
```

### 新しいレスポンス（Queue統一実装）

```typescript
// 新しいレスポンス
{
  success: boolean;
  taskId: number;         // 一意のタスクID
  queueLength?: number;   // キュー長（デバッグ用）
}
```

## パフォーマンス特性

### メモリ効率

- **タスクオブジェクト**: 軽量構造（<1KB/タスク）
- **キュー管理**: 配列ベース、O(1) push/shift操作
- **ガベージコレクション**: タスク完了時に自動解放

### 応答性

- **MCP実行**: <10ms でレスポンス（キューイングのみ）
- **CLI実行**: 音声処理時間に依存（通常1-3秒）
- **並行処理**: 複数MCPリクエストの効率的な順次処理

### スケーラビリティ

- **キュー長**: 理論上無制限（実用的には100タスク以内推奨）
- **メモリ使用量**: 線形増加（約1KB × キュー長）
- **処理速度**: COEIROINK APIのボトルネックに依存

## 設定とカスタマイズ

### デバッグ機能

```typescript
// キュー状態取得
const status = sayCoeiroink.getSpeechQueueStatus();
// { queueLength: 3, isProcessing: true }

// キュークリア
sayCoeiroink.clearSpeechQueue();
```

### ログ出力

- **タスク追加**: `DEBUG` レベルでタスクID・タイプを記録
- **処理開始/完了**: `INFO` レベルで実行状況を記録  
- **エラー**: `ERROR` レベルで詳細なエラー情報を記録

## 開発者向け情報

### テストガイドライン

- **統合テスト**: APIレスポンス構造の変更に注意（`result.taskId` vs `result.mode`）
- **E2Eテスト**: CLI/MCP実行モードの動作差異を検証
- **レガシーテスト**: 削除されたメソッド（`synthesizeTextInternal`）に依存しない

### トラブルシューティング

- **キュー停止**: `clearSpeechQueue()` でリセット
- **メモリリーク**: タスク完了時のresolve/reject呼び出し確認
- **性能問題**: 並行生成設定との組み合わせ確認

## 関連ドキュメント

- [audio-system.md](./audio-system.md) - 音声システム全体仕様
- [development-tips.md](./development-tips.md) - 開発Tips（Queue統一実装対応）
- [testing-guide.md](./testing-guide.md) - テスト実行ガイド