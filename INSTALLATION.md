# COEIRO Operator 詳細設定ガイド

COEIRO Operatorの詳細な設定とカスタマイズ方法について説明します。

基本的なインストール手順については [README.md](README.md) を参照してください。

## 音声フォントについて

### デフォルト利用可能音声

COEIROINKは**つくよみちゃんのみがデフォルト**で利用可能です。その他のキャラクターは個別にダウンロードが必要です。

### 利用可能音声の確認

```bash
# ダウンロード済みキャラクターの確認
curl -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName' | sort

# ダウンロード可能なキャラクターの確認
curl -X GET "http://localhost:50032/v1/downloadable_speakers" | jq -r '.[].speakerName' | sort
```

### 音声フォントのダウンロード

COEIROINKアプリケーションから追加の音声フォントをダウンロードできます：

- アンジーさん
- アルマちゃん  
- ディアちゃん
- KANA
- 金苗
- リリンちゃん
- MANA
- AI声優-朱花

## 設定ファイル

### 設定ファイルの場所

COEIRO Operatorは以下の場所で設定ファイルを検索します：

1. 作業ディレクトリ内の `.coeiroink/` フォルダ
2. ホームディレクトリ内の `~/.coeiro-operator/` フォルダ

### 基本設定（任意）

COEIROINK接続設定 `coeiroink-config.json`：

```json
{
  "host": "localhost",
  "port": "50032"
}
```

### オペレータ設定の作成

#### 自動音声ID取得による設定作成

```bash
# つくよみちゃんの音声ID取得
TSUKUYOMI_ID=$(curl -s -X GET "http://localhost:50032/v1/speakers" | jq -r '.[] | select(.speakerName == "つくよみちゃん") | .speakerUuid')

# 設定ファイル作成
mkdir -p ~/.coeiro-operator
cat > ~/.coeiro-operator/operator-config.json << EOF
{
  "characters": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "$TSUKUYOMI_ID",
      "enabled": true,
      "default_style": "normal",
      "style_selection": "default",
      "personality": "冷静で丁寧、報告は簡潔で正確",
      "speaking_style": "敬語、落ち着いた口調",
      "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
      "farewell": "本日の作業、お疲れさまでした。",
      "available_styles": {
        "normal": {
          "name": "れいせい",
          "style_id": 0,
          "enabled": true,
          "personality": "落ち着いた知的な性格",
          "speaking_style": "丁寧で上品な敬語"
        }
      }
    }
  }
}
EOF
```

## 設定ファイル仕様

### キャラクター設定の詳細

利用可能なオペレータの詳細については **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** を参照してください。

### 設定更新

キャラクター設定の更新方法については **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** を参照してください。

## 環境確認コマンド

### 利用可能音声の詳細確認

```bash
# 音声一覧取得
curl -X GET "http://localhost:50032/v1/speakers" > available-voices.json

# 音声名・IDの確認
jq '.[] | {name: .speakerName, uuid: .speakerUuid, styles: [.styles[].styleName]}' available-voices.json

# 特定キャラクターの音声ID取得例
echo "つくよみちゃんの音声ID:"
jq '.[] | select(.speakerName == "つくよみちゃん") | .speakerUuid' available-voices.json
```

### 設定ファイルの確認

```bash
# 設定ディレクトリの確認
ls -la ~/.coeiro-operator/
ls -la ./.coeiroink/

# 設定ファイル内容の確認
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "設定ファイルが存在しません"

# 音声ID整合性確認
jq -r '.characters | to_entries[] | "\(.key): \(.value.name) (\(.value.voice_id))"' ~/.coeiro-operator/operator-config.json
```

## トラブルシューティング

### COEIROINK接続エラー
1. COEIROINKが起動していることを確認
2. ポート50032が利用可能であることを確認
3. 設定ファイルのhost/port設定を確認

### 音声出力されない
1. COEIROINKのスピーカー設定を確認
2. システムの音量設定を確認
3. 音声ファイルの保存場所の権限を確認

### 設定ファイルの場所
- `~/.coeiro-operator/coeiroink-config.json` - 音声合成設定
- `~/.coeiro-operator/operator-config.json` - オペレータ定義
- `~/.coeiro-operator/active-operators.json` - 利用状況管理（自動生成）
- `/tmp/coeiroink-mcp-session-*/session-operator-*.json` - セッション情報（自動生成）