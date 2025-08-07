# COEIRO Operator

COEIROINK音声合成システムのMCPサーバーとオペレータ管理システム

## 概要

COEIRO OperatorはCOEIROINKと連携して動作する高品質音声オペレータシステムです。Claude Codeでの作業時に、複数のキャラクターによる音声通知とコミュニケーションを提供します。

### 🎵 主な機能

- **高品質ストリーミング音声処理**: 24kHz→48kHz高品質リサンプリング + デジタルフィルタリング
- **音声オペレータシステム**: 13種類のキャラクターによる音声通知
- **クロスプラットフォーム対応**: Windows / macOS / Linux ネイティブ音声出力
- **🆕 ネイティブ音声ストリーミング**: speakerライブラリによる高品質再生
- **🆕 分割モード制御**: テキスト分割なし〜細分化まで5段階選択
- **🆕 バッファリング制御**: レイテンシと安定性の最適化
- **MCPサーバー**: Claude Codeとの完全統合
- **非同期音声合成**: 低レイテンシストリーミング対応
- **AIノイズリダクション**: RNNoise搭載（オプション）
- **動的設定管理**: COEIROINKサーバーから音声フォントを自動検出
- **セッション管理**: 複数セッション間でのオペレータ重複防止

## ✨ 新機能ハイライト (v2.1.0)

### 🔧 設定構造の大幅改善
- **機能別設定構造**: connection, voice, audio による整理
- **レイテンシモード**: ultra-low / balanced / quality の3段階プリセット
- **音声head途切れ対策**: 詳細なパディング・クロスフェード制御
- **分割モード統一**: 用語を`chunkMode`から`splitMode`に変更

### 🎵 音声品質の最適化
- **動的バッファ調整**: 音声長とチャンク位置に応じた最適化
- **先頭チャンク保護**: 最初のチャンクで途切れ防止処理をスキップ
- **設定プリセット**: 用途別の最適化済み設定を提供

## インストール

### 事前要件

- **Node.js 18以上** (推奨: LTS版)
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **ビルドツール** - ネイティブモジュール構築用
  - Windows: Visual Studio Build Tools + WASAPI
  - macOS: Xcode Command Line Tools + Core Audio
  - Linux: build-essential + ALSA開発ライブラリ/PulseAudio

### NPMからのインストール

```bash
npm install -g coeiro-operator
```

### ソースからのインストール（開発用）

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

## MCPサーバー登録

Claude Codeで以下のコマンドを実行：

```bash
claude mcp add coeiro-operator --command "node dist/index.js"
```

## クイックスタート

### 1. COEIROINK起動確認

```bash
curl -X GET "http://localhost:50032/v1/speakers"
```

### 2. 動作テスト

```bash
# 音声出力テスト
say-coeiroink "音声テストです"

# オペレータ管理テスト
operator-manager assign
operator-manager status
```

## 基本的な使用方法

### コマンドライン

```bash
# 音声合成
say-coeiroink "こんにちは"
say-coeiroink -r 150 "ゆっくり話します"

# 新機能: 分割モード制御（v2.1.0+）
say-coeiroink --split-mode none "長文を分割せずにスムーズに読み上げ"
say-coeiroink --split-mode small "短いレスポンス"  # 低レイテンシ
say-coeiroink --buffer-size 2048 "高品質再生"      # バッファ制御

# オペレータ管理
operator-manager assign      # ランダム割り当て
operator-manager status      # 現在のステータス
operator-manager release     # オペレータ解放
```

## MCPツール

COEIRO Operatorは以下のMCPツールを提供します：

- `operator_assign` - オペレータ割り当て
- `operator_release` - オペレータ解放  
- `operator_status` - 状況確認
- `operator_available` - 利用可能一覧
- `say` - 音声出力（ストリーミング再生・splitMode・バッファ制御対応）

## 📚 ドキュメント

### 技術仕様
- **🆕 [docs/audio-streaming-guide.md](docs/audio-streaming-guide.md)** - 音声ストリーミング機能ガイド
- **[docs/audio-system.md](docs/audio-system.md)** - 音声システム詳細仕様
- **[docs/api-reference.md](docs/api-reference.md)** - 完全APIリファレンス

### ユーザーガイド  
- **[INSTALLATION.md](INSTALLATION.md)** - 詳細設定・カスタマイズガイド
- **[docs/installation.md](docs/installation.md)** - 詳細インストール・セットアップガイド
- **[docs/configuration-guide.md](docs/configuration-guide.md)** - 設定・カスタマイズガイド
- **[docs/troubleshooting.md](docs/troubleshooting.md)** - トラブルシューティング

### プロジェクト情報
- **[docs/changelog.md](docs/changelog.md)** - 変更履歴・リリースノート
- **[docs/CHARACTERS.md](docs/CHARACTERS.md)** - オペレータキャラクター詳細
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - システム仕様書

## 🔧 技術構成

### 音声処理アーキテクチャ
```
COEIROINK API → WAV → PCM → リサンプリング → フィルタリング → ノイズ除去 → Speaker出力
    (24kHz)                   (24→48kHz)      (ローパス24kHz)   (RNNoise)     (48kHz)
```

### 主要ライブラリ
- **speaker**: クロスプラットフォーム音声出力
- **node-libsamplerate**: 高品質リサンプリング
- **dsp.js**: デジタル信号処理・フィルタリング  
- **echogarden**: AI音声処理・ノイズリダクション

### ディレクトリ構造

```
coeiro-operator/
├── src/                     # ソースコード
│   ├── index.js            # MCPサーバーメイン  
│   ├── operator/           # オペレータ管理
│   └── say/               # 音声合成・処理
├── docs/                 # ドキュメント
│   ├── audio-system.md         # 音声システム仕様
│   ├── api-reference.md        # APIリファレンス
│   ├── installation.md         # インストールガイド
│   ├── configuration-guide.md  # 設定ガイド
│   ├── troubleshooting.md      # トラブルシューティング
│   └── changelog.md            # 変更履歴
├── prompts/              # システム仕様・開発手順
├── scripts/               # シェルスクリプト
└── tests/                # テストスイート
```

### 貢献

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

## 🚀 パフォーマンス

### v1.1.0 での改善
- **処理レイテンシ**: ~40% 削減
- **音質向上**: 高品質リサンプリング + デジタルフィルタリング
- **メモリ効率**: ストリーミング処理による一定使用量
- **プラットフォーム対応**: クロスプラットフォーム・ネイティブ出力

### 音質プリセット
```json
// バランス設定（推奨）
{
  "synthesisRate": 24000,
  "playbackRate": 48000,
  "lowpassFilter": true,
  "lowpassCutoff": 24000
}
```

## ライセンス

MIT License

Copyright (c) 2025 COEIRO Operator

詳細については [LICENSE](LICENSE) ファイルをご確認ください。

## 関連プロジェクト

- **[COEIROINK](https://coeiroink.com/)** - 音声合成エンジン本体
- **[Claude Code](https://claude.ai/code)** - AI開発支援ツール（MCP対応）

## サポート

- Issue報告: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues)
- 機能要望: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues/new)
- ドキュメント: [INSTALLATION.md](INSTALLATION.md)
