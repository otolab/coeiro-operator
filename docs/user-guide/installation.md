# インストール・セットアップガイド

COEIRO Operatorの詳細なインストール手順とセットアップ方法を説明します。

## システム要件

### 必要な環境

- **Node.js**: 18.0.0以上（推奨: LTS版）
- **pnpm**: 9.0以上（推奨パッケージマネージャー）
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
# グローバルインストール
npm install -g coeiro-operator

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

# pnpmインストール（未インストールの場合）
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
claude mcp add -s user coeiro-operator

# 登録確認
claude mcp list

# テスト実行
claude mcp test coeiro-operator
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

## 設定ファイル

### デフォルト設定場所

```
~/.coeiro-operator/
└── config.json               # 統一設定ファイル
```

### 基本設定例

**config.json**:
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "rate": 200
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "bufferSize": 1024
  },
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶"
    }
  }
}
```

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
npm outdated -g coeiro-operator

# アップデート
npm update -g coeiro-operator

# バージョン確認
coeiro-operator --version
```


## パフォーマンス最適化

### 音声設定の詳細

#### latencyMode（レイテンシモード）

音声処理の品質とレイテンシのバランスを調整する、3つのプリセットが利用可能：

- **`ultra-low`**: 最低レイテンシ（リアルタイム用途）
  - バッファサイズ: 64-32
  - 分割設定: 小さめ（20-30文字）
  - エフェクト: 最小限
  
- **`balanced`**: バランス重視（デフォルト）
  - バッファサイズ: 256-128
  - 分割設定: 標準（30-50文字）
  - エフェクト: 適度

- **`quality`**: 高品質重視
  - バッファサイズ: 512-256
  - 分割設定: 大きめ（40-70文字）
  - エフェクト: フル

#### splitMode（分割モード）

テキストの分割方法を指定：

- **`punctuation`**: 句読点ベース分割（デフォルト、推奨）
- **`none`**: 分割なし（一括処理）
- **`auto`**: 自動調整（50文字）
- **`small`**: 短い分割（20-30文字）
- **`medium`**: 中程度の分割（30-50文字）
- **`large`**: 長い分割（50-100文字）

**推奨**: `punctuation`モードは日本語テキストを句点（。）と読点（、）で自然に分割し、音切れのない自然な音声を実現します。

### システム設定

1. **音声レイテンシ削減**:
   - `latencyMode: "ultra-low"`の使用
   - `splitMode: "none"`で分割処理を無効化

2. **メモリ使用量最適化**:
   - 小さなバッファサイズ設定
   - `splitMode`の調整

3. **音質とのバランス**:
   - 用途に応じた`latencyMode`選択
   - 必要に応じた個別設定の上書き

### 設定例

高パフォーマンス設定（低レイテンシ重視）:
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "rate": 200
  },
  "audio": {
    "latencyMode": "ultra-low",
    "splitMode": "none",
    "bufferSize": 512
  }
}
```

高品質設定（音質重視）:
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "rate": 200
  },
  "audio": {
    "latencyMode": "quality",
    "splitMode": "punctuation",
    "bufferSize": 2048
  }
}
```