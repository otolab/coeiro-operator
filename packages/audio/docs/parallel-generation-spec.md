# 並列チャンク生成機能 仕様書

## 目的

**音声再生の遅延を防ぐため、バックグラウンドで並列にチャンク生成を行う**

音声は一つながりの一連のデータが完全に生成されたときにだけ意味を持つ。1つでも失敗すれば、その時点で処理を終了する必要がある。

---

## 1. 基本仕様

### 1.1 インターフェース

```typescript
class ChunkGenerationManager {
  /**
   * チャンク配列を並列生成し、順序保証されたストリームを返す
   *
   * @param chunks - 生成対象のチャンク配列（既に分割済み）
   * @param speakSettings - 音声設定（全チャンク共通）
   * @returns 順序保証された音声結果のストリーム
   *
   * @throws エラーは throw せず、GenerationResult.error として返す
   *         エラー発生時はストリームを即座に終了
   */
  async *generate(
    chunks: Chunk[],
    speakSettings: SpeakSettings
  ): AsyncGenerator<GenerationResult>
}
```

### 1.2 型定義

```typescript
/**
 * 音声設定（1回の音声合成タスク全体で共通）
 */
interface SpeakSettings {
  speaker: Speaker;
  styleId: number;
  speed: number;

  // 将来的に可変にする場合（現在は未使用、デフォルト値を使用）
  volume?: number;      // デフォルト: 1.0
  pitch?: number;       // デフォルト: 0.0
  intonation?: number;  // デフォルト: 1.0
}

/**
 * チャンク生成結果（成功 or 失敗）
 */
type GenerationResult =
  | { success: true; data: AudioResult }
  | { success: false; error: Error; chunkIndex: number }

/**
 * 音声結果（従来通り）
 */
interface AudioResult {
  chunk: Chunk;
  audioBuffer: ArrayBuffer;
  latency: number;
}
```

### 1.3 使用例

```typescript
const manager = new ChunkGenerationManager(synthesizeFunction, {
  maxConcurrency: 2,
  bufferAheadCount: 1,
});

const chunks = splitTextIntoChunks(text, 'punctuation');
const speakSettings: SpeakSettings = {
  speaker: voiceConfig.speaker,
  styleId: voiceConfig.selectedStyleId,
  speed: 1.0,
};

// チャンク配列を渡してストリーム取得
for await (const result of manager.generate(chunks, speakSettings)) {
  if (result.success) {
    yield result.data;  // AudioResult
  } else {
    // エラー発生：ログ出力して終了
    logger.error(`チャンク${result.chunkIndex}生成失敗: ${result.error.message}`);
    throw result.error;  // 上位に伝播
  }
}
```

---

## 2. エラーハンドリング方針

### 2.1 基本方針

音声は一つながりの一連のデータであり、**1つでも失敗すれば全体が無効**。

**エラーは例外ではなく、結果の一部として扱う:**
- `GenerationResult = { success: false; error: Error; chunkIndex: number }`
- エラーをthrowせず、yieldで返す
- 呼び出し側がエラーハンドリング方法を決定

### 2.2 エラー発生時の挙動

```
[チャンク0, 1, 2, 3, 4]

シナリオ: チャンク2でエラー発生

1. チャンク0生成開始（並行）
2. チャンク1生成開始（並行）
3. チャンク0完了 → yield { success: true, data: AudioResult }
4. チャンク2生成開始（先読み）
5. チャンク1完了 → yield { success: true, data: AudioResult }
6. チャンク2エラー発生 → yield { success: false, error: Error, chunkIndex: 2 }
7. ストリーム終了（チャンク3, 4は生成開始しない）
```

**重要:**
- エラー発生時点で新規生成を開始しない
- 既に開始済みの生成は完了を待つ（リソース解放のため）
- エラーをyieldした後、ストリームを終了

### 2.3 複数エラーの処理

並行生成中に複数のエラーが同時発生する可能性がある：

```
チャンク1とチャンク2が並行生成中、両方ともエラー

1. チャンク1エラー検出
2. 新規生成を停止
3. チャンク2もエラー
4. 最初に検出されたエラー（チャンク1）をyield
5. チャンク2のエラーはログ出力のみ
6. ストリーム終了
```

