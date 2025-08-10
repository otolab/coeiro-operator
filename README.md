# COEIRO Operator

🎤 COEIROINK音声合成システムの高機能MCPサーバー・オペレータシステム

## 概要

COEIRO OperatorはCOEIROINKと連携して動作する音声オペレータシステムです。Claude Codeでの作業時に、13種類のキャラクターによる高品質な音声通知とコミュニケーションを提供します。

### ✨ 主な機能

- 🎵 **高品質音声処理**: 24kHz→48kHz リサンプリング + デジタルフィルタリング
- 👥 **音声オペレータシステム**: 13種類のキャラクターによる音声通知
- 🖥️ **クロスプラットフォーム対応**: Windows / macOS / Linux ネイティブ音声出力
- 🔗 **MCPサーバー**: Claude Codeとの完全統合
- ⚡ **低レイテンシストリーミング**: 非同期音声合成・並行チャンク生成
- 🎛️ **動的設定管理**: COEIROINKサーバーから音声フォントを自動検出
- 🔄 **セッション管理**: 複数セッション間でのオペレータ重複防止
- 🛠️ **MCPデバッグ環境**: 包括的なテスト・デバッグシステム

## 🚀 クイックスタート

### 1. インストール

```bash
# NPMからのインストール
npm install -g coeiro-operator

# MCPサーバー登録（Claude Code）
claude mcp add coeiro-operator
```

### 2. COEIROINK準備

[COEIROINK](https://coeiroink.com/)をダウンロード・起動し、`localhost:50032`で動作していることを確認：

```bash
curl -X GET "http://localhost:50032/v1/speakers"
```

### 3. 動作確認

```bash
# 音声出力テスト
say-coeiroink "音声テストです"

# オペレータ管理テスト  
operator-manager assign
operator-manager status
```

🎉 これで準備完了！Claude Codeでオペレータ音声機能を利用できます。

## 💬 基本的な使い方

### コマンドライン

```bash
# シンプル音声合成
say-coeiroink "こんにちは"

# 話速調整
say-coeiroink -r 150 "ゆっくり話します"

# 分割モード制御
say-coeiroink --split-mode small "短いレスポンス"
say-coeiroink --buffer-size 2048 "高品質再生"

# オペレータ管理
operator-manager assign      # ランダム割り当て
operator-manager status      # 現在のステータス  
operator-manager release     # オペレータ解放
```

### Claude Code MCPツール

- `operator_assign` - オペレータ割り当て・キャラクター選択
- `operator_release` - オペレータ解放
- `operator_status` - 状況確認・利用可能オペレータ表示
- `say` - 音声出力（ストリーミング再生・並行生成対応）
- `parallel_generation_control` - 並行生成設定の動的制御

## ⚙️ 設定・カスタマイズ

### 設定ファイル

```
~/.coeiro-operator/
├── coeiroink-config.json      # COEIROINK・音声設定
├── operator-config.json       # オペレータ管理設定
└── active-operators.json      # 利用状況管理（自動生成）
```

### 基本設定例

```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶メッセージ"
    },
    "angie": {
      "disabled": true
    }
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "parallelGeneration": {
      "maxConcurrency": 2,
      "pauseUntilFirstComplete": true
    }
  }
}
```

### 詳細設定ガイド

- **[docs/configuration-guide.md](docs/configuration-guide.md)** - 設定・カスタマイズ完全ガイド
- **[docs/CHARACTERS.md](docs/CHARACTERS.md)** - オペレータキャラクター詳細

## 🎭 オペレータキャラクター

13種類の個性豊かなキャラクターが利用可能：

| キャラクター | 特徴 | 音声の傾向 |
|---|---|---|
| 🌙 つくよみちゃん | 落ち着いた司会進行 | 安定感のある声 |
| 👼 angelica | 元気で明るい | ハイトーンで活発 |
| 🎀 冥鳴ひまり | 可愛らしく親しみやすい | 甘い声質 |
| 🌸 四国めたん | 関西弁の愛されキャラ | 関西弁・親しみやすい |
| 📚 ずんだもん | 東北弁の賢いアシスタント | 東北弁・知的 |

詳細は [docs/CHARACTERS.md](docs/CHARACTERS.md) を参照。

## 🏗️ 技術アーキテクチャ

### 音声処理パイプライン

```
COEIROINK API → WAV → PCM → リサンプリング → フィルタリング → Speaker出力
    (24kHz)                   (24→48kHz)      (ローパス24kHz)     (48kHz)
```

### 並行チャンク生成システム

```
テキスト分割 → 並行音声合成 → ストリーミング再生
     ↓              ↓              ↓
  [チャンク1-5]   [同時生成]    [順次再生]
```

### 主要ライブラリ

- **speaker**: クロスプラットフォーム音声出力
- **node-libsamplerate**: 高品質リサンプリング  
- **dsp.js**: デジタル信号処理・フィルタリング
- **echogarden**: ノイズリダクション（オプション）

## 📚 ドキュメント

### 📖 ドキュメント一覧
- **[📚 docs/README.md](docs/README.md)** - **ドキュメント完全インデックス**（用途別・カテゴリ別ガイド）

### 🎵 音声・オーディオ
- **[docs/audio-streaming-guide.md](docs/audio-streaming-guide.md)** - 音声ストリーミング機能ガイド
- **[docs/audio-system.md](docs/audio-system.md)** - 音声システム詳細仕様
- **[docs/parallel-generation-system.md](docs/parallel-generation-system.md)** - 並行チャンク生成システム

### 🛠️ 開発・運用
- **[docs/development-tips.md](docs/development-tips.md)** - 開発テクニック・Tips集
- **[docs/mcp-debug-guide.md](docs/mcp-debug-guide.md)** - MCPデバッグ環境ガイド
- **[docs/troubleshooting.md](docs/troubleshooting.md)** - トラブルシューティング

### 📖 リファレンス
- **[docs/api-reference.md](docs/api-reference.md)** - 完全APIリファレンス
- **[docs/configuration-guide.md](docs/configuration-guide.md)** - 設定・カスタマイズガイド
- **[docs/voice-provider-system.md](docs/voice-provider-system.md)** - VoiceProviderシステム

### 📋 プロジェクト情報
- **[docs/changelog.md](docs/changelog.md)** - 変更履歴・リリースノート
- **[docs/testing-guide.md](docs/testing-guide.md)** - テスト環境ガイド

## 🔧 開発者向け情報

開発に参加される方は、以下のドキュメントを参照してください：

- **[docs/development-tips.md](docs/development-tips.md)** - 開発環境構築・テクニック・Tips集
- **[docs/testing-guide.md](docs/testing-guide.md)** - テスト環境とmcp-debug統合
- **[docs/test-quality-guidelines.md](docs/test-quality-guidelines.md)** - テスト品質の基本原則

### クイック開発セットアップ

```bash
# 基本要件: Node.js 18以上 + COEIROINK + ビルドツール
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install && npm run build
```

詳細な事前要件・開発環境構築は **[docs/development-tips.md](docs/development-tips.md)** を参照。

## 🆘 サポート・コミュニティ

- **Issue報告**: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues)
- **機能要望**: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues/new)
- **プルリクエスト**: 歓迎いたします！

## 📝 ライセンス

MIT License

## 🔗 関連プロジェクト

- **[COEIROINK](https://coeiroink.com/)** - 音声合成エンジン本体
- **[Claude Code](https://claude.ai/code)** - AI開発支援ツール（MCP対応）

---

🎤 **素晴らしい音声体験をお楽しみください！**