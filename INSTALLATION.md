# COEIRO Operator 詳細設定ガイド

COEIRO Operatorの詳細な設定とカスタマイズ方法について説明します。

基本的なインストール手順については [@README.md](README.md) を参照してください。

## 重要な変更点 🚀

- COEIROINKサーバーから音声フォントを自動検出
- 内蔵のデフォルト設定で即座に利用可能
- 必要に応じてユーザー設定でカスタマイズ可能

## 初期セットアップ

### 1. COEIROINKの起動確認

```bash
# COEIROINKの動作確認
curl -X GET "http://localhost:50032/v1/speakers"
```

### 2. 動作テスト

```bash
# 音声出力テスト
say-coeiroink "セットアップ完了です"

# オペレータ管理テスト
operator-manager assign
```

**これだけで利用開始できます！** 設定ファイルは自動的に内蔵設定から構築されます。

## 音声フォントのダウンロード

### デフォルト利用可能音声

- **つくよみちゃん**: デフォルトで利用可能
- **その他12キャラクター**: COEIROINKアプリでダウンロード後、自動的に利用可能

### 利用可能音声の確認

```bash
# 現在利用可能なキャラクター
curl -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName'

# ダウンロード可能なキャラクター
curl -X GET "http://localhost:50032/v1/downloadable_speakers" | jq -r '.[].speakerName'
```

### キャラクター追加手順

1. **COEIROINKアプリを起動**
2. **ライブラリ → キャラクターダウンロード**
3. **利用したいキャラクターを選択してダウンロード**
4. **自動的にCOEIRO Operatorで利用可能**

## カスタマイズ（任意）

### 基本設定のカスタマイズ

COEIROINK接続設定 `~/.coeiro-operator/coeiroink-config.json`：

```json
{
  "host": "localhost",
  "port": "50032"
}
```

### キャラクター設定のカスタマイズ

`~/.coeiro-operator/operator-config.json` でキャラクター設定を部分的にオーバーライド可能：

```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶メッセージ",
      "personality": "カスタマイズされた性格設定"
    },
    "angie": {
      "disabled": true
    }
  }
}
```

### 設定のカスタマイズ項目

- `greeting`: 挨拶メッセージ
- `farewell`: お別れメッセージ  
- `personality`: 性格設定（説明用）
- `speaking_style`: 話し方（説明用）
- `disabled`: キャラクターの無効化

## 動作確認・トラブルシューティング

### 利用可能キャラクターの確認

```bash
# 現在利用可能なキャラクター確認
operator-manager available

# 動的設定の詳細確認（デバッグ用）
node debug-config.js
```

### 設定ファイルの確認

```bash
# 設定ディレクトリの確認
ls -la ~/.coeiro-operator/

# ユーザー設定ファイル内容の確認（存在する場合）
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "ユーザー設定ファイルなし（内蔵設定を使用）"
```

## トラブルシューティング

### COEIROINK接続エラー
1. COEIROINKが起動していることを確認
2. ポート50032が利用可能であることを確認
3. 必要に応じて `~/.coeiro-operator/coeiroink-config.json` でhost/port設定

### 音声出力されない
1. COEIROINKのスピーカー設定を確認
2. システムの音量設定を確認
3. 音声ファイルの保存場所の権限を確認

### 利用可能キャラクターが少ない
1. COEIROINKアプリでキャラクターダウンロード
2. COEIRO Operatorを再起動（動的検出のため）

### 関連ドキュメント

- **[docs/CHARACTERS.md](docs/CHARACTERS.md)** - 全キャラクター詳細
- **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** - 設定更新手順

### 自動生成ファイル
- `~/.coeiro-operator/active-operators.json` - 利用状況管理
- `/tmp/coeiroink-mcp-session-*/` - セッション情報