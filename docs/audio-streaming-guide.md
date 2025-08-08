# 音声ストリーミング再生システム ガイド

## 概要

COEIRO Operatorの音声再生システムは、speakerライブラリを使用したネイティブ音声出力により、高品質でカスタマイズ可能なストリーミング再生を提供します。

## 主要な特徴

### 🎵 **ネイティブ音声出力**
- speakerライブラリによる直接音声デバイス出力
- 子プロセス管理不要
- 一時ファイル不要のメモリ上処理

### ⚡ **真のストリーミング再生**
- 非同期ジェネレータによる連続音声出力
- 最初のチャンクから即座に再生開始
- 低レイテンシと高スループットの両立

### 🔧 **カスタマイズ可能な分割制御**
- テキスト分割モードの選択
- バッファサイズの調整
- 用途に応じた最適化設定

## テキスト分割モード

### 分割モード一覧

| モード | 分割方法 | オーバーラップ | 用途 |
|--------|----------|----------------|------|
| `punctuation` | 句読点ベース | なし | **デフォルト**: 日本語の自然な分割 |
| `none` | 分割なし | なし | 長文の自然な読み上げ |
| `small` | 30文字 | 3文字 | 低レイテンシが必要な用途 |
| `medium` | 50文字 | 5文字 | バランス重視 |
| `large` | 100文字 | 10文字 | 安定性重視 |
| `auto` | 自動選択（50文字） | 自動調整 | システム判断に委ねる |

### 分割モードの選び方

#### 🎯 **句読点分割 (`punctuation`)** - 推奨
```typescript
{
    chunkMode: 'punctuation',
    bufferSize: 1024
}
```

**特徴:**
- 句点（。）で文単位に分割
- 長い文は読点（、）で補助的に分割
- 句読点がない場合は最大150文字で強制分割
- 最小10文字以上のチャンクのみ生成

**適用場面:**
- 日本語テキストの自然な音声合成
- 小説、記事、会話文などの読み上げ
- 音切れを防ぎたい一般的な用途

**メリット:**
- 自然な間とイントネーション
- 文の意味を考慮した分割
- 音質と応答性のバランス

#### 🚫 **分割なし (`none`)**
```typescript
{
    chunkMode: 'none',
    bufferSize: 2048
}
```

**適用場面:**
- 長文の読み上げ
- 自然な話し方が重要
- 音の継ぎ目を避けたい場合

**メリット:**
- 分割による音切れがない
- API呼び出し回数が最小
- 最も自然な音声品質

**注意点:**
- 非常に長い文章では処理時間が増加
- メモリ使用量が大きくなる可能性

#### ⚡ **小分割 (`small`)**
```typescript
{
    chunkMode: 'small',
    bufferSize: 256
}
```

**適用場面:**
- チャット・対話システム
- リアルタイム応答が必要
- ユーザーの待機時間を最小化

**メリット:**
- 最低レイテンシ
- 即座に再生開始
- レスポンシブな体験

#### ⚖️ **中分割 (`medium`) - デフォルト**
```typescript
{
    chunkMode: 'medium',
    bufferSize: 1024
}
```

**適用場面:**
- 一般的な用途
- バランス重視
- 迷った場合の選択

**メリット:**
- レイテンシと品質のバランス
- 安定した動作
- CPU負荷が適度

#### 🛡️ **大分割 (`large`)**
```typescript
{
    chunkMode: 'large',
    bufferSize: 4096
}
```

**適用場面:**
- 重要なアナウンス
- 音声品質を最重視
- ネットワークが不安定な環境

**メリット:**
- 最も安定した再生
- 音切れリスクが最小
- ネットワーク効率が良い

## バッファサイズ制御

### バッファサイズと効果

| サイズ | レイテンシ | 安定性 | CPU負荷 | 推奨用途 |
|--------|------------|--------|---------|----------|
| 256 | 最低 | 低 | 高 | リアルタイム対話 |
| 512 | 低 | 中低 | 中高 | インタラクティブ |
| 1024 | 中 | 中 | 中 | 一般用途（デフォルト） |
| 2048 | 中高 | 高 | 中低 | 安定性重視 |
| 4096 | 高 | 最高 | 低 | 品質最優先 |
| 8192 | 最高 | 最高 | 最低 | バックグラウンド再生 |

