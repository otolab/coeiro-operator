# Issue 135 Phase 2 調査レポート

## 調査日時
2025年1月16日

## 調査概要
Issue #135 Phase 2の実装に向けた音声キューシステムの調査

## Phase 1の実装状況（完了済み）

### 実装済み機能
1. **queue_status MCPツール** - packages/mcp/src/server.ts:1020
   - キュー長、処理状態、次のタスクIDを返す

2. **queue_clear MCPツール** - packages/mcp/src/server.ts:1062
   - 待機中の全タスクを削除
   - 現在再生中の音声は停止しない

3. **sayツールの返り値改善**
   - taskIdとqueueLengthを返すように改善済み

## Phase 2の実装候補

### 1. タスクID指定キャンセル機能（優先度：高）

#### 現在の実装
- `SpeechQueue.clear()` - packages/audio/src/speech-queue.ts:162-165
  - 引数なし、全タスクをクリア
  - `this.speechQueue = []` で配列を空にする

#### 実装方針
**Option A: clearメソッドを拡張（推奨）**
```typescript
// packages/audio/src/speech-queue.ts
clear(taskIds?: number[]): { removedCount: number } {
  if (!taskIds || taskIds.length === 0) {
    // 既存の動作：全クリア
    const count = this.speechQueue.length;
    this.speechQueue = [];
    this.isProcessing = false;
    return { removedCount: count };
  }

  // 新機能：指定タスクのみ削除
  const before = this.speechQueue.length;
  this.speechQueue = this.speechQueue.filter(
    task => !taskIds.includes(task.id)
  );
  return { removedCount: before - this.speechQueue.length };
}
```

**Option B: 新メソッド追加**
```typescript
// packages/audio/src/speech-queue.ts
removeTask(taskId: number): boolean {
  const index = this.speechQueue.findIndex(task => task.id === taskId);
  if (index !== -1) {
    this.speechQueue.splice(index, 1);
    return true;
  }
  return false;
}
```

#### MCPツール拡張
```typescript
// packages/mcp/src/server.ts
server.registerTool(
  'queue_clear',
  {
    description: '音声キューをクリアします。taskIdsを指定すると特定のタスクのみ削除できます。',
    inputSchema: {
      type: 'object',
      properties: {
        taskIds: {
          type: 'array',
          items: { type: 'number' },
          description: '削除するタスクIDのリスト（省略時は全タスク削除）'
        }
      }
    }
  },
  async ({ taskIds }): Promise<ToolResponse> => {
    const result = sayCoeiroink.clearSpeechQueue(taskIds);
    return {
      content: [{
        type: 'text',
        text: taskIds
          ? `✅ ${result.removedCount}個のタスクを削除しました`
          : `✅ キュー内の全タスク（${result.removedCount}個）を削除しました`
      }]
    };
  }
);
```

### 2. 再生停止機能（優先度：中）

#### 課題
- AudioPlayerがSpeakerインスタンスへの参照を保持していない
- packages/audio/src/audio-player.ts:568-609

#### 実装要件
1. AudioPlayerにcurrentSpeakersのSet追加
2. playPCMData()でSpeaker登録、closeイベントで削除
3. stopPlayback()メソッド追加
4. MCPツール `playback_stop` 追加

### 推奨実装順序

1. **タスクID指定キャンセル機能を先に実装**
   - ユーザーから明示的に要望あり
   - 実装が比較的シンプル
   - 既存のclear()メソッドの拡張で対応可能

2. **再生停止機能は別PRで実装**
   - AudioPlayerの大幅な改修が必要
   - Speakerインスタンス管理の追加
   - より慎重なテストが必要

## テスト要件

### タスクID指定キャンセル機能
- 単一タスクの削除
- 複数タスクの削除
- 存在しないタスクIDの指定
- 空配列の指定（全削除と同じ動作）
- undefined指定（全削除）

### 既存テストへの影響
- packages/audio/src/speech-queue.test.ts の更新が必要
- 後方互換性の確認（引数なしclear()の動作）

## ドキュメント更新箇所

1. **docs/architecture/speech-queue-system.md**
   - clearメソッドの仕様追記
   - タスクID指定削除の説明

2. **prompts/MCP_TOOLS_USAGE_GUIDE.md**
   - queue_clearツールの引数説明追加

## リスク評価

### タスクID指定キャンセル
- **リスク：低**
- 既存機能への影響最小限
- 後方互換性維持可能

### 再生停止機能
- **リスク：中**
- AudioPlayerの内部状態管理変更
- メモリリーク対策が必要

## 結論

Phase 2では**タスクID指定キャンセル機能**を優先実装することを推奨します。
ユーザーの提案「clearの引数にいれるのが簡単」の通り、clear()メソッドを拡張する方針が最も合理的です。