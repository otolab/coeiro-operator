
# COEIRO Operator

COEIROINK音声合成システムのMCPサーバーとオペレータ管理システム

## 概要

COEIRO OperatorはCOEIROINKと連携して動作する音声オペレータシステムです。Claude Codeでの作業時に、複数のキャラクターによる音声通知とコミュニケーションを提供します。

### 主な機能

- **音声オペレータシステム**: 9種類のキャラクターによる音声通知
- **非同期音声合成**: 低レイテンシストリーミング対応
- **MCPサーバー**: Claude Desktopとの統合
- **セッション管理**: 複数セッション間でのオペレータ重複防止
- **コマンドライン互換**: macOS sayコマンド互換インターフェース

## クイックスタート

### 1. インストール

```bash
npm install -g @otolab/coeiro-operator
```

### 2. COEIROINK起動確認

```bash
curl -X GET "http://localhost:50032/speakers"
```

### 3. 動作テスト

```bash
# 音声出力テスト
say-coeiroink "音声テストです"

# オペレータ管理テスト
operator-manager assign
operator-manager status
```

### 4. Claude Desktop設定

`claude_desktop_config.json`にMCPサーバーを追加：

```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": []
    }
  }
}
```

## 使用方法

### Claude Codeでの使用

```
# 挨拶でオペレータ自動アサイン
こんにちは

# 作業完了での自動解放
ありがとう
```

### コマンドライン使用

```bash
# 音声合成
say-coeiroink "こんにちは"
say-coeiroink -r 150 "ゆっくり話します"

# オペレータ管理
operator-manager assign      # ランダム割り当て
operator-manager status      # 現在のステータス
operator-manager release     # オペレータ解放
```

## ドキュメント

- **[INSTALLATION.md](INSTALLATION.md)** - 詳細なインストールガイド
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - システム仕様書
- **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** - オペレータキャラクター詳細
- **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** - キャラクター設定の更新方法

## 技術仕様

### 動作環境

- **Node.js**: 18以上
- **COEIROINK**: localhost:50032で動作
- **OS**: macOS（音声再生にafplayを使用）

### MCPツール

- `operator_assign` - オペレータ割り当て
- `operator_release` - オペレータ解放  
- `operator_status` - 状況確認
- `operator_available` - 利用可能一覧
- `say` - 音声出力（非同期キュー処理）

## ライセンス

ISC

## 開発・貢献

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

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