**ルール:**
- 最初に検出されたエラーのみをyield
- 他のエラーは内部でログ出力
- すべてのエラーを配列で返すことはしない（ストリームなので）

### 2.4 Unhandled Rejection対策

**OpenPromiseパターンを適用:**

```typescript
// 1. Promiseを先に作成
let resolveTask!: (result: AudioResult) => void;
let rejectTask!: (error: Error) => void;
const taskPromise = new Promise<AudioResult>((resolve, reject) => {
  resolveTask = resolve;
  rejectTask = reject;
});

// 2. 即座にcatchを設定（Unhandled Rejection防止）
taskPromise.catch(() => {});

// 3. 後から処理を実行
synthesizeFunction(chunk, speakSettings)
  .then(resolveTask)
  .catch(rejectTask);
```

**保証:**
- すべてのPromiseに即座にcatchハンドラーを設定
- Unhandled Rejectionは発生しない
- エラーはGenerationResultとして適切に処理

---

## 3. 並行制御仕様

### 3.1 並行生成オプション

```typescript
interface GenerationOptions {
  maxConcurrency: number;           // 最大並行生成数（デフォルト: 2）
  bufferAheadCount: number;         // 先読みチャンク数（デフォルト: 1）
  delayBetweenRequests: number;     // リクエスト間隔ms（デフォルト: 100）
  pauseUntilFirstComplete: boolean; // 初回完了まで並行生成をポーズ（デフォルト: true）
}
```

### 3.2 並行生成の流れ

```
[maxConcurrency=2, bufferAheadCount=1の場合]

初期状態: [0, 1, 2, 3, 4]

1. チャンク0生成開始（pauseUntilFirstComplete=true）
   待機: チャンク1は開始しない

2. チャンク0完了 → yield
   並行開始: チャンク1生成開始（currentIndex=0の先読み）

3. チャンク1完了待ち中に、チャンク2生成開始（先読み）
   並行数: 2つまで（maxConcurrency=2）

4. チャンク1完了 → yield
   チャンク3生成開始

5. チャンク2完了 → yield
   チャンク4生成開始

6. 以降、順次処理
```

### 3.3 先読み制御

**bufferAheadCount の意味:**
- 現在のチャンクから先読みする数
- currentIndex=1の場合、bufferAheadCount=1なら、チャンク2まで生成開始

**maxConcurrency との関係:**
- 並行数の上限はmaxConcurrency
- 先読みはmaxConcurrency内で実行
- 例: maxConcurrency=2, bufferAheadCount=3の場合、最大2つまでしか並行しない

---

## 4. 内部実装方針

### 4.1 状態管理

```typescript
class ChunkGenerationManager {
  private activeTasks: Map<number, {
    promise: Promise<AudioResult>;
    resolve: (result: AudioResult) => void;
    reject: (error: Error) => void;
  }>;

  private firstChunkCompleted: boolean;
  private errorOccurred: boolean;  // エラー発生フラグ
  private firstError: Error | null; // 最初のエラー
}
```

**シンプル化のポイント:**
- completedResults と failedTasks を削除（ストリームで即座にyield）
- activeTasks のみ管理
- エラー発生時は errorOccurred フラグを立てて新規生成を停止

### 4.2 generate() の実装フロー

```typescript
async *generate(chunks, speakSettings) {
  let currentIndex = 0;

  // 初回チャンクを開始
  this.startGeneration(chunks[0], speakSettings);

  while (currentIndex < chunks.length) {
    // エラー発生時は新規生成を停止
    if (!this.errorOccurred) {
      // 先読み生成を開始
      this.startAheadGeneration(chunks, currentIndex, speakSettings);
    }

    // 現在のチャンクの完了を待機
    const result = await this.waitForResult(currentIndex);

    // エラーチェック
    if (!result.success) {
      yield result;  // エラーをyield
      await this.cleanup();  // 残タスクの完了を待つ
      return;  // ストリーム終了
    }

    // 成功結果をyield
    yield result;
    currentIndex++;
  }

  await this.cleanup();
}
```

### 4.3 エラー検出と伝播