### バッファサイズの選び方

#### 🏃 **低レイテンシ優先**
```typescript
{
    bufferSize: 256  // または 512
}
```
- ゲーム・VR
- チャットボット
- リアルタイム翻訳

#### ⚖️ **バランス重視**
```typescript
{
    bufferSize: 1024  // デフォルト
}
```
- Webアプリケーション
- 一般的なTTS用途
- デスクトップアプリ

#### 🛡️ **安定性優先**
```typescript
{
    bufferSize: 2048  // または 4096
}
```
- プレゼンテーション
- 公式アナウンス
- 長時間再生

<<<<<<< HEAD
## 設定ファイル

### COEIROINK設定ファイル

設定ファイル: `~/.coeiro-operator/coeiroink-config.json`

```json
{
  "host": "localhost",
  "port": "50032",
  "rate": 200,
  "defaultChunkMode": "none",
  "defaultBufferSize": 512,
  "chunkSizeSmall": 30,
  "chunkSizeMedium": 50,
  "chunkSizeLarge": 100,
  "overlapRatio": 0.1
}
```

### 設定項目の説明

| 項目 | デフォルト | 説明 |
|------|------------|------|
| `defaultChunkMode` | `"auto"` | デフォルトのテキスト分割モード |
| `defaultBufferSize` | `1024` | デフォルトのスピーカーバッファサイズ（バイト） |
| `chunkSizeSmall` | `30` | smallモード時の分割サイズ（文字数） |
| `chunkSizeMedium` | `50` | mediumモード時の分割サイズ（文字数） |
| `chunkSizeLarge` | `100` | largeモード時の分割サイズ（文字数） |
| `overlapRatio` | `0.1` | オーバーラップ比率（0.0-1.0） |

=======
>>>>>>> origin/main
## 使用例

### 基本的な使用方法

```typescript
import { SayCoeiroink } from './say/index.js';

const sayCoeiroink = new SayCoeiroink();
await sayCoeiroink.initialize();

<<<<<<< HEAD
// デフォルト設定（設定ファイルから読み込み）
await sayCoeiroink.synthesizeText("こんにちは、世界！");

// カスタム設定（設定ファイルをオーバーライド）
await sayCoeiroink.synthesizeText("長い文章の読み上げテスト", {
    chunkMode: 'large',
    bufferSize: 4096
=======
// デフォルト設定
await sayCoeiroink.synthesizeText("こんにちは、世界！");

// カスタム設定
await sayCoeiroink.synthesizeText("長い文章の読み上げテスト", {
    chunkMode: 'none',
    bufferSize: 2048
>>>>>>> origin/main
});
```

### 用途別設定例

#### チャットボット
```typescript
await sayCoeiroink.synthesizeText(userMessage, {
    chunkMode: 'small',
    bufferSize: 256,
    rate: 220  // 少し早口
});
```

#### ニュース読み上げ
```typescript
await sayCoeiroink.synthesizeText(newsArticle, {
    chunkMode: 'none',
    bufferSize: 4096,
    rate: 180  // ゆっくりと明瞭に
});
```

#### アラート・通知
```typescript
await sayCoeiroink.synthesizeText(alertMessage, {
    chunkMode: 'small',
    bufferSize: 512,
    style: 'urgent'  // 緊急度の高いスタイル
});
```

#### 長文コンテンツ
```typescript
await sayCoeiroink.synthesizeText(longContent, {
    chunkMode: 'large',
    bufferSize: 2048,
    rate: 200
});
```

<<<<<<< HEAD
## キャラクター×スタイル指定システム

### 概要

COEIRO Operatorでは、キャラクター（オペレータ）ごとに複数の音声スタイルを選択できます。スタイルはキャラクターの性格や話し方を表現するもので、同じテキストでも異なる音調や感情で読み上げることができます。

### スタイル選択方式

キャラクターには以下の3つのスタイル選択方式が設定できます：

#### 🎯 **default（デフォルト）**
```typescript
{
    style_selection: "default",
    default_style: "normal"  // 指定されたデフォルトスタイルを常に使用
}
```

