# COEIRO Operator 設定オプション

COEIRO Operatorの音声合成システムは、詳細な設定によりパフォーマンスと音質を調整できます。設定は機能別に整理されており、用途に応じた最適化が可能です。

> 🔗 **コード参照**: この設定の実装については `src/core/say/constants.ts` を参照してください  
> 📝 **設定例**: `docs/config-samples/` で実際の設定ファイル例を確認できます  
> ⚠️  **重要**: 設定値を変更する際は、コードとドキュメント両方の同期更新が必要です

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
    "splitMode": "punctuation",
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

### レイテンシモード

```json
{
  "audio": {
    "latencyMode": "ultra-low"
  }
}
```

| モード | 用途 | 特徴 |
|--------|------|------|
| `ultra-low` | リアルタイム対話 | 最低レイテンシ、音声head途切れ対策を最優先 |
| `balanced` | 一般用途 | レイテンシと音質のバランス |
| `quality` | 高音質録音 | 最高音質、レイテンシは二の次 |

### 分割モード

長いテキストを効率的に処理するための分割設定です。

```json
{
  "audio": {
    "splitMode": "punctuation"
  }
}
```

| モード | 分割方法 | 用途 |
|--------|----------|------|
| `punctuation` | 句読点ベース | **デフォルト**: 日本語の自然な分割 |
| `none` | 分割なし | 短いテキスト、一括処理 |
| `small` | 30文字 | 低レイテンシ重視 |
| `medium` | 50文字 | バランス型 |
| `large` | 100文字 | 高品質重視 |
| `auto` | 自動判定（50文字） | テキスト長に応じて最適化 |

#### 句読点分割モード（推奨）

`punctuation` モードは日本語テキストの自然な分割を実現します：

- **句点（。）優先**: 文の終わりで自然に分割
- **読点（、）補助**: 長い文は読点で適切に分割
- **フォールバック**: 句読点がない場合は最大150文字で分割
- **品質保証**: 最小10文字以上のチャンクのみ生成

```json
{
  "audio": {
    "splitMode": "punctuation",
    "latencyMode": "balanced"
  }
}
```

### 音声処理設定（高度な設定）

音声処理の詳細設定は、`latencyMode`プリセットにより自動最適化されます。基本的には手動設定は不要です。

