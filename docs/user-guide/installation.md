# インストール・セットアップガイド

COEIRO Operatorの詳細なインストール手順とセットアップ方法を説明します。

## システム要件

### 必要な環境

- **Node.js**: 18以上（推奨: LTS版）
- **COEIROINK**: 音声合成エンジン
- **オーディオシステム**: システムレベル音声出力対応

### 対応プラットフォーム

- **Windows**: Windows 10/11 (64bit)
- **macOS**: macOS 10.15 Catalina以上
- **Linux**: Ubuntu 18.04以上 / その他主要ディストリビューション

### ネイティブ依存関係

一部のライブラリはネイティブコンパイルが必要です。各OS対応の開発ツールが必要になる場合があります。

## インストール方法

### 1. NPMからのインストール（推奨）

```bash
# MCPサーバーのインストール
npm install -g @coeiro-operator/mcp

# CLIツールのインストール
npm install -g @coeiro-operator/cli

# インストール確認
coeiro-operator --version
operator-manager --version
say-coeiroink --version
```

### 2. ソースからのインストール（開発用）

```bash
# リポジトリクローン
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator

# pnpm 9.0以上が必要
npm install -g pnpm

# 依存関係インストール
pnpm install

# ビルド
pnpm build

# グローバルリンク
pnpm link --global

# インストール確認
which coeiro-operator
```


## COEIROINK設定

### COEIROINKのインストール

1. [公式サイト](https://coeiroink.com/)からダウンロード
2. インストール・起動
3. デフォルトポート（50032）で起動確認

### 接続テスト

```bash
# COEIROINK起動確認
curl -X GET "http://localhost:50032/v1/speakers"

# 期待する応答: JSON形式のスピーカー一覧
```

### カスタムポート設定

```bash
# 環境変数で設定
export COEIROINK_HOST=localhost
export COEIROINK_PORT=50032

# または設定ファイル
~/.coeiro-operator/config.json
```

## MCP統合設定

### Claude Codeでの登録

```bash
# MCPサーバー追加
claude mcp add coeiro-operator

# 登録確認
claude mcp list
```

### MCP設定ファイル

~/.claude/mcp_settings.json:
```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": [],
      "env": {
        "COEIROINK_HOST": "localhost",
        "COEIROINK_PORT": "50032"
      }
    }
  }
}
```

## 設定

設定ファイルは `~/.coeiro-operator/config.json` に配置します。手動作成は不要で、必要な項目のみオーバーライドできます。

### よくある設定

**COEIROINKが別ポートで動いている場合**:
```json
{
  "connection": {
    "host": "localhost",
    "port": "50033"
  }
}
```

**キャラクターの挨拶をカスタマイズ**:
```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "おはようございます。つくよみちゃんです。"
    }
  }
}
```

**不要なMCPツールを無効化（トークン削減）**:
```json
{
  "tools": {
    "playback": false,
    "dictionary": false,
    "debug": false
  }
}
```

詳細な設定項目については [設定・カスタマイズガイド](configuration-guide.md) を参照してください。

## 初期セットアップ

### 1. 基本動作確認

```bash
# COEIROINKサーバー確認
say-coeiroink "接続テスト"

# 音声出力テスト
say-coeiroink "インストールテストです"

# オペレータシステムテスト
operator-manager assign
operator-manager status
```

### 2. 音声品質調整

```bash
# 基本動作確認
say-coeiroink "音声テスト"

# 話速設定テスト
say-coeiroink -r 150 "ゆっくり音声テストです"
```



## アップデート

### NPMアップデート

```bash
# 最新版確認
npm outdated -g @coeiro-operator/mcp @coeiro-operator/cli

# アップデート
npm update -g @coeiro-operator/mcp @coeiro-operator/cli

# バージョン確認
coeiro-operator --version
```


## 音声設定・パフォーマンス最適化

音声品質やレイテンシの調整については [設定・カスタマイズガイド](configuration-guide.md) を参照してください。