**動作:**
- 常に`default_style`で指定されたスタイルを使用
- 最も予測可能で安定した動作
- 一貫した音声品質が必要な場合に最適

**適用場面:**
- 公式アナウンス
- ビジネス用途
- 一貫性が重要なシステム

#### 🎲 **random（ランダム）**
```typescript
{
    style_selection: "random",
    available_styles: {
        "normal": { name: "れいせい", style_id: 0 },
        "happy": { name: "うれしい", style_id: 1 },
        "sad": { name: "かなしい", style_id: 2 }
    }
}
```

**動作:**
- 利用可能なスタイルからランダムに選択
- `disabled: true`のスタイルは除外
- 毎回異なるスタイルで読み上げる可能性

**適用場面:**
- エンターテイメント用途
- チャットボット
- 表現に変化を持たせたい場合

#### 📌 **specified（指定）**
```typescript
{
    style_selection: "specified",
    default_style: "happy"  // defaultと同じ動作
}
```

**動作:**
- 現在は`default`と同じ動作
- 将来的な拡張のための予約値
- `default_style`で指定されたスタイルを使用

### 明示的スタイル指定

音声合成時に`style`オプションを指定することで、キャラクターの設定を一時的に上書きできます：

```typescript
// キャラクターの設定に関係なく、指定したスタイルを使用
await sayCoeiroink.synthesizeText("こんにちは！", {
    style: "happy"  // 明示的にhappyスタイルを指定
});
```

### スタイル指定の優先順位

スタイルは以下の優先順位で決定されます：

1. **明示的指定** (`SynthesizeOptions.style`)
2. **キャラクター設定**
   - `style_selection: "random"` → ランダム選択
   - `style_selection: "default"` または `"specified"` → `default_style`使用
3. **フォールバック** → 利用可能な最初のスタイル

### 実装例

#### デフォルトスタイルキャラクター
```typescript
const character = {
    name: "つくよみちゃん",
    style_selection: "default",
    default_style: "normal",
    available_styles: {
        "normal": { name: "れいせい", style_id: 0 },
        "ura": { name: "うら", style_id: 1 }
    }
};

// 常に「れいせい」スタイルで読み上げ
await sayCoeiroink.synthesizeText("テストメッセージ");
```

#### ランダムスタイルキャラクター
```typescript
const character = {
    name: "ずんだもん",
    style_selection: "random",
    available_styles: {
        "normal": { name: "ノーマル", style_id: 0 },
        "amaama": { name: "あまあま", style_id: 1 },
        "tsuyo": { name: "つよめ", style_id: 2 }
    }
};

// 毎回異なるスタイルで読み上げ（ノーマル/あまあま/つよめのいずれか）
await sayCoeiroink.synthesizeText("テストメッセージ");
```

#### 明示的スタイル指定
```typescript
// キャラクター設定に関係なく、特定のスタイルを強制指定
await sayCoeiroink.synthesizeText("緊急メッセージ", {
    style: "tsuyo"  // 「つよめ」スタイルを明示的に指定
});

await sayCoeiroink.synthesizeText("優しいメッセージ", {
    style: "amaama"  // 「あまあま」スタイルを明示的に指定
});
```

### スタイル無効化

特定のスタイルを無効にすることも可能です：

```typescript
const character = {
    available_styles: {
        "normal": { name: "ノーマル", style_id: 0 },
        "angry": { name: "怒り", style_id: 1, disabled: true },  // 無効化
        "happy": { name: "喜び", style_id: 2 }
    }
};

// ランダム選択時は「ノーマル」と「喜び」のみが対象
// 明示的に"angry"を指定してもデフォルトスタイルにフォールバック
```

### 技術仕様

#### OperatorVoice型定義
```typescript
interface OperatorVoice {
    voice_id: string;
    character?: {
        available_styles?: Record<string, {
            disabled?: boolean;
            style_id: number;
            name: string;
        }>;
        style_selection: "default" | "random" | "specified";
        default_style: string;
    };
}
```

