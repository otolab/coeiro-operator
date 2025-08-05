
# COEIRO Operator

COEIROINK音声合成システムのMCPサーバーとオペレータ管理システム

## 概要

COEIRO OperatorはCOEIROINKと連携して動作する音声オペレータシステムです。Claude Codeでの作業時に、複数のキャラクターによる音声通知とコミュニケーションを提供します。

### 主な機能

- **音声オペレータシステム**: 9種類のキャラクターによる音声通知
- **非同期音声合成**: 低レイテンシストリーミング対応
- **MCPサーバー**: Claude Codeとの統合
- **セッション管理**: 複数セッション間でのオペレータ重複防止
- **コマンドライン互換**: macOS sayコマンド互換インターフェース

## インストール

### 事前要件

- **Node.js 18以上** (推奨: LTS版)
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **macOS** - 音声再生にafplayを使用

### NPMからのインストール

```bash
npm install -g @otolab/coeiro-operator
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
claude mcp add coeiro-operator coeiro-operator
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

### 3. Claude Codeでの使用

```
# 挨拶でオペレータ自動アサイン
こんにちは

# 作業完了での自動解放
ありがとう
```

## 基本的な使用方法

### コマンドライン

```bash
# 音声合成
say-coeiroink "こんにちは"
say-coeiroink -r 150 "ゆっくり話します"

# オペレータ管理
operator-manager assign      # ランダム割り当て
operator-manager status      # 現在のステータス
operator-manager release     # オペレータ解放
```

### Claude Codeでの使用

```
# 挨拶でオペレータ自動アサイン
こんにちは

# 作業完了での自動解放
ありがとう
```

## MCPツール

COEIRO Operatorは以下のMCPツールを提供します：

- `operator_assign` - オペレータ割り当て
- `operator_release` - オペレータ解放  
- `operator_status` - 状況確認
- `operator_available` - 利用可能一覧
- `say` - 音声出力（非同期キュー処理）

## ドキュメント

- **[INSTALLATION.md](INSTALLATION.md)** - 詳細設定・カスタマイズガイド
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - システム仕様書
- **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** - オペレータキャラクター詳細
- **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** - キャラクター設定の更新方法

## 開発

### ディレクトリ構造

```
coeiro-operator/
├── src/                     # ソースコード
│   ├── index.js            # MCPサーバーメイン
│   ├── operator/           # オペレータ管理
│   └── say/               # 音声合成
├── scripts/               # シェルスクリプト
├── prompts/              # プロンプト・仕様書
│   ├── OPERATOR_SYSTEM.md       # システム仕様
│   ├── CHARACTERS.md            # キャラクター詳細
│   └── UPDATE_CHARACTER_SETTINGS.md # 設定更新手順
└── INSTALLATION.md       # インストールガイド
```

### 貢献

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

## ライセンス

ISC
