# 音声合成パラメータ調査

## 調査日時
2025-10-20

## 調査目的
ChunkGenerationManagerの理想的なインターフェース設計のため、音声合成に関わる全パラメータとその役割を理解する

## 調査対象
- types.ts: 型定義
- audio-synthesizer.ts: synthesizeChunkの実装
- audio-stream-controller.ts: 呼び出し側
- constants.ts: デフォルト値定義

---

## 1. 型定義調査 (types.ts)

### VoiceConfig (types.ts:43-46)
```typescript
interface VoiceConfig {
  speaker: Speaker;          // COEIROINKのSpeaker情報
  selectedStyleId: number;   // 選択されたスタイルID
}
```

### Chunk (types.ts:22-28)
```typescript
interface Chunk {
  text: string;       // チャンクのテキスト
  index: number;      // チャンク番号
  isFirst: boolean;   // 最初のチャンクか
  isLast: boolean;    // 最後のチャンクか
  overlap: number;    // オーバーラップ文字数
}
```

### AudioResult (types.ts:30-34)
```typescript
interface AudioResult {
  chunk: Chunk;
  audioBuffer: ArrayBuffer;
  latency: number;
}
```

---

## 2. synthesizeChunkの実装調査 (audio-synthesizer.ts:385-431)

### メソッドシグネチャ
```typescript
async synthesizeChunk(
  chunk: Chunk,
  voiceConfig: VoiceConfig,
  speed: number
): Promise<AudioResult>
```

### COEIROINK APIに渡されるパラメータ (audio-synthesizer.ts:420-431)
```typescript
const synthesisParam = {
  // チャンク固有
  text: chunk.text,

  // VoiceConfigから
  speakerUuid: voiceConfig.speaker.speakerId,
  styleId: voiceConfig.selectedStyleId,

  // 引数
  speedScale: speed,

  // 定数（現在は固定値）
  volumeScale: SYNTHESIS_SETTINGS.DEFAULT_VOLUME,      // 1.0
  pitchScale: SYNTHESIS_SETTINGS.DEFAULT_PITCH,        // 0.0
  intonationScale: SYNTHESIS_SETTINGS.DEFAULT_INTONATION, // 1.0

  // configとchunk.isFirst/isLastから計算
  prePhonemeLength: paddingMs / 1000,
  postPhonemeLength: postPaddingMs / 1000,

  // configから
  outputSamplingRate: this.getSynthesisRate(),  // SAMPLE_RATES.SYNTHESIS (24000)
};
```

---

## 3. 定数定義調査 (constants.ts)

### SYNTHESIS_SETTINGS (constants.ts:202-211)
```typescript
export const SYNTHESIS_SETTINGS = {
  DEFAULT_RATE: 200,          // デフォルト話速（WPM）
  DEFAULT_VOLUME: 1.0,        // デフォルト音量（固定）
  DEFAULT_PITCH: 0.0,         // デフォルト音高（固定）
  DEFAULT_INTONATION: 1.0,    // デフォルトイントネーション（固定）
} as const;
```

### SAMPLE_RATES (constants.ts:35-40)
```typescript
export const SAMPLE_RATES = {
  SYNTHESIS: 24000,   // 音声生成時のサンプルレート
  PLAYBACK: 48000,    // 再生時のサンプルレート
} as const;
```

### PADDING_SETTINGS (constants.ts:140-167)
```typescript
export const PADDING_SETTINGS = {
  DEFAULTS: {
    ENABLED: true,
    PRE_PHONEME_LENGTH: 0.01,   // 10ms
    POST_PHONEME_LENGTH: 0.01,  // 10ms
    FIRST_CHUNK_ONLY: true,
  },
  PRESETS: {
    ULTRA_LOW: { ... },
    BALANCED: { ... },
    QUALITY: { ... },
  },
} as const;
```

---

## 4. 呼び出しフロー調査

### パラメータ決定の流れ

