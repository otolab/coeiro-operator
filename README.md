
# COEIRO Operator

COEIROINK音声合成システムのMCPサーバーとオペレータ管理システム

## 機能

### MCPサーバー機能
- **say**: 日本語音声の非同期合成・再生（低レイテンシストリーミング対応）
- **operator_assign**: オペレータの割り当て（ランダムまたは指定）
- **operator_release**: オペレータの解放
- **operator_status**: 現在のオペレータ状況確認
- **operator_available**: 利用可能なオペレータ一覧

### 音声合成機能
- 低レイテンシ並列合成（バッファサイズ: 3）
- 音切れ防止オーバーラップ処理
- リアルタイム音声出力（バッファ: 100ms）
- macOS sayコマンド互換インターフェース

### オペレータ管理
- 複数Claudeセッション間でのオペレータ重複防止
- 作業ディレクトリベースの設定管理
- セッション自動識別（ITERM_SESSION_ID対応）
- 音声プリセット自動切り替え

## インストール

```bash
npm install -g @otolab/coeiro-operator
```

## 設定

作業ディレクトリに`.coeiroink/`フォルダが作成され、以下のファイルで設定管理されます：

- `coeiroink-config.json`: COEIROINK接続設定・音声プリセット
- `operator-config.json`: オペレータ設定
- `active-operators.json`: セッション管理ファイル

## コマンドライン使用法

### 音声合成
```bash
# 基本的な使用
say-coeiroink "こんにちは"

# 音声指定
say-coeiroink -v "音声ID" "テキスト"

# 話速指定
say-coeiroink -r 150 "ゆっくり話します"

# ファイル出力
say-coeiroink -o output.wav "ファイルに保存"

# ストリーミングモード
say-coeiroink -s "長いテキストをストリーミング再生"
```

### オペレータ管理
```bash
# オペレータをランダム割り当て
operator-manager assign

# 指定オペレータに切り替え
operator-manager assign tsukuyomi

# 現在のオペレータ確認
operator-manager status

# 利用可能なオペレータ一覧
operator-manager available

# オペレータ解放
operator-manager release
```

## MCP設定

Claude Desktop設定（`claude_desktop_config.json`）:

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

## 要件

- Node.js 18以上
- COEIROINK サーバー（http://localhost:50032）
- macOS（音声再生にafplayを使用）

## ライセンス

ISC

## 開発

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```
