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

| モード | 分割サイズ | オーバーラップ | 用途 |
|--------|------------|----------------|------|
| `none` | 分割なし | なし | 長文の自然な読み上げ |
| `small` | 30文字 | 3文字 | 低レイテンシが必要な用途 |
| `medium` | 50文字 | 5文字 | バランス重視（デフォルト） |
| `large` | 100文字 | 10文字 | 安定性重視 |
| `auto` | 自動選択 | 自動調整 | システム判断に委ねる |

### 分割モードの選び方

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

## 使用例

### 基本的な使用方法

```typescript
import { SayCoeiroink } from './say/index.js';

const sayCoeiroink = new SayCoeiroink();
await sayCoeiroink.initialize();

// デフォルト設定
await sayCoeiroink.synthesizeText("こんにちは、世界！");

// カスタム設定
await sayCoeiroink.synthesizeText("長い文章の読み上げテスト", {
    chunkMode: 'none',
    bufferSize: 2048
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
    chunkMode?: 'auto' | 'none' | 'small' | 'medium' | 'large';
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

### v1.0.0 - 初期リリース
- 基本的な音声合成機能
- システムコマンド依存の音声再生

---

**最終更新**: 2025年1月6日  
**バージョン**: 2.0.0