```
[Layer 1: ユーザー入力]
SayCoeiroink.synthesize(text, options)
  ↓
[Layer 2: オプション解決]
SynthesisProcessor.process(text, options)
  - resolveOptions() で voice, rate, chunkMode, bufferSize を解決
  - voiceResolver.resolveVoiceConfig() で VoiceConfig を作成
  - convertRateToSpeed() で rate → speed に変換
  ↓
[Layer 3: ストリーミング開始]
AudioSynthesizer.synthesizeStream(text, voiceConfig, speed, chunkMode)
  - splitTextIntoChunks() でテキスト → Chunk[] に分割
  ↓
[Layer 4: 並行生成制御]
AudioStreamController.synthesizeStream(chunks, voiceConfig, speed)
  ↓
[Layer 5: チャンク生成]
ChunkGenerationManager.startGeneration(chunk, voiceConfig, speed)
  ↓
[Layer 6: 音声合成API呼び出し]
AudioSynthesizer.synthesizeChunk(chunk, voiceConfig, speed)
  - COEIROINK APIを呼び出し
```

### 各レイヤーでの決定事項

| レイヤー | 決定される内容 | 入力 | 出力 |
|---------|-------------|------|-----|
| Layer 1 | ユーザー要求 | text, SynthesizeOptions | - |
| Layer 2 | 音声設定の解決 | voice, rate, chunkMode, bufferSize | voiceConfig, speed, chunkMode |
| Layer 3 | テキスト分割 | text, chunkMode | Chunk[] |
| Layer 4 | 並行生成戦略 | maxConcurrency, bufferAheadCount | - |
| Layer 5 | チャンク単位の生成 | chunk, voiceConfig, speed | AudioResult |
| Layer 6 | API呼び出し | chunk, voiceConfig, speed + padding + 定数 | AudioResult |

---

## 5. パラメータ分類

### A. タスクごとに変わるパラメータ（音声合成タスク全体の設定）

1. **VoiceConfig** (Layer 2で決定)
   - speaker: Speaker
   - selectedStyleId: number

2. **speed** (Layer 2で決定、rateから変換)
   - rate → speed変換: `rate / 200`
   - 範囲: 0.5 ~ 2.0

3. **chunkMode** (Layer 2で決定)
   - テキスト分割方法: 'none' | 'small' | 'medium' | 'large' | 'punctuation'

### B. チャンクごとに変わるパラメータ

1. **Chunk**
   - text: string（チャンクごとに異なる）
   - index: number（順序）
   - isFirst, isLast: boolean（padding計算に使用）

2. **Padding** (chunk.isFirst/isLastと config から計算)
   - prePhonemeLength
   - postPhonemeLength

### C. システム全体の設定（初期化時に決定）

1. **並行生成戦略** (AudioSynthesizerのコンストラクタで設定)
   - maxConcurrency: number
   - bufferAheadCount: number
   - delayBetweenRequests: number
   - pauseUntilFirstComplete: boolean

2. **音声品質設定** (config.audio.latencyModeから決定)
   - paddingSettings (ULTRA_LOW | BALANCED | QUALITY)
   - outputSamplingRate (SAMPLE_RATES.SYNTHESIS)

### D. 現在固定の定数（将来的に可変にする可能性がある）

1. **COEIROINK API固定パラメータ**
   - volumeScale: 1.0
   - pitchScale: 0.0
   - intonationScale: 1.0

---

## 調査結果まとめ

### 発見した設計の特徴

1. **voiceConfig と speed が分離されている理由**
   - 歴史的経緯による分離
   - 論理的には両方とも「音声合成タスク全体の設定」
   - 統合の余地あり

2. **現在定数扱いのパラメータ**
   - volume, pitch, intonation は固定値
   - 将来的に可変にする場合は VoiceConfig or 新しい型に追加

3. **パラメータの伝播が深い**
   - 6レイヤーを経由してパラメータが伝播
   - 各レイヤーが (chunk, voiceConfig, speed) を受け渡し
   - synthesizeFunctionのシグネチャに依存

### ChunkGenerationManager インターフェース設計への示唆

現在の設計:
```typescript
// 各チャンクごとに startGeneration を呼ぶ
await manager.startGeneration(chunk, voiceConfig, speed);
const result = await manager.getResult(index);
```

理想的な設計:
```typescript
// チャンク配列を渡してストリーム取得
for await (const result of manager.generate(chunks, voiceConfig, speed)) {
  yield result;
}
```

**質問事項:**
- voiceConfig と speed を統合すべきか？
- volume, pitch, intonation を可変にする予定はあるか？
- chunkMode は ChunkGenerationManager に渡す必要があるか？（既にChunk[]に分割済み）
