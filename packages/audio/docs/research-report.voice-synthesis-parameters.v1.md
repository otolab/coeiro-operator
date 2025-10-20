# 音声合成パラメータ調査レポート

## 調査日時
2025-10-20

## 調査目的
ChunkGenerationManagerの理想的なインターフェース設計のため、音声合成に関わる全パラメータとその役割を明確化する

---

## エグゼクティブサマリー

### 主要な発見

1. **voiceConfig と speed は論理的には同じ「音声合成タスクの設定」** であるが、歴史的経緯で分離されている
2. **volume, pitch, intonation は現在定数**（固定値）で、将来的に可変にする必要がある場合は設計変更が必要
3. **chunkMode はテキスト分割に使用され、Chunk[]生成後は不要**
4. **パラメータは6レイヤーを経由して伝播**しており、各レイヤーで (chunk, voiceConfig, speed) が受け渡されている

### 推奨事項

ChunkGenerationManagerのインターフェースは以下の設計が理想的：

```typescript
// シンプルなストリーム型インターフェース
async *generate(
  chunks: Chunk[],
  voiceConfig: VoiceConfig,
  speed: number
): AsyncGenerator<AudioResult>
```

**理由：**
- チャンク配列は既に分割済み（chunkMode不要）
- voiceConfigとspeedは「タスク全体の設定」で全チャンク共通
- ストリーム型で順序保証と並行処理を内包

---

## パラメータ分類

### 1. タスクごとに変わるパラメータ（音声合成タスク全体の設定）

#### VoiceConfig
```typescript
interface VoiceConfig {
  speaker: Speaker;          // どの声で喋るか
  selectedStyleId: number;   // どのスタイルで喋るか（ノーマル、裏声など）
}
```

**決定タイミング:** SynthesisProcessor.process() (Layer 2)
**スコープ:** 1回の音声合成タスク全体

#### speed
```typescript
type Speed = number;  // 0.5 ~ 2.0
```

**決定タイミング:** SynthesisProcessor.process() (Layer 2)
**変換:** `rate (WPM) → speed = rate / 200`
**スコープ:** 1回の音声合成タスク全体

**現在の問題:** voiceConfig と speed が別パラメータとして扱われているが、論理的には同じ「音声合成の設定」

### 2. チャンクごとに変わるパラメータ

#### Chunk
```typescript
interface Chunk {
  text: string;       // チャンクのテキスト（チャンクごとに異なる）
  index: number;      // チャンク番号（順序保証に使用）
  isFirst: boolean;   // 最初のチャンク（padding計算に使用）
  isLast: boolean;    // 最後のチャンク（padding計算に使用）
  overlap: number;    // オーバーラップ文字数
}
```

**生成タイミング:** AudioSynthesizer.splitTextIntoChunks() (Layer 3)
**スコープ:** 各チャンク

#### Padding
```typescript
prePhonemeLength: number;   // chunk.isFirstとconfigから計算
postPhonemeLength: number;  // chunk.isLastとconfigから計算
```

**計算タイミング:** AudioSynthesizer.synthesizeChunk() (Layer 6)
**入力:** chunk.isFirst, chunk.isLast, config.audio.paddingSettings
**スコープ:** 各チャンク

### 3. システム全体の設定（初期化時に決定）

#### 並行生成戦略
```typescript
interface GenerationOptions {
  maxConcurrency: number;           // 最大並行生成数
  bufferAheadCount: number;         // 先読みチャンク数
  delayBetweenRequests: number;     // リクエスト間隔（ms）
  pauseUntilFirstComplete: boolean; // 初回チャンク完了まで並行生成をポーズ
}
```

**設定タイミング:** AudioSynthesizer コンストラクタ
**ソース:** config.audio.parallelGeneration
**スコープ:** AudioSynthesizer インスタンスのライフタイム

#### 音声品質設定
```typescript
// config.audio.latencyMode: 'ultra-low' | 'balanced' | 'quality'
paddingSettings: PaddingSettings;       // プリセットから決定
outputSamplingRate: 24000;              // SAMPLE_RATES.SYNTHESIS
```

**設定タイミング:** AudioSynthesizer コンストラクタ
**スコープ:** AudioSynthesizer インスタンスのライフタイム

### 4. 現在固定の定数（将来的に可変にする可能性）

#### COEIROINK API固定パラメータ
```typescript
volumeScale: 1.0       // 音量（固定）
pitchScale: 0.0        // 音高（固定）
intonationScale: 1.0   // イントネーション（固定）
```

**定義場所:** constants.ts: SYNTHESIS_SETTINGS
**使用箇所:** AudioSynthesizer.synthesizeChunk() (Layer 6)
**将来の拡張:** 可変にする場合は VoiceConfig 拡張 or 新しい型が必要

