# 音声再生パイプライン

## 概要

MCPツール(say)から音声デバイスへの出力までのデータフロー。

## パイプライン

```
MCPツール(say) → SayCoeiroink.synthesize() → SpeechQueue → TaskQueue
  → SynthesisProcessor.process()
    → AudioSynthesizer.synthesizeStream()  // COEIROINK API (WAV取得)
    → AudioPlayer.playStreamingAudio()     // PCM変換 → 音声出力
```

### 音声合成 (AudioSynthesizer)

- COEIROINK API `POST /v1/synthesis` を呼び出し
- テキストをチャンク分割し、並行生成（AudioStreamController / ChunkGenerationManager）
- 出力: WAV (24kHz / 16bit / mono)

### 音声再生 (AudioPlayer)

- WAVからPCM抽出
- オプション: 高品質処理パイプライン（リサンプリング24kHz→48kHz, ローパスフィルター, ノイズ除去）
- `@echogarden/audio-io` の `createAudioOutput()` で音声デバイスに出力
- コールバックベースAPI。chunkQueueで管理し、audioOutputHandlerで順次書き込み

## 音声出力バックエンド

唯一の音声デバイス接触点は `AudioPlayer.ensureAudioOutput()` (audio-player.ts)。
`@echogarden/audio-io` の `createAudioOutput()` を使用。

## オプション機能（デフォルト無効）

| 機能 | ライブラリ | 内容 |
|------|-----------|------|
| リサンプリング | 自前実装 | 線形補間 24kHz→48kHz |
| ローパスフィルター | dsp.js | IIRFilter |
| ノイズ除去 | echogarden | rnnoise エンジン |

## 主要ファイル

| ファイル | 役割 |
|---------|------|
| packages/audio/src/index.ts | SayCoeiroinkファサード |
| packages/audio/src/synthesis-processor.ts | 合成→再生のオーケストレーション |
| packages/audio/src/audio-synthesizer.ts | COEIROINK API通信 |
| packages/audio/src/audio-player.ts | PCM変換と音声出力 |
| packages/audio/src/audio-stream-controller.ts | ストリーム制御・並行生成 |
| packages/audio/src/queue/speech-queue.ts | 音声タスクキュー |
| packages/audio/src/queue/task-queue.ts | 汎用タスクキュー |

## PulseAudio対応に向けて

Issue #236 で検討中。`ensureAudioOutput()` の1箇所を抽象化することで、バックエンド切り替えが実現可能。

## 関連ドキュメント

- [音声処理システム](audio-system.md) — リサンプリング、フィルター等の技術詳細
- [音声設定の階層構造](voice-architecture.md)
