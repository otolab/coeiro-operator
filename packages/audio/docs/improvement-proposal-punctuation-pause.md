# 句読点間の音声ポーズ調整機能 改善提案

## 設計思想

**日本語発話に特化したモーラベースのタイミング制御**

- 日本語は「モーラタイミング言語」（各モーラがほぼ等間隔）
- 英語は「ストレスタイミング言語」（強勢間隔がほぼ等間隔）
- sayコマンド互換のrate（WPM）は**インターフェース層**のみで使用
- **内部処理はすべてモーラ単位**で統一

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

**モーラベースのポーズ設定（日本語の特性に最適）：**

```typescript
// デフォルト値（モーラ数で指定）
// 日本語の自然な「間」をモーラ単位で表現
const DEFAULT_PUNCTUATION_MORAS = {
  period: 2.0,      // 。の後（2.0モーラ分＝「っっ」相当の長さ）
  exclamation: 1.5, // ！の後（1.5モーラ分＝「っん」相当の長さ）
  question: 1.8,    // ？の後（1.8モーラ分）
  comma: 0.8,       // 、の後（0.8モーラ分＝「っ」より短い）
};

/**
 * PunctuationPauseSettings: 句読点ポーズ設定
 *
 * ポーズの長さをモーラ数で指定します。
 * 日本語は等間隔のモーラリズムなので、話速が変わっても自然な比率を保てます。
 * 各値を0に設定することでそのポーズを無効化できます。
 *
 * 実際のポーズ時間は VoiceConfig.styleMorasPerSecond から計算された話速に基づいて決定されます。
 */
interface PunctuationPauseSettings {
  period?: number;      // 。の後（モーラ数、0で無効）
  exclamation?: number; // ！の後（モーラ数、0で無効）
  question?: number;    // ？の後（モーラ数、0で無効）
  comma?: number;       // 、の後（モーラ数、0で無効）
}

// VoiceConfigに話速情報を追加（実装済み）
interface VoiceConfig {
  speaker: Speaker;
  selectedStyleId: number;
  // スタイル毎の基準話速（実測値）
  styleMorasPerSecond?: Record<number, number>;
}
```

実装方法：
```typescript
// audio-stream-controller.ts に実装済み
private calculatePauseDuration(
  punctuation: string,
  actualMorasPerSecond: number,  // VoiceConfigから計算された実際の話速
  settings?: PunctuationPauseSettings
): number {
  if (!settings) return 0;

  const punctuationMap = {
    '。': 'period',
    '！': 'exclamation',
    '？': 'question',
    '、': 'comma',
  };

  const type = punctuationMap[punctuation];
  if (!type) return 0;

  // デフォルト値と設定値をマージ
  const pauseMoras = {
    ...DEFAULT_PUNCTUATION_MORAS,
    ...settings,
  };

  // ポーズ時間を計算（モーラ数 → ミリ秒）
  const pauseInMoras = pauseMoras[type];

  // ポーズ値が0以下なら無効
  if (pauseInMoras <= 0) return 0;

  const pauseDuration = (pauseInMoras / actualMorasPerSecond) * 1000;

  logger.debug(
    `句読点「${punctuation}」のポーズ: ${pauseInMoras}モーラ → ${Math.round(pauseDuration)}ms`
  );

  return Math.round(pauseDuration);
}

// synthesizeStream内で句読点ポーズを挿入（実装済み）
// 句読点ポーズの挿入（最後のチャンク以外）
if (this.options.punctuationPause && chunkIndex < chunks.length - 1) {
  const lastPunctuation = this.getLastPunctuation(result.data.chunk.text);
  if (lastPunctuation) {
    const pauseDuration = this.calculatePauseDuration(
      lastPunctuation,
      actualMorasPerSecond,
      this.options.punctuationPause
    );

    if (pauseDuration > 0) {
      // 無音WAVデータを生成
      const silenceWAV = this.generateSilenceWAV(pauseDuration);

      // ポーズ用のAudioResultを作成
      const pauseResult: AudioResult = {
        chunk: { text: '', index: result.data.chunk.index + 0.5, isFirst: false, isLast: false, overlap: 0 },
        audioBuffer: silenceWAV,
        latency: 0,
      };

      logger.debug(`句読点「${lastPunctuation}」の後に${pauseDuration}msのポーズを挿入`);
      yield pauseResult;
    }
  }
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
// デフォルト設定（全フィールド省略で自動的にデフォルト値を使用）
const audioConfig = {
  punctuationPause: {}
};

// 部分的にカスタマイズ（指定しない項目はデフォルト値）
const audioConfig = {
  punctuationPause: {
    period: 3.0,  // 句点だけ長めに（3モーラ分）
    // exclamation, question, commaはデフォルト値
  }
};

// より長めのポーズが欲しい場合（ゆったりした会話）
const audioConfig = {
  punctuationPause: {
    period: 3.5,      // 3.5モーラ分
    exclamation: 2.5, // 2.5モーラ分
    question: 3.0,    // 3.0モーラ分
    comma: 1.2,       // 1.2モーラ分
  }
};

// 短めでテンポ良く（きびきびした会話）
const audioConfig = {
  punctuationPause: {
    period: 1.2,      // 1.2モーラ分
    exclamation: 0.8, // 0.8モーラ分
    question: 1.0,    // 1.0モーラ分
    comma: 0.4,       // 0.4モーラ分
  }
};

// 完全に無効化（全ての句読点ポーズをオフ）
const audioConfig = {
  punctuationPause: {
    period: 0,
    exclamation: 0,
    question: 0,
    comma: 0,
  }
};

// VoiceConfigに実測値を設定する例（スタイル毎の話速）
const voiceConfigs: Record<string, VoiceConfig> = {
  tsukuyomi: {
    speaker: tsukuyomiSpeaker,
    selectedStyleId: 0,
    styleMorasPerSecond: {
      0: 7.2,  // ノーマルスタイルの実測値
    },
  },
  dia: {
    speaker: diaSpeaker,
    selectedStyleId: 3,
    styleMorasPerSecond: {
      3: 7.8,  // のーまるスタイルの実測値
    },
  },
  himehime: {
    speaker: himehimeSpeaker,
    selectedStyleId: 21,
    styleMorasPerSecond: {
      21: 8.1,  // ノーマルスタイルの実測値
    },
  },
};

// 実際の時間への変換例（標準話速7.5モーラ/秒の場合）
// period: 2.0モーラ → 267ms
// exclamation: 1.5モーラ → 200ms
// question: 1.8モーラ → 240ms
// comma: 0.8モーラ → 107ms
```

