# COEIROINK速度パラメータ調査レポート

## 調査目的
COEIROINKの速度パラメータ「200」の意味を理解し、モーラ/秒の正確な計算方法を確立する。

## 現在の実装

### 1. 速度変換の仕組み
```typescript
// audio-synthesizer.ts:472-477
convertRateToSpeed(rate: number): number {
  const baseRate = 200;
  let speed = rate / baseRate;
  if (speed < 0.5) speed = 0.5;
  if (speed > 2.0) speed = 2.0;
  return speed;
}
```

- **入力**: rate（WPMとして扱われる）
- **基準値**: 200
- **出力**: speedScale（0.5～2.0の範囲）
- **標準速度**: rate=200のとき speedScale=1.0

### 2. COEIROINKのAPI仕様
```typescript
// synthesizeChunk内のAPIパラメータ
const synthesisParam = {
  text: chunk.text,
  speakerUuid: voiceId,
  styleId: styleId,
  speedScale: speed,  // ← ここで使用
  volumeScale: 1.0,
  pitchScale: 0.0,
  intonationScale: 1.0,
  prePhonemeLength: paddingMs / 1000,
  postPhonemeLength: postPaddingMs / 1000,
  outputSamplingRate: 24000,
};
```

## 「200 WPM」の解釈問題

### 問題点
1. **WPM（Words Per Minute）の定義が日本語では曖昧**
   - 英語: 単語数が明確
   - 日本語: 「単語」の定義が不明確（形態素？文節？）

2. **一般的な日本語の話速測定方法**
   - 文字数/分（characters per minute）
   - モーラ数/秒（moras per second）
   - 拍数/分（beats per minute）

### 実測による推定方法

#### 方法1: テストによる実測
1. 既知のテキスト（モーラ数が確定している）を用意
2. speedScale=1.0で音声合成
3. 音声の長さを測定
4. モーラ/秒を計算

#### 方法2: COEIROINKの標準設定から推定
- 一般的な日本語アナウンス速度: 300-350文字/分
- NHKニュース速度: 約350文字/分（約5.8文字/秒）
- 自然な会話速度: 約7-8モーラ/秒

## 推定される速度関係

### 仮説1: 文字数ベース
```
rate = 200 → 200文字/分 = 3.33文字/秒
```
この場合、かなり遅い話速になる。

### 仮説2: モーラ数ベース
```
rate = 200 → 200モーラ/分 = 3.33モーラ/秒
```
これも非常に遅い話速。

### 仮説3: 任意の基準値（最も可能性が高い）
```
rate = 200 → speedScale = 1.0 → 標準的な話速
実際の話速 ≈ 7-8モーラ/秒（経験的な値）
```

## 改善提案書への反映

現在の改善提案書では以下の仮定を使用：
```typescript
// 標準話速（speedScale=1.0）を7.5モーラ/秒と仮定
const BASE_MORAS_PER_SECOND = 7.5;
const morasPerSecond = BASE_MORAS_PER_SECOND * speedScale;
```

この仮定は妥当と考えられる理由：
1. 一般的な日本語の自然な話速範囲内
2. speedScale=0.5で約3.75モーラ/秒（ゆっくり）
3. speedScale=2.0で約15モーラ/秒（早口）

## 実装への推奨事項

### 1. 設定可能にする
```typescript
interface PunctuationPauseSettings {
  enabled: boolean;

  // 基準話速の設定（調整可能）
  baseMorasPerSecond?: number; // デフォルト: 7.5

  // ポーズの長さ（モーラ数）
  pauseMoras?: {
    period?: number;
    exclamation?: number;
    question?: number;
    comma?: number;
  };
}
```

### 2. 実測による較正
実際にCOEIROINKで音声を生成し、以下を測定：
- speedScale=1.0での実際のモーラ/秒
- speedScaleの変化に対する線形性

### 3. ドキュメント化
- 「200」は実装上の基準値であることを明記
- 実際のモーラ/秒は設定で調整可能にする

## 結論

1. **speedScaleは相対的な速度指定**
   - VOICEBOX/COEIROINKの仕様として、1.0を基準とした相対値（0.5～2.0）
   - 絶対的な速度（WPMやモーラ/秒）の指定はエンジン側でサポートされていない

2. **「200」はCLI互換のための基準値**
   - macOS sayコマンド互換のため、便宜上WPM単位を採用
   - rate=200のときspeedScale=1.0となるよう設定
   - 厳密なWPMではなく、speedScale計算のための変換係数

3. **モーラ/秒の計算は経験的な値を使用**
   - 標準話速を7.5モーラ/秒と仮定するのは妥当
   - 必要に応じて調整可能にする

4. **改善提案書の方針は適切**
   - モーラベースのポーズ設定は日本語の特性に適合
   - speedScaleに比例した計算方法も合理的

## 今後の課題

1. 実際の音声生成テストによる検証
2. 複数の話者での速度測定
3. ユーザーフィードバックに基づく調整