#### スタイル選択アルゴリズム
1. 利用可能スタイル抽出（`disabled: true`を除外）
2. 明示的指定チェック
3. `style_selection`方式による選択
4. フォールバック処理

### 使用上の注意

#### スタイル名の指定方法
- スタイルIDまたはスタイル名で指定可能
- 大文字小文字は区別されません
- 存在しないスタイルを指定した場合はデフォルトスタイルにフォールバック

#### パフォーマンスへの影響
- ランダム選択は毎回わずかな計算コストが発生
- スタイル切り替えによる音声品質への影響はありません
- キャッシュされた音声合成結果は再利用されません

=======
>>>>>>> origin/main
## パフォーマンス最適化

### レイテンシ最適化
```typescript
{
    chunkMode: 'small',
    bufferSize: 256,
    streamMode: true
}
```

### 品質最適化
```typescript
{
    chunkMode: 'none',
    bufferSize: 4096,
    rate: 180
}
```

### CPU負荷軽減
```typescript
{
    chunkMode: 'large',
    bufferSize: 4096
}
```

### メモリ効率化
```typescript
{
    chunkMode: 'medium',
    bufferSize: 1024
}
```

## トラブルシューティング

### 音切れが発生する場合
1. バッファサイズを増やす: `bufferSize: 2048`
2. 分割サイズを大きくする: `chunkMode: 'large'`
3. CPUリソースを確認

### レイテンシが高い場合
1. バッファサイズを減らす: `bufferSize: 512`
2. 分割サイズを小さくする: `chunkMode: 'small'`
3. 分割なしモードを試す: `chunkMode: 'none'`

### CPU負荷が高い場合
1. バッファサイズを増やす: `bufferSize: 2048`
2. 分割サイズを大きくする: `chunkMode: 'large'`
3. 並列処理数を制限

### メモリ使用量が多い場合
1. 分割モードを使用: `chunkMode: 'medium'`
2. バッファサイズを調整: `bufferSize: 1024`
3. 長文を事前に分割

## 技術仕様

### サポートする音声フォーマット
- **入力**: テキスト（UTF-8）
- **中間**: WAV形式（24kHz、16bit、モノラル）
- **出力**: PCMデータ（ネイティブ音声デバイス）

### システム要件
- Node.js 18.0以上
- speakerライブラリ対応OS
  - macOS: Core Audio
  - Linux: ALSA/PulseAudio
  - Windows: WASAPI

### 依存関係
- `speaker`: ネイティブ音声出力
- COEIROINKサーバー: 音声合成API

## API リファレンス

### SynthesizeOptions

```typescript
interface SynthesizeOptions {
    voice?: string | OperatorVoice | null;  // 音声ID
    rate?: number;                          // 話速（WPM）
    outputFile?: string | null;             // 出力ファイル
    streamMode?: boolean;                   // ストリーミングモード
    style?: string;                         // 音声スタイル
    chunkMode?: 'punctuation' | 'auto' | 'none' | 'small' | 'medium' | 'large';
    bufferSize?: number;                    // バッファサイズ（バイト）
}
```

### 分割設定詳細

```typescript
const CHUNK_MODE_CONFIG = {
    none: { chunkSize: Infinity, overlap: 0 },
    small: { chunkSize: 30, overlap: 3 },
    medium: { chunkSize: 50, overlap: 5 },
    large: { chunkSize: 100, overlap: 10 },
    auto: { chunkSize: 50, overlap: 5 }
} as const;
```

## 更新履歴

### v2.0.0 - 2025-01-06
- ✅ speakerライブラリによるネイティブ音声出力
- ✅ テキスト分割モード制御機能
- ✅ バッファサイズ制御機能
- ✅ 子プロセス管理の完全排除
- ✅ 一時ファイル不要のメモリ上処理
- ✅ 真のストリーミング音声再生
<<<<<<< HEAD
- ✅ 設定ファイルによるデフォルト値カスタマイズ
- ✅ CLIオプション（--chunk-mode, --buffer-size）対応
=======
>>>>>>> origin/main

### v1.0.0 - 初期リリース
- 基本的な音声合成機能
- システムコマンド依存の音声再生

---

**最終更新**: 2025年1月6日  
**バージョン**: 2.0.0