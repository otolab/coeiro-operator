# キャラクター設定更新ガイド

COEIRO Operatorのキャラクター設定を最新のCOEIROINK環境に合わせて更新する手順です。

## 概要

このガイドでは、localhost:50032で動作するCOEIROINKサーバーから最新の音声ID情報を取得し、オペレータ設定を更新する方法を説明します。

## 前提条件

- COEIROINKが`http://localhost:50032`で稼働していること
- `curl`コマンドまたは`jq`コマンドが利用可能であること
- ユーザーのホームディレクトリに`~/.coeiro-operator/`フォルダが存在すること

## 手順

### 1. COEIROINK接続確認

まず、COEIROINKサーバーが正常に動作していることを確認します：

```bash
curl -X GET "http://localhost:50032/"
```

正常に動作している場合、以下のようなレスポンスが返されます：
```json
{"status": "ok"}
```

### 2. 利用可能な音声一覧の取得

利用可能なスピーカー（音声）の一覧を取得します：

```bash
curl -X GET "http://localhost:50032/v1/speakers" | jq
```

### 3. 音声ID情報の抽出

取得したデータから必要な情報を抽出します：

```bash
# 現在ダウンロード済みの音声一覧
curl -s "http://localhost:50032/v1/speakers" | jq '.[] | {speakerName, speakerUuid, styles: [.styles[] | {styleName, styleId}]}'

# ダウンロード可能な音声一覧
curl -s "http://localhost:50032/v1/downloadable_speakers" | jq '.[] | {speakerName, speakerUuid}'

# 基本的な音声ID一覧（簡略版）
curl -s "http://localhost:50032/v1/speakers" | jq '.[] | {name: .speakerName, uuid: .speakerUuid, styles: .styles[].styleName}'

# スタイルID付き詳細情報
curl -s "http://localhost:50032/v1/speakers" | jq '.[] | "\(.speakerName):", (.styles[] | "  \(.styleName): Style ID \(.styleId)")'
```

### 4. 設定ファイルの更新

#### A. 自動更新スクリプト

以下のスクリプトを使用して自動的に設定を更新できます：

```bash
#!/bin/bash
# update-characters.sh

CONFIG_DIR="$HOME/.coeiro-operator"
SPEAKERS_URL="http://localhost:50032/v1/speakers"
OPERATOR_CONFIG="$CONFIG_DIR/operator-config.json"

# COEIROINKサーバー接続確認
if ! curl -s "$SPEAKERS_URL" > /dev/null; then
    echo "エラー: COEIROINKサーバーに接続できません"
    exit 1
fi

# スピーカー情報を取得
SPEAKERS_DATA=$(curl -s "$SPEAKERS_URL")

echo "利用可能な音声:"
echo "$SPEAKERS_DATA" | jq -r '.[] | "\(.speakerName) (\(.speakerUuid))"'

echo ""
echo "音声IDとスタイル詳細:"
echo "$SPEAKERS_DATA" | jq -r '.[] | "\(.speakerName):", (.styles[] | "  \(.styleName): \(.styleId) (\(.speakerUuid))")'
```

#### B. 手動更新

1. **現在の設定確認**：
   ```bash
   cat ~/.coeiro-operator/operator-config.json
   ```

2. **新しい音声IDに更新**：
   
   取得した音声ID情報を基に、`~/.coeiro-operator/operator-config.json`を編集します。

   例（つくよみちゃんの音声IDを更新）：
   ```json
   {
     "operators": {
       "tsukuyomi": {
         "name": "つくよみちゃん",
         "voice_id": "新しい音声ID",
         "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
         "farewell": "本日の作業、お疲れさまでした。"
       }
     }
   }
   ```

### 5. 設定の検証

更新後、設定が正しく反映されているか確認します：

```bash
# オペレータ一覧確認
operator-manager available

# 音声テスト
operator-manager assign tsukuyomi
say-coeiroink "設定更新のテストです"
operator-manager release
```

## API仕様詳細

### スピーカー一覧取得API

**エンドポイント**: `GET /v1/speakers`

**レスポンス例**:
```json
[
  {
    "speakerName": "つくよみちゃん",
    "speakerUuid": "3c37646f-3881-5374-2a83-149267990abc",
    "styles": [
      {
        "styleName": "のーまる",
        "styleId": 0,
        "base64Icon": "..."
      }
    ],
    "version": "0.0.1",
    "base64Portrait": "..."
  }
]
```

### その他の有用なAPI

- **ダウンロード済み音声一覧**: `GET /v1/speakers`
- **ダウンロード可能音声一覧**: `GET /v1/downloadable_speakers`
- **エンジン情報**: `GET /v1/engine_info`
- **サンプル音声**: `GET /v1/sample_voice?speakerUuid={uuid}&styleId={id}`
- **音声合成**: `POST /v1/synthesis`
- **API仕様書**: `GET /docs` (Swagger UI)
- **OpenAPI仕様**: `GET /openapi.json`

### キャラクター詳細情報の取得

COEIROINKの公式キャラクター情報は以下のサイトから取得できます：

- **公式キャラクター**: https://coeiroink.com/character/image-character/
- **個別キャラクターページ**: https://coeiroink.com/character/{character-name}
- **利用規約・設定例**: 各キャラクターページに詳細記載

例：
- つくよみちゃん: https://coeiroink.com/character/tsukuyomi-chan
- MANA: https://coeiroink.com/character/mana
- ナコ: https://coeiroink.com/character/image-character/nako

## トラブルシューティング

### COEIROINKに接続できない場合

1. **サーバー起動確認**：
   ```bash
   curl -X GET "http://localhost:50032/"
   ```

2. **ポート確認**：
   ```bash
   netstat -an | grep 50032
   ```

3. **設定ファイル確認**：
   ```bash
   cat ~/.coeiro-operator/coeiroink-config.json
   ```

### 音声が出力されない場合

1. **音声ID確認**：
   最新の音声IDが正しく設定されているか確認

2. **音声合成テスト**：
   ```bash
   curl -X POST "http://localhost:50032/v1/synthesis" \
     -H "Content-Type: application/json" \
     -d '{"speakerUuid":"音声ID","styleId":0,"text":"テスト","speedScale":1.0}'
   ```

### 設定が反映されない場合

1. **設定ファイル形式確認**：
   ```bash
   cat ~/.coeiro-operator/operator-config.json | jq
   ```

2. **権限確認**：
   ```bash
   ls -la ~/.coeiro-operator/
   ```

## 注意事項

- 音声IDは、COEIROINKのバージョン更新やキャラクター追加時に変更される可能性があります
- 定期的な設定確認・更新を推奨します
- 設定変更後は、動作確認を必ず行ってください

## 関連ファイル

- **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** - キャラクター詳細情報
- **[INSTALLATION.md](INSTALLATION.md)** - インストールガイド
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - システム仕様

---
**作成日**: 2025年8月5日  
**更新頻度**: COEIROINK更新時、または音声設定変更時  
**関連コマンド**: `curl`, `jq`, `operator-manager`, `say-coeiroink`