```typescript
private async waitForResult(chunkIndex: number): Promise<GenerationResult> {
  const task = this.activeTasks.get(chunkIndex);
  if (!task) {
    return {
      success: false,
      error: new Error(`チャンク${chunkIndex}が見つかりません`),
      chunkIndex,
    };
  }

  try {
    const audioResult = await task.promise;
    this.activeTasks.delete(chunkIndex);
    return { success: true, data: audioResult };
  } catch (error) {
    this.activeTasks.delete(chunkIndex);

    // 最初のエラーを記録
    if (!this.errorOccurred) {
      this.errorOccurred = true;
      this.firstError = error as Error;
    }

    return {
      success: false,
      error: error as Error,
      chunkIndex,
    };
  }
}
```

---

## 5. 既存設計との比較

### 5.1 現在の設計

```typescript
// 複雑な呼び出し側の制御
await manager.startGeneration(chunk0, voiceConfig, speed);
await manager.startGeneration(chunk1, voiceConfig, speed);

const result0 = await manager.getResult(0);
if (failedTasks.has(0)) {
  throw failedTasks.get(0);
}
yield result0;
```

**問題点:**
- 低レベルAPI（startGeneration/getResult）
- エラー処理が複雑（failedTasksを別管理）
- 呼び出し側が並行制御を実装

### 5.2 新設計

```typescript
// シンプルなストリーム
for await (const result of manager.generate(chunks, speakSettings)) {
  if (result.success) {
    yield result.data;
  } else {
    throw result.error;
  }
}
```

**利点:**
- 高レベルAPI（generate）
- エラーは結果の一部（GenerationResult）
- 並行制御はChunkGenerationManagerが実装

---

## 6. マイグレーション計画

### Phase 1: SpeakSettings型の導入

```typescript
// VoiceConfig + speed → SpeakSettings変換ヘルパー
function toSpeakSettings(voiceConfig: VoiceConfig, speed: number): SpeakSettings {
  return {
    speaker: voiceConfig.speaker,
    styleId: voiceConfig.selectedStyleId,
    speed,
  };
}
```

### Phase 2: ChunkGenerationManager リファクタリング

1. generate() メソッド実装
2. OpenPromiseパターン適用
3. エラーハンドリング改善

### Phase 3: AudioStreamController簡素化

```typescript
// Before: 複雑な制御
private async *synthesizeStreamParallel(chunks, voiceConfig, speed) {
  // ... 複雑な並行制御コード ...
}

// After: シンプルな委譲
private async *synthesizeStreamParallel(chunks, voiceConfig, speed) {
  const speakSettings = toSpeakSettings(voiceConfig, speed);
  yield* this.generationManager.generate(chunks, speakSettings);
}
```

---

## 7. 非機能要件

### 7.1 パフォーマンス

- 並行生成により、逐次生成と比較してレイテンシを削減
- maxConcurrency で並行数を制御し、リソース消費を制限

### 7.2 信頼性

- すべてのPromiseに即座にcatchハンドラーを設定（Unhandled Rejection防止）
- エラー発生時は安全にクリーンアップ
- 残タスクの完了を待ってからストリーム終了

### 7.3 保守性

- シンプルなインターフェース（generate）
- エラーは結果の一部として扱う（Result型）
- 既存の実証済みパターン（OpenPromise）を活用

---

## 8. テスト要件

### 8.1 正常系

- 全チャンク生成成功
- 並行生成が正しく動作（maxConcurrency遵守）
- 順序保証（0, 1, 2, ... の順でyield）

### 8.2 異常系

- 1つのチャンクでエラー → ストリーム終了
- 複数チャンクで同時エラー → 最初のエラーをyield
- Unhandled Rejectionが発生しない

### 8.3 並行制御

- pauseUntilFirstComplete が正しく動作
- bufferAheadCount が正しく動作
- maxConcurrency の上限を超えない

---

## 関連ドキュメント

- `research-report.voice-synthesis-parameters.v1.md` - パラメータ調査レポート
- `task-orchestration.md` - OpenPromiseパターンの詳細
- `chunk-generation-manager-spec.md` - 旧仕様（参考）
