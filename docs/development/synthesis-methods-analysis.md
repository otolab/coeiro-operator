# 音声合成メソッドの分析

## 概要
coeiro-operatorプロジェクトには複数の音声合成関連メソッドが存在し、それぞれ異なる役割と責務を持っています。

## メソッド一覧と役割

### 1. SayCoeiroinkクラス（packages/audio/src/index.ts）

#### 公開メソッド

##### `synthesizeText(text, options)`
- **役割**: CLIからの完全同期実行用メソッド
- **特徴**:
  - ウォームアップ → 音声合成 → 完了待機を全てqueueで処理
  - 同期的な動作でユーザーが完了を確認できる
  - ファイル出力時はウォームアップと完了待機をスキップ
- **利用者**: CLI（say-coeiroinkコマンド）

##### `synthesizeTextAsync(text, options)`
- **役割**: MCPサーバから呼び出される非同期キューイング版メソッド
- **特徴**:
  - SpeechQueueにタスクを投稿のみ（即座にレスポンス）
  - 実際の音声合成・再生は背景で非同期実行
  - Claude Codeの応答性を重視した設計
  - ウォームアップや完了待機は実行しない
- **利用者**: MCPサーバ

##### `synthesizeTextAsyncAndWait(text, options)`
- **役割**: デバッグ用：キュー処理完了を待つ版メソッド
- **特徴**:
  - テスト環境などで音声合成の完了確認が必要な場合に使用
  - 通常のMCP動作では使用しない
- **利用者**: テストコード

#### 内部メソッド

##### `synthesizeTextInternal(text, options)`
- **役割**: 内部用の実際の音声合成処理（分割後のメインメソッド）
- **特徴**:
  - オプション解析
  - 音声設定の決定（VoiceConfigに統一）
  - ストリーミング/通常モードの判定と実行
- **呼び出し元**: SpeechQueueから呼ばれる（コールバック経由）

##### `streamSynthesizeAndPlay(text, voiceConfig, speed, controllerOptions)`
- **役割**: ストリーミング音声合成と再生
- **特徴**:
  - AudioSynthesizerのsynthesizeStreamを使用
  - AudioPlayerのplayStreamingAudioを使用
  - リアルタイムストリーミング再生

##### `playAudioStream(audioResult)`
- **役割**: AudioPlayerのplayAudioStreamメソッドのラッパー
- **特徴**: 単純なプロキシメソッド

### 2. AudioSynthesizerクラス（packages/audio/src/audio-synthesizer.ts）

##### `synthesizeChunk(chunk, voiceConfig, speed)`
- **役割**: 単一チャンクの音声合成
- **特徴**:
  - COEIROINK APIの`/v1/synthesis`エンドポイントを直接呼び出し
  - 音声パラメータの設定（速度、音量、ピッチ、イントネーション等）
  - パディング処理（音切れ防止）
  - WAVファイルの生成
- **呼び出し元**: AudioStreamController

##### `synthesizeStream(text, voiceConfig, speed, chunkMode)`
- **役割**: テキストを分割してストリーミング音声合成
- **特徴**:
  - テキストをチャンクに分割
  - AudioStreamControllerを使用してストリーミング生成
  - AsyncGeneratorパターンで逐次的に音声データを返す
- **呼び出し元**: SayCoeiroink.streamSynthesizeAndPlay

### 3. AudioStreamControllerクラス（packages/audio/src/audio-stream-controller.ts）

##### `synthesizeStream(chunks, voiceConfig, speed)`
- **役割**: チャンクの並行/順次処理制御
- **特徴**:
  - 並行生成モードの制御
  - チャンクの順序保証
  - エラーハンドリング
- **呼び出し元**: AudioSynthesizer.synthesizeStream

### 4. AudioPlayerクラス（packages/audio/src/audio-player.ts）

##### `playAudioStream(audioResult, bufferSize)`
- **役割**: 単一の音声データを再生
- **特徴**: WAVファイルをPCMにデコードして再生

##### `playStreamingAudio(audioStream)`
- **役割**: ストリーミング音声の順次再生
- **特徴**: AsyncGeneratorから音声を受け取り順次再生

##### `playStreamingAudioParallel(audioStream)`
- **役割**: ストリーミング音声の並行再生
- **特徴**: バッファリングしながら並行再生

## 呼び出しフロー

### CLIモード
```
CLI → synthesizeText
  → SpeechQueue.enqueueAndWait
    → synthesizeTextInternal（コールバック）
      → streamSynthesizeAndPlay
        → AudioSynthesizer.synthesizeStream
          → AudioStreamController.synthesizeStream
            → AudioSynthesizer.synthesizeChunk（各チャンク）
              → COEIROINK API
        → AudioPlayer.playStreamingAudio
```

### MCPモード
```
MCP → synthesizeTextAsync
  → SpeechQueue.enqueue（非同期）
    → synthesizeTextInternal（背景実行）
      → （以下同じ）
```

## 問題点と改善提案

### 1. 命名の一貫性
- `synthesizeText` vs `synthesizeTextAsync` vs `synthesizeTextInternal`
  - 同期/非同期の区別が名前から明確でない
  - `Internal`サフィックスは実装詳細を露出

**改善案**:
```typescript
// 公開API
synthesize()          // 汎用メソッド（オプションで動作を制御）
synthesizeSync()      // 明示的に同期版
synthesizeAsync()     // 明示的に非同期版

// 内部実装
private processSynthesis()  // 実際の処理
```

### 2. 責務の重複
- SayCoeiroinkクラスが多くの責務を持ちすぎ
  - キュー管理
  - 音声設定の解決
  - ストリーミング制御
  - エラーハンドリング

**改善案**:
- ファサードパターンの適用
- 各責務を専門クラスに分離

### 3. ストリーミングと非ストリーミングの分岐
- `synthesizeTextInternal`内で複雑な分岐
- ストリーミングモードの判定ロジックが散在

**改善案**:
- Strategy パターンの適用
- `StreamingSynthesizer`と`SimpleSynthesizer`に分離

### 4. エラーハンドリングの一貫性
- 各レイヤーで異なるエラー処理
- エラーメッセージの不統一

**改善案**:
- 統一されたエラー階層の定義
- エラーハンドリングミドルウェアの導入

## リファクタリング優先度

1. **高**: 命名の統一（breaking changeなし）
2. **中**: 内部構造の整理（外部APIは維持）
3. **低**: 新アーキテクチャへの移行（v3.0として）

## まとめ

現在の実装は機能的には動作していますが、以下の点で改善の余地があります：

1. **メソッド名の曖昧さ**: 同期/非同期、内部/外部の区別が不明確
2. **責務の集中**: SayCoeiroinkクラスに多くの責務が集中
3. **コードの重複**: 似たような処理が複数箇所に存在
4. **テストの困難さ**: 密結合により単体テストが困難

ただし、現在の実装は安定して動作しており、急いでリファクタリングする必要はありません。
新機能追加や大規模な変更のタイミングで、段階的に改善していくことを推奨します。