## テスト計画

1. 各句読点タイプでのポーズ長測定
2. 設定値変更時の体感評価
3. 連続再生時の自然さの確認
4. パフォーマンスへの影響測定

### キャラクター別話速の実測と設定

```typescript
// 実測用のテストスクリプト例
async function measureAndUpdateVoiceConfig(
  voiceConfig: VoiceConfig
): Promise<VoiceConfig> {
  // モーラ数が確定しているテストテキスト
  const testText = "こんにちは、今日はいい天気ですね。"; // 18モーラ

  // speedScale=1.0で音声合成し、実際の時間を測定
  const startTime = Date.now();
  await synthesize(testText, voiceConfig, 1.0);
  const duration = (Date.now() - startTime) / 1000; // 秒単位

  const morasPerSecond = 18 / duration;

  logger.info(
    `${voiceConfig.speaker.speakerName}: ${morasPerSecond.toFixed(1)}モーラ/秒`
  );

  // VoiceConfigに実測値を設定
  return {
    ...voiceConfig,
    baseMorasPerSecond: morasPerSecond,
  };
}

// config.jsonでの設定例
// ~/.coeiro-operator/config.json
{
  "characters": {
    "tsukuyomi": {
      "baseMorasPerSecond": 7.2  // rate=200時の実測値
    },
    "dia": {
      "baseMorasPerSecond": 7.8  // rate=200時の実測値
    },
    "kanae": {
      "baseMorasPerSecond": 7.5  // rate=200時の実測値
    }
  }
}

// 速度計算の例：
// つくよみちゃん（基準7.2モーラ/秒）の場合：
// - rate=200 → speedScale=1.0 → 7.2モーラ/秒
// - rate=100 → speedScale=0.5 → 3.6モーラ/秒
// - rate=300 → speedScale=1.5 → 10.8モーラ/秒

// VoiceConfigへの反映（実装済み）
// styleMorasPerSecondはconfig.jsonから読み込まれ、
// VoiceResolverによって自動的にVoiceConfigに設定されます
```

## 期待される効果

- より自然な発話リズムの実現
- 句読点の種類に応じた適切な間の表現
- キャラクター固有の話速特性を考慮した精度の高いポーズ調整
- ユーザーによるカスタマイズ可能性
- 音声の聞き取りやすさの向上

## 実装のポイント

1. **速度調整の仕組み**
   - sayコマンド互換: rate=200を基準（speedScale=1.0）
   - 英語の200 WPMに対応する値として設計
   - 日本語では相対値として使用

2. **キャラクター固有の基準値**
   - config.jsonに事前測定値を保存
   - rate=200時の各キャラクターのモーラ/秒
   - 実測例: つくよみ7.2、ディア7.8、金苗7.5

3. **2段階の速度計算**
   - 第1段階: rate → speedScale変換（rate/200）※sayコマンド互換層
   - 第2段階: baseMorasPerSecond × speedScale ※モーラベース処理
   - 結果: キャラクター特性を反映した実際のモーラ/秒

4. **統一されたモーラベース処理**
   - 話速: モーラ/秒で管理
   - ポーズ: モーラ数で指定
   - 内部計算: すべてモーラ単位
   - 利点: 話速が変わってもポーズの比率が自然に保たれる

## 参考情報

- 一般的な日本語発話における句読点後のポーズ：
  - 句点（。）: 200-500ms
  - 読点（、）: 50-200ms
  - 感嘆符（！）: 150-300ms
  - 疑問符（？）: 200-400ms

- COEIROINKの速度パラメータ調査：
  - 詳細は `research-coeiroink-speed-parameter.md` を参照
  - 「200」は実装上の基準値（厳密なWPMではない）
  - 標準話速7.5モーラ/秒は経験的に妥当な値

※実際の値は話者や文脈により変動