# 句読点間の音声ポーズ調整機能 改善提案

## 現状の問題

句読点で分割された音声チャンクの再生時に違和感がある。

### 現在の動作
1. 文章を句読点（。！？）で分割
2. 各チャンクを独立して音声合成（句読点は保持して送信）
3. **COEIROINKが句読点を削除して音声生成**（末尾の句読点による間が生成されない）
4. チャンクを連続再生（**句読点の間が全くない状態**）

### 問題点
- **句読点による自然な「間」が完全に失われている**
- チャンク間の無音時間が調整できない
- 句読点の種類（。vs ！）による間の差別化ができない
- 自然な発話リズムが再現できていない

## 改善案

### 案1: チャンク間に無音データを挿入（推奨）

**シンプルな話速連動方式：**

```typescript
// デフォルト値
const DEFAULT_PUNCTUATION_DURATIONS = {
  period: 300,      // 。の後（ms）
  exclamation: 200, // ！の後（ms）
  question: 250,    // ？の後（ms）
  comma: 100,       // 、の後（ms）
};

interface PunctuationPauseSettings {
  enabled: boolean;

  // 標準話速（200WPM）での基準ポーズ時間
  durations?: {
    period?: number;      // 。の後（ms）
    exclamation?: number; // ！の後（ms）
    question?: number;    // ？の後（ms）
    comma?: number;       // 、の後（ms）
  };

  // 話速による自動調整
  // 実際のポーズ = duration / speedScale
  // speedScale=2.0（400WPM）なら半分の時間
  // speedScale=0.5（100WPM）なら2倍の時間
}
```

実装方法：
```typescript
// audio-player.ts に追加
private calculatePauseDuration(
  punctuation: string,
  speedScale: number,  // 話速の倍率（1.0 = 200WPM）
  settings: PunctuationPauseSettings
): number {
  if (!settings.enabled) return 0;

  const punctuationMap = {
    '。': 'period',
    '！': 'exclamation',
    '？': 'question',
    '、': 'comma',
  };

  const type = punctuationMap[punctuation];
  if (!type) return 0;

  // デフォルト値と設定値をマージ
  const durations = {
    ...DEFAULT_PUNCTUATION_DURATIONS,
    ...settings.durations,
  };

  // 基準時間を話速で調整（速い話 = 短いポーズ）
  const duration = durations[type];
  return Math.round(duration / speedScale);
}

private async insertPauseBetweenChunks(
  chunk: Chunk,
  nextChunk: Chunk | null,
  speedScale: number,
  settings: PunctuationPauseSettings
): Promise<ArrayBuffer | null> {
  if (!settings.enabled || !nextChunk) return null;

  const lastChar = chunk.text[chunk.text.length - 1];
  const pauseDuration = this.calculatePauseDuration(lastChar, speedScale, settings);

  if (pauseDuration > 0) {
    logger.debug(`句読点「${lastChar}」の後に${pauseDuration}msのポーズを挿入`);
    return this.generateSilence(pauseDuration);
  }

  return null;
}
```

### 案2: COEIROINK APIパラメータの調査と活用

COEIROINKのAPIに`pauseLength`や`pauseScale`のようなパラメータが存在するか調査し、存在する場合は活用する。

### 案3: 句読点を特殊記号に置換

句読点を音声エンジンが認識する特殊なポーズ記号に置換：
- 「。」→「。<pause:300>」
- 「！」→「！<pause:200>」

※COEIROINKがこのような記法をサポートしているか要確認

## 実装優先順位

1. **案1を優先実装**（最も制御可能で確実）
2. 案2の調査を並行実施
3. 案1で不十分な場合、案3を検討

## 設定例

```typescript
// デフォルト設定（durationsを省略すると自動でデフォルト値を使用）
const audioConfig = {
  punctuationPause: {
    enabled: true,
    // durations省略 = デフォルト値を使用
  }
};

// 部分的にカスタマイズ（指定しない項目はデフォルト値）
const audioConfig = {
  punctuationPause: {
    enabled: true,
    durations: {
      period: 500,      // 句点だけ長めに
      // exclamation, question, commaはデフォルト値
    }
  }
};

// より長めのポーズが欲しい場合
const audioConfig = {
  punctuationPause: {
    enabled: true,
    durations: {
      period: 500,      // ゆったりした会話
      exclamation: 350,
      question: 400,
      comma: 150,
    }
  }
};

// 短めでテンポ良く
const audioConfig = {
  punctuationPause: {
    enabled: true,
    durations: {
      period: 200,      // きびきびした会話
      exclamation: 150,
      question: 180,
      comma: 50,
    }
  }
};
```

## テスト計画

1. 各句読点タイプでのポーズ長測定
2. 設定値変更時の体感評価
3. 連続再生時の自然さの確認
4. パフォーマンスへの影響測定

## 期待される効果

- より自然な発話リズムの実現
- 句読点の種類に応じた適切な間の表現
- ユーザーによるカスタマイズ可能性
- 音声の聞き取りやすさの向上

## 参考情報

- 一般的な日本語発話における句読点後のポーズ：
  - 句点（。）: 200-500ms
  - 読点（、）: 50-200ms
  - 感嘆符（！）: 150-300ms
  - 疑問符（？）: 200-400ms

※実際の値は話者や文脈により変動