---

## パラメータ伝播フロー

```
[Layer 1: ユーザー入力]
SayCoeiroink.synthesize(text, options)
  ↓
[Layer 2: オプション解決]
SynthesisProcessor.process(text, options)
  決定: voiceConfig, speed, chunkMode
  ↓
[Layer 3: テキスト分割]
AudioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode)
  決定: Chunk[]
  ↓
[Layer 4: 並行生成制御]
AudioStreamController.synthesizeStream(chunks, voiceConfig, speed)
  並行生成戦略を適用
  ↓
[Layer 5: チャンク生成]
ChunkGenerationManager.startGeneration(chunk, voiceConfig, speed)
  チャンクごとに並行実行
  ↓
[Layer 6: API呼び出し]
AudioSynthesizer.synthesizeChunk(chunk, voiceConfig, speed)
  COEIROINK API: text, speakerUuid, styleId, speedScale,
                 volumeScale, pitchScale, intonationScale,
                 prePhonemeLength, postPhonemeLength,
                 outputSamplingRate
```

**観察:**
- voiceConfig と speed は Layer 2 で決定され、Layer 6 まで変更されず伝播
- chunkMode は Layer 3 で Chunk[] に変換され、それ以降は不要
- Layer 4-6 は (chunk, voiceConfig, speed) を受け渡すだけ

---

## ChunkGenerationManager インターフェース設計への示唆

### 現在の設計の問題点

```typescript
// 呼び出し側（AudioStreamController）が複雑な制御を行う
for (let i = nextIndex; i < generateUpTo; i++) {
  if (!manager.isInProgress(i) && !manager.isCompleted(i)) {
    await manager.startGeneration(chunks[i], voiceConfig, speed);
  }
}
const result = await manager.getResult(currentIndex);
```

**問題:**
- 低レベルAPI（startGeneration/getResult）を使った手動制御
- 先読み判定、並行数制御をAudioStreamControllerが実装
- 過剰な柔軟性（ランダムアクセスは実際には使わない）

### 推奨設計

```typescript
class ChunkGenerationManager {
  /**
   * チャンク配列を受け取り、順序保証されたストリームを返す
   * 内部で並行生成・先読み・順序保証を全て実装
   */
  async *generate(
    chunks: Chunk[],
    voiceConfig: VoiceConfig,
    speed: number
  ): AsyncGenerator<AudioResult> {
    // 並行生成・先読み・順序保証を内部実装
  }
}

// 使う側はシンプルに
for await (const result of manager.generate(chunks, voiceConfig, speed)) {
  yield result;
}
```

**利点:**
- 責務の明確化：ChunkGenerationManagerが並行制御の全責任を持つ
- 使う側がシンプル：ストリームを受け取るだけ
- 実態に即した設計：チャンクは必ず 0, 1, 2, ... の順序

### パラメータ統合の検討

**Option 1: 現状維持**
```typescript
generate(chunks: Chunk[], voiceConfig: VoiceConfig, speed: number)
```

**Option 2: VoiceSettings として統合**
```typescript
interface VoiceSettings {
  speaker: Speaker;
  styleId: number;
  speed: number;
}

generate(chunks: Chunk[], voiceSettings: VoiceSettings)
```

**Option 3: 将来の拡張を考慮**
```typescript
interface VoiceSettings {
  speaker: Speaker;
  styleId: number;
  speed: number;
  volume?: number;    // 将来的に可変にする場合
  pitch?: number;     // 将来的に可変にする場合
  intonation?: number; // 将来的に可変にする場合
}

generate(chunks: Chunk[], voiceSettings: VoiceSettings)
```

**推奨:** Option 1（現状維持）
- voiceConfig と speed の統合は破壊的変更
- volume/pitch/intonation の可変化は現時点で要件なし
- 必要になったタイミングで段階的に移行

---

## 質問事項（ユーザーへの確認が必要）

1. **voiceConfig と speed の統合**
   - 統合すべきか？それとも現状維持か？

2. **volume, pitch, intonation の可変化**
   - 将来的に可変にする予定はあるか？
   - ある場合、いつ頃必要になるか？

3. **並行生成戦略の動的変更**
   - maxConcurrency や bufferAheadCount を実行時に変更する必要はあるか？

---

## 関連ドキュメント

- `types.ts:43-46` - VoiceConfig 型定義
- `audio-synthesizer.ts:385-431` - synthesizeChunk 実装
- `constants.ts:202-211` - SYNTHESIS_SETTINGS 定義
- `audio-stream-controller.ts:54-123` - 現在の並行生成制御実装
- `chunk-generation-manager.ts` - 現在の実装