```json
{
  "audio": {
    "latencyMode": "balanced",  // 推奨: プリセット使用
    "processing": {
      "noiseReduction": true    // 必要に応じてプリセット値を上書き
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `synthesisRate` | number | `24000` | 音声合成時のサンプルレート（Hz） |
| `playbackRate` | number | `48000` | 再生時のサンプルレート（Hz） |
| `noiseReduction` | boolean | プリセット依存 | Echogardenによるノイズ除去 |
| `lowpassFilter` | boolean | プリセット依存 | ローパスフィルターの有効化 |
| `lowpassCutoff` | number | `24000` | ローパスフィルターのカットオフ周波数（Hz） |

> 📍 **コード実装**: `SAMPLE_RATES.SYNTHESIS`, `SAMPLE_RATES.PLAYBACK`, `FILTER_SETTINGS.*` (`src/core/say/constants.ts`)

**注意**: これらの設定は`latencyMode`により自動最適化されます。個別設定は特別な要件がある場合のみ推奨します。

### 分割設定（高度な設定）

テキスト分割の詳細設定は、`splitMode`により自動最適化されます。基本的には手動設定は不要です。

```json
{
  "audio": {
    "splitMode": "punctuation",        // 推奨: 句読点ベース分割
    "splitSettings": {
      "mediumSize": 60          // 必要に応じてプリセット値を上書き
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

> 📍 **コード実装**: `SPLIT_SETTINGS.DEFAULTS.*`, `SPLIT_SETTINGS.PRESETS.*` (`src/core/say/constants.ts`)

**注意**: これらの設定は`splitMode`により自動設定されます。個別設定は特別な要件がある場合のみ推奨します。

### バッファ設定（高度な設定）

バッファ設定は、`latencyMode`プリセットにより自動最適化されます。基本的には手動設定は不要です。

```json
{
  "audio": {
    "latencyMode": "ultra-low",     // 推奨: プリセット使用
    "bufferSettings": {
      "dynamicAdjustment": false    // 必要に応じてプリセット値を上書き
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `highWaterMark` | number | プリセット依存 | スピーカーバッファの上限（バイト） |
| `lowWaterMark` | number | プリセット依存 | スピーカーバッファの下限（バイト） |
| `dynamicAdjustment` | boolean | プリセット依存 | 音声長に応じた動的バッファサイズ調整 |

> 📍 **コード実装**: `BUFFER_SIZES.DEFAULT`, `BUFFER_SIZES.PRESETS.*` (`src/core/say/constants.ts`)

**注意**: これらの設定は`latencyMode`により自動最適化されます。個別設定は特別な要件がある場合のみ推奨します。

### パディング設定（高度な設定）

パディング設定は、`latencyMode`プリセットにより自動最適化されます。基本的には手動設定は不要です。

```json
{
  "audio": {
    "latencyMode": "quality",       // 推奨: プリセット使用
    "paddingSettings": {
      "prePhonemeLength": 0.02      // 必要に応じてプリセット値を上書き
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `enabled` | boolean | プリセット依存 | パディングの有効化 |
| `prePhonemeLength` | number | プリセット依存 | 音声前の無音時間（秒） |
| `postPhonemeLength` | number | プリセット依存 | 音声後の無音時間（秒） |
| `firstChunkOnly` | boolean | プリセット依存 | 最初のチャンクのみパディングを適用 |

**注意**: これらの設定は`latencyMode`により自動最適化されます。個別設定は特別な要件がある場合のみ推奨します。

### クロスフェード設定（高度な設定）

クロスフェード設定は、`latencyMode`プリセットにより自動最適化されます。基本的には手動設定は不要です。

```json
{
  "audio": {
    "latencyMode": "balanced",      // 推奨: プリセット使用
    "crossfadeSettings": {
      "overlapSamples": 32          // 必要に応じてプリセット値を上書き
    }
  }
}
```

| 設定項目 | 型 | デフォルト | 説明 |
|----------|----|-----------|----- |
| `enabled` | boolean | プリセット依存 | クロスフェードの有効化 |
| `skipFirstChunk` | boolean | プリセット依存 | 最初のチャンクでクロスフェードをスキップ |
| `overlapSamples` | number | プリセット依存 | フェード処理を適用するサンプル数 |

**注意**: これらの設定は`latencyMode`により自動最適化されます。個別設定は特別な要件がある場合のみ推奨します。

## レイテンシモード別プリセット

`latencyMode`を指定することで、以下のプリセットが自動適用されます。個別設定で上書きも可能です。

### Ultra-Low レイテンシモード

```json
{
  "audio": {
    "latencyMode": "ultra-low"
  }
}
```

上記の設定は以下のプリセットを自動適用します：

```json
{
  "processing": {
    "noiseReduction": false,
    "lowpassFilter": false
  },
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
```

**特徴**: 音声head途切れ対策を最優先、最小レイテンシを実現、フィルタ無効

### Balanced モード

```json
{
  "audio": {
    "latencyMode": "balanced"
  }
}
```

上記の設定は以下のプリセットを自動適用します：

```json
{
  "processing": {
    "noiseReduction": false,
    "lowpassFilter": true
  },
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
```

**特徴**: レイテンシと音質のバランス、一般的な用途に最適、ローパスフィルタ有効

### Quality モード

```json
{
  "audio": {
    "latencyMode": "quality"
  }
}
```

上記の設定は以下のプリセットを自動適用します：

```json
{
  "processing": {
    "noiseReduction": true,
    "lowpassFilter": true
  },
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
```

**特徴**: 最高音質、録音や高品質再生に最適、全フィルタ有効

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