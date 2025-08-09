# COEIRO Operator

COEIROINK音声合成システムのMCPサーバーとオペレータ管理システム

## 概要

COEIRO OperatorはCOEIROINKと連携して動作する音声オペレータシステムです。Claude Codeでの作業時に、複数のキャラクターによる音声通知とコミュニケーションを提供します。

### 主な機能

- **高品質音声処理**: 24kHz→48kHz リサンプリング + デジタルフィルタリング
- **音声オペレータシステム**: 13種類のキャラクターによる音声通知
- **クロスプラットフォーム対応**: Windows / macOS / Linux ネイティブ音声出力
- **MCPサーバー**: Claude Codeとの完全統合
- **非同期音声合成**: 低レイテンシストリーミング対応
- **動的設定管理**: COEIROINKサーバーから音声フォントを自動検出
- **セッション管理**: 複数セッション間でのオペレータ重複防止
- **MCPデバッグ環境**: 包括的なテスト・デバッグシステム

## インストール

### 事前要件

- **Node.js 18以上**
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **ビルドツール** - ネイティブモジュール構築用
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: build-essential + ALSA/PulseAudio開発ライブラリ

### インストール方法

```bash
# NPMからのインストール
npm install -g coeiro-operator

# ソースからのインストール（開発用）
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

### MCPサーバー登録

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

# MCPデバッグ環境テスト
./scripts/test-mcp-debug.sh
./test-coeiro-mcp-debug.sh
```

## 基本的な使用方法

### コマンドライン

```bash
# 音声合成
say-coeiroink "こんにちは"
say-coeiroink -r 150 "ゆっくり話します"

# 分割モード制御
say-coeiroink --split-mode none "長文を分割せずに読み上げ"
say-coeiroink --split-mode small "短いレスポンス"
say-coeiroink --buffer-size 2048 "高品質再生"

# オペレータ管理
operator-manager assign      # ランダム割り当て
operator-manager status      # 現在のステータス
operator-manager release     # オペレータ解放
```

### MCPツール

- `operator_assign` - オペレータ割り当て
- `operator_release` - オペレータ解放  
- `operator_status` - 状況確認
- `operator_available` - 利用可能一覧
- `say` - 音声出力（ストリーミング再生対応）

## 設定・カスタマイズ

詳細な設定方法については以下のドキュメントを参照してください：

- **[docs/configuration-guide.md](docs/configuration-guide.md)** - 設定・カスタマイズガイド
- **[docs/CHARACTERS.md](docs/CHARACTERS.md)** - オペレータキャラクター詳細

### 設定ファイルの場所

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
  }
}
```

## ドキュメント

### 技術仕様
- **[docs/audio-streaming-guide.md](docs/audio-streaming-guide.md)** - 音声ストリーミング機能ガイド
- **[docs/audio-system.md](docs/audio-system.md)** - 音声システム詳細仕様
- **[docs/api-reference.md](docs/api-reference.md)** - 完全APIリファレンス
- **[docs/mcp-debug-guide.md](docs/mcp-debug-guide.md)** - MCPデバッグ環境ガイド

### 開発者ガイド  
- **[docs/development-tips.md](docs/development-tips.md)** - 開発テクニック・Tips集
- **[docs/configuration-guide.md](docs/configuration-guide.md)** - 設定・カスタマイズガイド
- **[docs/troubleshooting.md](docs/troubleshooting.md)** - トラブルシューティング

### プロジェクト情報
- **[docs/changelog.md](docs/changelog.md)** - 変更履歴・リリースノート
- **[docs/CHARACTERS.md](docs/CHARACTERS.md)** - オペレータキャラクター詳細

## 技術構成

### 音声処理アーキテクチャ
```
COEIROINK API → WAV → PCM → リサンプリング → フィルタリング → Speaker出力
    (24kHz)                   (24→48kHz)      (ローパス24kHz)     (48kHz)
```

### 主要ライブラリ
- **speaker**: クロスプラットフォーム音声出力
- **node-libsamplerate**: 高品質リサンプリング
- **dsp.js**: デジタル信号処理・フィルタリング  

### プロジェクト構成

```
src/
├── cli/                    # CLIツール
│   ├── operator-manager.ts # オペレータ管理コマンド
│   └── say-coeiroink.ts    # 音声合成コマンド
├── core/                   # コア機能
│   ├── environment/        # 環境情報管理
│   │   └── voice-provider.ts  # 音声情報プロバイダ（統一API）
│   ├── operator/           # オペレータ管理
│   │   ├── index.ts        # オペレータ管理メイン
│   │   ├── config-manager.ts      # 設定管理
│   │   ├── operator-state-manager.ts  # 状態管理
│   │   ├── voice-selection-service.ts # 音声選択
│   │   ├── file-operation-manager.ts  # ファイル操作
│   │   └── character-defaults.ts      # キャラクター定義
│   └── say/                # 音声合成システム
│       ├── index.ts        # 音声合成メイン
│       ├── audio-synthesizer.ts   # COEIROINK API連携
│       ├── audio-player.ts        # 音声再生エンジン
│       ├── speech-queue.ts        # キューイング
│       ├── constants.ts           # 定数・デフォルト値
│       └── types.ts              # 型定義
├── mcp/                    # MCPサーバー
│   └── server.ts          # MCPサーバーメイン
├── mcp-debug/              # MCPデバッグ環境
│   ├── test/               # テストサーバー・統合テスト
│   ├── logger/             # 拡張ロガーシステム
│   ├── control/            # 制御コマンドハンドラー
│   └── output/             # 出力管理システム
└── utils/                  # ユーティリティ
    └── logger.ts          # 基本ログシステム
```

### 主要な設計原則

- **役割別グルーピング**: 機能ごとに明確に分離
- **統一的な環境情報収集**: `VoiceProvider`による一元管理
- **デフォルト値の集約**: `constants.ts`での統一管理
- **型安全性**: TypeScriptによる厳密な型チェック

## サポート

- Issue報告: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues)
- 機能要望: [GitHub Issues](https://github.com/otolab/coeiro-operator/issues/new)

## ライセンス

MIT License

## 関連プロジェクト

- **[COEIROINK](https://coeiroink.com/)** - 音声合成エンジン本体
- **[Claude Code](https://claude.ai/code)** - AI開発支援ツール（MCP対応）