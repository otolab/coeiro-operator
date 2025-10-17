# COEIRO Operator

COEIROINKと連携する音声オペレータシステム

> **Note**: このプロジェクトは生成AIエージェントによる開発の実験として行われています。

## 概要

COEIRO OperatorはCOEIROINKの音声合成を活用し、端末セッションに音声キャラクターを固定できるツールです。CLIとMCPサーバーの両方で動作し、長文テキストの音声化にも対応しています。

### 主な機能

- **端末キャラクター固定**: 各ターミナルセッションに特定のキャラクターを割り当て
- **CLI/MCPサーバー**: コマンドラインとClaude Code MCPの両方で利用可能
- **長文音声合成**: COEIROINKサーバーへの長文テキスト分割送信に対応
- **ターミナル背景画像**: iTerm2でキャラクター立ち絵を背景表示（macOS）

### その他の実装機能

- **音声リサンプリング**: 24kHz→48kHz高品質アップサンプリング
- **並行チャンク生成**: 複数音声チャンクの同時生成でレイテンシ削減
- **ユーザー辞書**: 固有名詞の読み方登録（永続化対応）
- **セッション管理**: 複数端末でのオペレータ排他制御

## 動作環境

### 基本要件
- Node.js 18以上
- COEIROINK本体（[公式サイト](https://coeiroink.com/)）

### ターミナル背景画像機能（オプション）
- macOS + iTerm2
- Python 3.12以上
- [uv](https://github.com/astral-sh/uv)（Pythonパッケージマネージャー）

## クイックスタート

### 1. インストール

#### CLIツール

```bash
# CLIツールのインストール
npm install -g @coeiro-operator/cli
```

#### MCPサーバー（Claude Code用）

```bash
# MCPサーバーのインストール
npm install -g @coeiro-operator/mcp

# MCPサーバー登録（グローバルインストール後）
claude mcp add coeiro-operator

# または、npxで直接実行する場合は手動設定
# claude_desktop_config.jsonに追加

# AI Agent用の設定（Claude Code利用時）
# 音声対話が必要な場合、prompts/recipes/operator-mode.mdを
# AI Agentに読み込ませてください
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

これで準備完了です。Claude Codeでオペレータ音声機能を利用できます。

## 基本的な使い方

### コマンドライン

#### say-coeiroink - 音声合成コマンド

```bash
# 基本構文
say-coeiroink [options] "テキスト"

# オプション一覧
-v voice                     音声ID指定（?で一覧表示）
-r rate                      話速設定（WPM）
-o outfile                   出力ファイル指定（WAV形式）
-f file                      ファイル入力（-で標準入力）
--style style                音声スタイル指定（例: のーまる、セクシー）
--chunk-mode mode            テキスト分割モード（punctuation|none|small|medium|large）
--buffer-size size           バッファサイズ（256-4096+）
-h                           ヘルプ表示

# 使用例
say-coeiroink "こんにちは"                                    # 基本使用
say-coeiroink -v "?"                                        # 音声一覧表示
say-coeiroink -r 150 "ゆっくり話します"                        # 話速調整
say-coeiroink -o output.wav "保存テスト"                       # ファイル出力
say-coeiroink --style "セクシー" "別のスタイルで話します"        # スタイル指定
say-coeiroink --chunk-mode none "長文を分割せずに読み上げ"      # 分割モード指定
say-coeiroink --buffer-size 256 "低レイテンシ再生"            # バッファサイズ指定
```

#### operator-manager - オペレータ管理コマンド

オペレータ管理システムは、端末セッションごとに音声キャラクターを割り当てる仕組みです。各端末（ターミナルウィンドウ、Claude Codeの接続など）に1つのオペレータが固定され、その端末での全ての音声出力に使用されます。

- **セッション単位の管理**: 各端末のTERM_SESSION_IDで識別し、端末ごとに独立したオペレータを割り当て
- **排他制御**: 1つのオペレータは同時に1つの端末でのみ使用可能
- **スタイル保持**: 割り当て時のスタイル指定がセッション期間中（最大4時間）保持
- **自動解放**: デフォルト4時間で未使用のアサインは自動解放

```bash
# 基本構文
operator-manager <command> [options]

# コマンド一覧
assign [オペレータID] [--style=スタイル名]   オペレータ割り当て（IDなしでランダム）
release                                    オペレータ解放
status                                     状況確認
available                                  利用可能一覧
clear                                      全オペレータ状況クリア

# 使用例
operator-manager assign                              # ランダム割り当て
operator-manager assign tsukuyomi                   # 指定割り当て
operator-manager assign --style=happy               # スタイル指定ランダム割り当て
operator-manager assign tsukuyomi --style=ura       # 指定割り当て+スタイル
operator-manager status                              # 状況確認
operator-manager available                           # 利用可能一覧
operator-manager release                             # オペレータ解放
operator-manager clear                               # 全クリア
```

### Claude Code MCPツール

- `operator_assign` - オペレータ割り当て・キャラクター選択
- `operator_release` - オペレータ解放
- `operator_status` - 状況確認・利用可能オペレータ表示
- `operator_styles` - キャラクタースタイル一覧表示
- `say` - 音声出力（ストリーミング再生・並行生成対応）
- `parallel_generation_control` - 並行生成設定の動的制御
- `dictionary_register` - ユーザー辞書に単語を登録（永続化対応）

## 設定・カスタマイズ

### 設定ファイル

```
~/.coeiro-operator/
└── config.json                # 統一設定ファイル（全設定を一元管理）

/tmp/
└── coeiroink-operators-<hostname>.json  # セッション状態管理（一時保存、最大4時間）
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

### ターミナル背景画像設定（iTerm2）

config.jsonに以下を追加：

```json
{
  "terminal": {
    "background": {
      "enabled": true,
      "backgroundImages": {
        // キャラクターIDごとの背景画像パス（オプション）
        "tsukuyomi": "/path/to/tsukuyomi-bg.png"
      },
      "operatorImage": {
        "display": "api",      // "api": COEIROINKから取得, "file": ファイル指定, "none": 非表示
        "opacity": 0.3,        // 透明度（0.0-1.0）
        "filePath": "/path/to/operator.png"  // display: "file"の場合のパス
      }
    }
  }
}
```

注意：オペレータ画像は右下に15%のサイズで表示されます（現在固定値）。

### 詳細設定ガイド

- **[docs/user-guide/configuration-guide.md](docs/user-guide/configuration-guide.md)** - 設定・カスタマイズ完全ガイド
- **[docs/user-guide/CHARACTERS.md](docs/user-guide/CHARACTERS.md)** - オペレータキャラクター詳細

## オペレータキャラクター

利用可能なキャラクターはCOEIROINK環境にインストールされた音声ライブラリに依存します。
キャラクター一覧と詳細は [docs/user-guide/CHARACTERS.md](docs/user-guide/CHARACTERS.md) を参照してください。

## 技術詳細

### 音声処理

- **リサンプリング**: 24kHz→48kHz（node-libsamplerate使用）
- **フィルタリング**: ローパスフィルター（24kHz カットオフ）
- **並行生成**: 複数チャンクの同時音声合成
- **ストリーミング**: 生成済みチャンクから順次再生

### 主要ライブラリ

- **speaker**: クロスプラットフォーム音声出力
- **node-libsamplerate**: 高品質リサンプリング
- **dsp.js**: デジタル信号処理・フィルタリング
- **echogarden**: ノイズリダクション（オプション）

## ドキュメント

### ドキュメント一覧
- **[docs/README.md](docs/README.md)** - ドキュメント完全インデックス（用途別・カテゴリ別ガイド）

### 音声・オーディオ
- **[docs/features/audio-streaming-guide.md](docs/features/audio-streaming-guide.md)** - 音声ストリーミング機能ガイド
- **[docs/architecture/audio-system.md](docs/architecture/audio-system.md)** - 音声システム詳細仕様
- **[docs/features/parallel-generation-system.md](docs/features/parallel-generation-system.md)** - 並行チャンク生成システム

### 開発・運用
- **[docs/development/development-tips.md](docs/development/development-tips.md)** - 開発テクニック・Tips集
- **[docs/mcp-debug/mcp-debug-guide.md](docs/mcp-debug/mcp-debug-guide.md)** - MCPデバッグ環境ガイド

### リファレンス
- **[docs/user-guide/configuration-guide.md](docs/user-guide/configuration-guide.md)** - 設定・カスタマイズガイド
- **[docs/architecture/voice-provider-system.md](docs/architecture/voice-provider-system.md)** - VoiceProviderシステム

### プロジェクト情報
- **[CHANGELOG.md](CHANGELOG.md)** - 変更履歴・リリースノート
- **[docs/development/testing-guide.md](docs/development/testing-guide.md)** - テスト環境ガイド

## 開発者向け情報

開発に参加される方は、以下のドキュメントを参照してください：

- **[docs/development/development-tips.md](docs/development/development-tips.md)** - 開発環境構築・テクニック・Tips集
- **[docs/development/testing-guide.md](docs/development/testing-guide.md)** - テスト環境とmcp-debug統合
- **[docs/development/test-quality-guidelines.md](docs/development/test-quality-guidelines.md)** - テスト品質の基本原則

### クイック開発セットアップ

```bash
# 基本要件: Node.js 18以上 + COEIROINK + pnpm + ビルドツール
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
pnpm install

# 重要: speakerモジュールのビルド許可が必要
# pnpmのセキュリティ機能により、初回インストール時は手動許可が必要です
pnpm approve-builds
# → speakerを選択してビルドを許可

# ビルド実行
pnpm build
```

**注意事項：**
- **音声出力（speaker）モジュール**: pnpmのセキュリティ機能により、ネイティブモジュールのビルドには明示的な許可が必要です
- **CI環境**: `NODE_ENV=test`でテストモード動作（モック使用）するため、speakerビルド不要
- **本番環境**: speakerモジュールは必須。インストールできない場合は明確なエラーが表示されます

詳細な事前要件・開発環境構築は **[docs/development/development-tips.md](docs/development/development-tips.md)** を参照。

## ドキュメント構造

本プロジェクトのドキュメントは、対象読者別に整理されています：

- **一般ユーザー向け**: このREADME.mdから開始
- **開発者向け詳細**: [docs/README.md](docs/README.md) - 技術ドキュメント完全インデックス
- **AI Agent向け**: [AGENTS.md](AGENTS.md) - Claude Code等のAI向けクイックリファレンス
  - 詳細プロンプト: [prompts/README.md](prompts/README.md)

各README.mdファイルが、それぞれの対象に応じた情報へのインデックスとして機能します。

## ライセンス

MIT License

## 関連プロジェクト

- **[COEIROINK](https://coeiroink.com/)** - 音声合成エンジン本体
- **[Claude Code](https://claude.ai/code)** - AI開発支援ツール（MCP対応）

