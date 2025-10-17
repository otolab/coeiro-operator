# 音声再生単位と分割モード分析

## 分割モードの種類

### 1. punctuation（句読点分割）- デフォルト
- **分割基準**: 句読点（。！？）で分割
- **最大チャンクサイズ**: 150文字
- **最小チャンクサイズ**: 10文字
- **オーバーラップ**: なし（0文字）
- **特徴**:
  - 自然な日本語の区切りで分割
  - 短い文は結合して適切な長さに調整
  - 長い文は読点（、）でさらに分割可能

### 2. small（小分割）
- **チャンクサイズ**: 30文字（デフォルト）
- **オーバーラップ**: 3文字（10%）
- **用途**: 低レイテンシ重視

### 3. medium（中分割）
- **チャンクサイズ**: 50文字（デフォルト）
- **オーバーラップ**: 5文字（10%）
- **用途**: バランス型

### 4. large（大分割）
- **チャンクサイズ**: 100文字（デフォルト）
- **オーバーラップ**: 10文字（10%）
- **用途**: 品質重視

### 5. none（分割なし）
- **チャンクサイズ**: 無限大（全文を1チャンク）
- **オーバーラップ**: なし
- **用途**: 短文向け、分割不要な場合

## 再生フロー

### 音声合成から再生までの流れ

```
テキスト入力
    ↓
splitTextIntoChunks() - 分割モードに基づいてチャンク作成
    ↓
各チャンクごとに：
    ↓
synthesizeChunk() - COEIROINKで音声合成
    ↓
AudioResult（WAVデータ）生成
    ↓
playAudioStream() - 音声再生
    ↓
createSpeaker() - 新規Speakerインスタンス作成
    ↓
speaker.end() - データ送信・終了
    ↓
closeイベント - 自動破棄
```

## 現在の問題点

### 1. チャンク単位での停止が困難な理由

- **Speakerインスタンスへの参照なし**: 各チャンクで新規作成・即破棄
- **非同期処理**: 各チャンクが独立して非同期で処理される
- **キューとの分離**: SpeechQueueはタスク管理のみ、再生制御は別

### 2. 停止時の挙動

現在の実装では：
- queue_clear: キューからタスクを削除（**未処理のチャンクのみ**）
- 再生中のチャンク: **停止できない**（Speakerへの参照なし）

## 改善提案

### Option 1: チャンク境界での停止（実装しやすい）

```typescript
class AudioPlayer {
  private shouldStop: boolean = false;
  private currentSpeaker: Speaker | null = null;

  async playStreamingAudio(audioStream) {
    this.shouldStop = false;

    for await (const audioResult of audioStream) {
      if (this.shouldStop) {
        break; // チャンク境界で停止
      }
      await this.playAudioStream(audioResult);
    }
  }

  async stop() {
    this.shouldStop = true;
    if (this.currentSpeaker) {
      this.currentSpeaker.destroy();
      this.currentSpeaker = null;
    }
  }
}
```

**利点**:
- 実装が簡単
- チャンク境界できれいに停止
- 次のチャンクは開始されない

**欠点**:
- 現在再生中のチャンクは最後まで再生される可能性

### Option 2: 即座停止（完全実装）

```typescript
class AudioPlayer {
  private currentSpeaker: Speaker | null = null;
  private isPlaying: boolean = false;

  private async playPCMData(pcmData) {
    const speaker = await this.createSpeaker();
    this.currentSpeaker = speaker;
    this.isPlaying = true;

    return new Promise((resolve, reject) => {
      speaker.once('close', () => {
        this.currentSpeaker = null;
        this.isPlaying = false;
        resolve();
      });

      speaker.end(Buffer.from(pcmData));
    });
  }

  async stopImmediately() {
    if (this.currentSpeaker && this.isPlaying) {
      this.currentSpeaker.destroy();
      this.currentSpeaker = null;
      this.isPlaying = false;
    }
  }
}
```

**利点**:
- 即座に停止可能
- 現在再生中の音声も中断

**欠点**:
- ブツ切れ感がある可能性

## 推奨される実装方針

### Phase 1: チャンク境界停止
- Option 1を実装
- shouldStopフラグでチャンク間の制御
- 自然な停止ポイントで終了

### Phase 2: 即座停止オプション
- Option 2も追加実装
- 停止モードを選択可能に
  - soft: チャンク境界で停止
  - hard: 即座に停止

### Phase 3: フェードアウト停止
- 停止時に音量フェードアウト
- より自然な停止体験

## 分割モードと停止の関係

分割モードによって停止の粒度が変わる：

- **punctuation**: 文単位で停止（自然）
- **small**: 30文字ごとに停止可能（細かい制御）
- **medium**: 50文字ごとに停止可能（バランス）
- **large**: 100文字ごとに停止可能（粗い制御）
- **none**: 全文再生するか全く再生しないか

→ **punctuation（句読点）モードが最も自然な停止を実現できる**