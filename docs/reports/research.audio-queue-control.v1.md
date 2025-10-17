# 音声キューコントロール機能 調査メモ

## 調査日時
2025年1月16日

## 調査対象
- Issue #135: 再生状態の確認と操作
- 音声キューシステムの現状と拡張可能性

## 現在の実装状況

### SpeechQueueクラス (packages/audio/src/speech-queue.ts)

#### 既存機能
1. **getStatus()メソッド** - line: 151-157
   - 返り値:
     - queueLength: キューに残っているタスク数
     - isProcessing: 処理中フラグ
     - nextTaskId: 次に処理されるタスクのID（nullもあり）

2. **clear()メソッド** - line: 162-165
   - キューを完全にクリア
   - isProcessingフラグもfalseにリセット
   - **注意**: 現在再生中の音声は停止しない

3. **enqueue()メソッド** - line: 22-43
   - 返り値にqueueLengthを含む
   - MCPツールのsayコマンドはこの情報を返していない（responseTextには含まれていない）

### SayCoeiroinkクラス (packages/audio/src/index.ts)

#### 既存機能
1. **getSpeechQueueStatus()** - line: 148-153
   - SpeechQueue.getStatus()のラッパー

2. **clearSpeechQueue()** - line: 158-163
   - SpeechQueue.clear()のラッパー

### AudioPlayerクラス (packages/audio/src/audio-player.ts)

#### 重要な発見
1. **Speakerインスタンスの管理** - line: 429-560, 568-609
   - 各音声チャンクごとに新しいSpeakerインスタンスを作成
   - 再生完了後、自動的にcloseイベントで解放
   - **現在再生中のSpeakerへの参照を保持していない**

2. **playPCMData()メソッド** - line: 568-609
   - Promiseベースで再生完了を待機
   - speaker.end()で音声データを送信し、'close'イベントで完了を検知

### MCPサーバー実装 (packages/mcp/src/server.ts)

#### sayツール - line: 458-616
- 現在の返り値: `音声合成を開始しました - オペレータ: {characterId}`
- キュー情報（taskId, queueLength）は返していない

## 必要な機能と実装可能性

### 1. キュー状態確認機能 ✅ 実装可能
**必要な作業:**
- 新しいMCPツール `queue_status` を追加
- 既存のgetSpeechQueueStatus()を呼び出すだけ

### 2. キューキャンセル機能 ✅ 実装可能
**必要な作業:**
- 新しいMCPツール `queue_clear` を追加
- 既存のclearSpeechQueue()を呼び出すだけ

### 3. 再生停止機能 ⚠️ 要実装
**課題:**
- AudioPlayerがSpeakerインスタンスへの参照を保持していない
- 各チャンクが独立したSpeakerで再生される設計

**実装案:**
1. AudioPlayerにcurrentSpeakersのSetを追加
2. playPCMData()でSpeakerを登録、closeイベントで削除
3. stopPlayback()メソッドを追加し、全Speakerをdestroy()
4. SpeechQueueにstopCurrentTask()を追加
5. SayCoeiroinkにstopPlayback()を追加

## 型定義 (packages/audio/src/types.ts)

### SynthesizeResult
```typescript
interface SynthesizeResult {
  success: boolean;
  taskId: number;
  queueLength?: number;
}
```

### SpeechQueueStatus（新規追加が必要）
```typescript
interface SpeechQueueStatus {
  queueLength: number;
  isProcessing: boolean;
  nextTaskId: number | null;
  currentTaskId?: number | null; // 追加提案
}
```

## ドキュメントとコードの整合性

### 確認済みドキュメント
1. **docs/architecture/speech-queue-system.md**
   - getStatus()とclear()の記載あり（line: 193-199）
   - 再生停止機能の記載なし

2. **docs/architecture/audio-system.md**
   - Queue統一実装の説明あり
   - 再生停止機能の記載なし

3. **docs/features/audio-streaming-guide.md**
   - ストリーミング再生の詳細説明
   - 再生制御（停止・一時停止）の記載なし

### テストカバレッジ
- SpeechQueue.getStatus(): ✅ テスト済み
- SpeechQueue.clear(): ✅ テスト済み
- 再生停止機能: ❌ テストなし（未実装）

## 推奨される実装順序

1. **Phase 1: MCPツール追加（既存機能活用）**
   - queue_status ツール
   - queue_clear ツール
   - sayツールの返り値改善（queueLength追加）

2. **Phase 2: 再生停止機能の実装**
   - AudioPlayerの改修
   - SpeechQueueの拡張
   - SayCoeiroinkのAPI追加

3. **Phase 3: MCPツール追加（新機能）**
   - playback_stop ツール
   - 詳細なステータス情報（現在再生中のタスクID等）

## 参照したファイル
- packages/audio/src/speech-queue.ts
- packages/audio/src/index.ts
- packages/audio/src/audio-player.ts
- packages/audio/src/speech-queue.test.ts
- packages/mcp/src/server.ts
- docs/architecture/speech-queue-system.md
- docs/architecture/audio-system.md
- docs/features/audio-streaming-guide.md