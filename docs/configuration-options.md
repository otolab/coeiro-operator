# COEIRO Operator 設定オプション

COEIRO Operatorの音声合成システムは、詳細な設定によりパフォーマンスと音質を調整できます。設定は機能別に整理されており、用途に応じた最適化が可能です。

## 設定ファイルの場所

設定ファイルは以下の優先順位で読み込まれます：

1. `~/.coeiro-operator/coeiroink-config.json` （推奨）
2. `{作業ディレクトリ}/.coeiroink/coeiroink-config.json`
3. `/tmp/coeiroink-mcp-shared/coeiroink-config.json`

## 設定構造

### 基本構造（v2.1.0+）

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_voice_id": "voice-uuid-here",
    "default_style_id": 0,
    "rate": 200
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "auto",
    "bufferSize": 1024,
    "processing": { ... },
    "splitSettings": { ... },
    "bufferSettings": { ... },
    "paddingSettings": { ... },
    "crossfadeSettings": { ... }
  }
}
```

## 接続設定（Connection）

COEIROINK音声合成サーバーへの接続を設定します。

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `host` | string | `"localhost"` | COEIROINK サーバーのホスト名またはIPアドレス |
| `port` | string | `"50032"` | COEIROINK サーバーのポート番号 |

## 音声設定（Voice）

デフォルトの音声とスピーチパラメータを設定します。

```json
{
  "voice": {
    "default_voice_id": "292ea286-3d5f-f1cc-157c-66462a6a9d08",
    "default_style_id": 46,
    "rate": 200
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `default_voice_id` | string | - | デフォルトで使用する音声のUUID |
| `default_style_id` | number | - | デフォルトで使用するスタイルID |
| `rate` | number | `200` | 話速（WPM: Words Per Minute） |

## 音声処理設定（Audio）

音声合成と再生の詳細な制御を行います。

### レイテンシモード（🧪実験的機能）

```json
{
  "audio": {
    "latencyMode": "ultra-low"
  }
}
```

> **⚠️ 注意**: `latencyMode`は実験的機能です。現在は型定義のみで、プリセット適用機能は開発中です。個別設定項目を直接指定してください。

| モード | 用途 | 特徴 | 実装状況 |
|--------|------|------|----------|
| `ultra-low` | リアルタイム対話 | 最低レイテンシ、音声head途切れ対策を最優先 | 🚧 開発中 |
| `balanced` | 一般用途 | レイテンシと音質のバランス | 🚧 開発中 |
| `quality` | 高音質録音 | 最高音質、レイテンシは二の次 | 🚧 開発中 |

### 分割モード

長いテキストを効率的に処理するための分割設定です。

```json
{
  "audio": {
    "splitMode": "auto"
  }
}
```

| モード | 分割サイズ | 用途 |
|--------|------------|------|
| `none` | 分割なし | 短いテキスト、一括処理 |
| `small` | 30文字 | 低レイテンシ重視 |
| `medium` | 50文字 | バランス型 |
| `large` | 100文字 | 高品質重視 |
| `auto` | 自動判定 | テキスト長に応じて最適化 |

### 音声処理設定

```json
{
  "audio": {
    "processing": {
      "synthesisRate": 24000,
      "playbackRate": 48000,
      "noiseReduction": false,
      "lowpassFilter": false,
      "lowpassCutoff": 24000
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `synthesisRate` | number | `24000` | 音声合成時のサンプルレート（Hz） |
| `playbackRate` | number | `48000` | 再生時のサンプルレート（Hz） |
| `noiseReduction` | boolean | `false` | Echogardenによるノイズ除去 |
| `lowpassFilter` | boolean | `false` | ローパスフィルターの有効化 |
| `lowpassCutoff` | number | `24000` | ローパスフィルターのカットオフ周波数（Hz） |

### 分割設定

テキスト分割の詳細なパラメータを制御します。

```json
{
  "audio": {
    "splitSettings": {
      "smallSize": 30,
      "mediumSize": 50,
      "largeSize": 100,
      "overlapRatio": 0.1
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `smallSize` | number | `30` | smallモード時の分割サイズ（文字数） |
| `mediumSize` | number | `50` | mediumモード時の分割サイズ（文字数） |
| `largeSize` | number | `100` | largeモード時の分割サイズ（文字数） |
| `overlapRatio` | number | `0.1` | チャンク間のオーバーラップ比率（0.0-1.0） |

### バッファ設定

音声ストリーミングのバッファ制御を行います。

```json
{
  "audio": {
    "bufferSettings": {
      "highWaterMark": 256,
      "lowWaterMark": 128,
      "dynamicAdjustment": true
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `highWaterMark` | number | `256` | スピーカーバッファの上限（バイト） |
| `lowWaterMark` | number | `128` | スピーカーバッファの下限（バイト） |
| `dynamicAdjustment` | boolean | `true` | 音声長に応じた動的バッファサイズ調整 |

### パディング設定

音声の前後に無音を挿入し、途切れを防止します。

```json
{
  "audio": {
    "paddingSettings": {
      "enabled": true,
      "prePhonemeLength": 0.01,
      "postPhonemeLength": 0.01,
      "firstChunkOnly": true
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `enabled` | boolean | `true` | パディングの有効化 |
| `prePhonemeLength` | number | `0.01` | 音声前の無音時間（秒） |
| `postPhonemeLength` | number | `0.01` | 音声後の無音時間（秒） |
| `firstChunkOnly` | boolean | `true` | 最初のチャンクのみパディングを適用 |

### クロスフェード設定

チャンク間の滑らかな接続を実現します。

```json
{
  "audio": {
    "crossfadeSettings": {
      "enabled": true,
      "skipFirstChunk": true,
      "overlapSamples": 24
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `enabled` | boolean | `true` | クロスフェードの有効化 |
| `skipFirstChunk` | boolean | `true` | 最初のチャンクでクロスフェードをスキップ |
| `overlapSamples` | number | `24` | フェード処理を適用するサンプル数 |

## レイテンシモード別プリセット（🧪実験的機能）

> **⚠️ 注意**: 以下は将来実装予定の自動プリセット機能です。現在は個別に設定項目を指定する必要があります。

### Ultra-Low レイテンシモード

```json
{
  "audio": {
    "latencyMode": "ultra-low",
    "bufferSettings": {
      "highWaterMark": 64,
      "lowWaterMark": 32,
      "dynamicAdjustment": true
    },
    "paddingSettings": {
      "enabled": false,
      "prePhonemeLength": 0,
      "postPhonemeLength": 0,
      "firstChunkOnly": true
    },
    "crossfadeSettings": {
      "enabled": false,
      "skipFirstChunk": true,
      "overlapSamples": 0
    }
  }
}
```

**特徴**: 音声head途切れ対策を最優先、最小レイテンシを実現

### Balanced モード

```json
{
  "audio": {
    "latencyMode": "balanced",
    "bufferSettings": {
      "highWaterMark": 256,
      "lowWaterMark": 128,
      "dynamicAdjustment": true
    },
    "paddingSettings": {
      "enabled": true,
      "prePhonemeLength": 0.01,
      "postPhonemeLength": 0.01,
      "firstChunkOnly": true
    },
    "crossfadeSettings": {
      "enabled": true,
      "skipFirstChunk": true,
      "overlapSamples": 24
    }
  }
}
```

**特徴**: レイテンシと音質のバランス、一般的な用途に最適

### Quality モード

```json
{
  "audio": {
    "latencyMode": "quality",
    "bufferSettings": {
      "highWaterMark": 512,
      "lowWaterMark": 256,
      "dynamicAdjustment": false
    },
    "paddingSettings": {
      "enabled": true,
      "prePhonemeLength": 0.02,
      "postPhonemeLength": 0.02,
      "firstChunkOnly": false
    },
    "crossfadeSettings": {
      "enabled": true,
      "skipFirstChunk": false,
      "overlapSamples": 48
    }
  }
}
```

**特徴**: 最高音質、録音や高品質再生に最適

## 後方互換性

v2.1.0以前の設定形式も引き続きサポートされます。新形式と併用する場合、新形式が優先されます。

### 旧形式の例

```json
{
  "host": "localhost",
  "port": "50032",
  "voice_id": "voice-uuid-here",
  "style_id": 0,
  "rate": 200,
  "defaultChunkMode": "auto",
  "defaultBufferSize": 1024,
  "chunkSizeSmall": 30,
  "chunkSizeMedium": 50,
  "chunkSizeLarge": 100,
  "overlapRatio": 0.1
}
```

## 設定例

### リアルタイム対話用設定

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_voice_id": "your-voice-id",
    "rate": 180
  },
  "audio": {
    "latencyMode": "ultra-low",
    "splitMode": "small"
  }
}
```

### 高品質録音用設定

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_voice_id": "your-voice-id",
    "rate": 200
  },
  "audio": {
    "latencyMode": "quality",
    "splitMode": "large",
    "processing": {
      "synthesisRate": 44100,
      "playbackRate": 44100,
      "noiseReduction": true,
      "lowpassFilter": true
    }
  }
}
```

### カスタム詳細設定

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_voice_id": "your-voice-id",
    "rate": 200
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "medium",
    "bufferSettings": {
      "highWaterMark": 512,
      "lowWaterMark": 256,
      "dynamicAdjustment": true
    },
    "paddingSettings": {
      "enabled": true,
      "prePhonemeLength": 0.015,
      "postPhonemeLength": 0.015,
      "firstChunkOnly": true
    },
    "crossfadeSettings": {
      "enabled": true,
      "skipFirstChunk": true,
      "overlapSamples": 32
    },
    "splitSettings": {
      "mediumSize": 60,
      "overlapRatio": 0.15
    }
  }
}
```

## トラブルシューティング

### 音声が途切れる場合

1. `latencyMode` を `"ultra-low"` に設定
2. `crossfadeSettings.skipFirstChunk` を `true` に設定
3. `paddingSettings.enabled` を `false` に設定

### レイテンシが高い場合

1. `bufferSettings.highWaterMark` を小さく設定（64-128）
2. `splitMode` を `"small"` に変更
3. `processing.noiseReduction` を `false` に設定

### 音質を優先したい場合

1. `latencyMode` を `"quality"` に設定
2. `processing.synthesisRate` と `playbackRate` を高く設定
3. `processing.noiseReduction` を `true` に設定

## 参考資料

- [音声ストリーミングシステムガイド](./audio-streaming-guide.md)
- [開発Tips](./development-tips.md)