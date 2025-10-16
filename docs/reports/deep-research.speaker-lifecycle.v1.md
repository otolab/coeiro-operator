# Speakerインスタンス ライフサイクル深掘り調査

## 調査日時
2025年1月16日

## 調査目的
- Speakerインスタンスが本当に使い捨てなのか確証を得る
- 並行実行時のインスタンス管理を完全に理解する
- メモリリークの可能性を検証する

## 調査ログ

### 1. Speaker作成箇所の全数調査

#### createSpeaker呼び出し箇所
1. **playPCMData()** (行580)
2. **processAudioStreamPipeline()** (行219)

#### playPCMData()のライフサイクル分析（行568-609）
```typescript
// 行580: 新規作成
const speaker = await this.createSpeaker(actualSampleRate, finalBufferSize);

// 行584-586: closeイベントでPromise解決
speaker.once('close', () => {
  logger.debug('Speaker close event received');
  resolve();
});

// 行607: データ送信後、即座に終了
speaker.end(Buffer.from(processedData));
```

**重要な発見**:
- `speaker.end()`が呼ばれると、データ送信後に自動的にストリームが終了
- closeイベントが発火し、Speakerインスタンスは破棄される
- **インスタンスへの参照は一切保持されない（ローカル変数のみ）**

#### processAudioStreamPipeline()のライフサイクル分析（行215-262）
```typescript
// 行219: 新規作成
const streamSpeaker = await this.createSpeaker(this.playbackRate, BUFFER_SIZES.DEFAULT);

// 行222-224: closeイベントでPromise解決
streamSpeaker.on('close', () => {
  resolve();
});

// 行252: パイプライン接続
pipeline.pipe(streamSpeaker);

// 行256: Transform streamを終了（これによりSpeakerも終了）
resampleTransform.end();
```

**重要な発見**:
- Transform streamのパイプライン終了時にSpeakerも自動終了
- 同様にインスタンスへの参照は保持されない

### 2. 並行実行パターンの詳細分析

#### playStreamingAudioParallel()（行392-424）
```typescript
const playQueue: Promise<void>[] = [];

for await (const audioResult of audioStream) {
  // 行402: 非同期で再生（awaitなし）
  const playPromise = this.playAudioStream(audioResult).catch(...);

  playQueue.push(playPromise);

  // 行408-416: 最大3チャンクまでの並列再生
  if (playQueue.length >= 3) {
    await Promise.race(playQueue);
    // 完了したPromiseを削除（バグあり：常にfalseになる）
  }
}

await Promise.all(playQueue);
```

**重要な発見**:
- **最大3個のSpeakerインスタンスが同時に存在しうる**
- 各インスタンスは独立して動作し、完了時に自動破棄
- インスタンスへの参照は保持されない（Promiseのみ管理）
- 行412-414のPromise削除ロジックにバグ（Promise.resolve()との比較は常にfalse）

#### playStreamingAudio()（通常版）（行371-387）
```typescript
for await (const audioResult of audioStream) {
  // 行382: 同期的に再生（awaitあり）
  await this.playAudioStream(audioResult, bufferSize);
}
```

**特徴**:
- 順次実行（1つのSpeakerインスタンスのみ）
- チャンク完了後に次のチャンクを処理

### 3. メモリリーク対策の検証

#### イベントリスナー管理
1. **playPCMData()**:
   - `speaker.once('close', ...)` - 一度のみ実行、自動削除
   - `speaker.once('error', ...)` - 一度のみ実行、自動削除
   - **リーク対策**: OK（onceなので自動削除）

2. **processAudioStreamPipeline()**:
   - `streamSpeaker.on('close', ...)` - **注意: onを使用**
   - `streamSpeaker.on('error', ...)` - **注意: onを使用**
   - **潜在的な問題**: リスナーが明示的に削除されない

#### リソース解放パターン
```typescript
// playPCMData()
speaker.end(Buffer.from(processedData));
// → endによってストリームが終了
// → closeイベントが発火
// → Promiseが解決
// → Speakerインスタンスがスコープ外になり、GCの対象に

// processAudioStreamPipeline()
resampleTransform.end();
// → Transform streamが終了
// → パイプライン全体が終了
// → Speakerも自動的に終了
// → closeイベントが発火
```

**結論**:
- 基本的にリークフリーな設計
- processAudioStreamPipelineのイベントリスナーは改善の余地あり

### 4. 実際の音声再生フロー

#### 呼び出しチェーン
```
SayCoeiroink.synthesize()
└── SpeechQueue.enqueue()
    └── processCallback()
        └── SynthesisProcessor.process()
            └── processStreamingOutput()
                └── AudioPlayer.playStreamingAudio() ← 通常版（順次実行）
                    └── playAudioStream()
                        └── playPCMData() or processAudioStreamPipeline()
                            └── createSpeaker() ← 新規インスタンス作成
```

**重要な発見**:
- **playStreamingAudioParallelは実際には使われていない**（デッドコード）
- 実際の再生は常に順次実行（1つのSpeakerインスタンスのみ）
- 各チャンク再生ごとに新しいSpeakerインスタンスを作成

### 5. Speakerインスタンスの使い捨て設計の確証

#### 設計意図
1. **シンプルさ**: インスタンス管理の複雑さを回避
2. **リークフリー**: 自動的にリソースが解放される
3. **状態レス**: 各チャンクが独立した再生単位

#### ライフサイクルまとめ
```
作成 → データ送信 → 自動終了 → 破棄
(new) → (end())   → (close)  → (GC)
```

**確証**:
- **Speakerインスタンスは完全に使い捨て**
- 各音声チャンクごとに新規作成・自動破棄
- インスタンスへの参照は一切保持されない