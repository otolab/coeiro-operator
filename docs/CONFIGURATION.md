# COEIRO Operator 設定ファイル仕様

COEIRO Operatorの設定ファイルシステムの詳細仕様と利用方法について説明します。

## 設定ファイルシステム概要

### 設定ファイルの配置場所と優先順位

COEIRO Operatorは以下の優先順位で設定ファイルを検索します：

1. **ホームディレクトリ設定** (最優先): `~/.coeiro-operator/`
2. **作業ディレクトリ内設定** (フォールバック): `.coeiroink/`
3. **一時ディレクトリ** (最終手段): `/tmp/coeiroink-mcp-shared/`

### 主要設定ファイル一覧

| ファイル名 | 目的 | 必須/任意 | 生成タイミング |
|------------|------|-----------|----------------|
| `operator-config.json` | オペレータ定義・挨拶パターン | 必須 | 手動作成 |
| `coeiroink-config.json` | COEIROINK接続設定 | 任意 | 自動生成 |
| `active-operators.json` | 利用状況管理 | - | 自動生成 |
| `session-operator-*.json` | セッション情報 | - | 自動生成 |

## 手動設定ファイル

### operator-config.json（オペレータ定義ファイル）

**目的**: 利用可能なオペレータキャラクターの定義と、挨拶・お別れの検知パターンを設定

#### 必須設定項目

```json
{
  "operators": {
    "キャラクターID": {
      "name": "表示名",
      "voice_id": "COEIROINKの音声UUID",
      "personality": "性格の説明（任意）",
      "speaking_style": "話し方の特徴（任意）", 
      "greeting": "挨拶メッセージ",
      "farewell": "お別れメッセージ"
    }
  }
}
```

#### 設定項目詳細

| 項目 | 必須 | 型 | 説明 |
|------|------|----|----|
| `operators` | ✓ | Object | オペレータキャラクターの定義 |
| `operators[id].name` | ✓ | String | ユーザに表示される名前 |
| `operators[id].voice_id` | ✓ | String | COEIROINKの音声UUID |
| `operators[id].personality` | - | String | 性格の説明（ドキュメント用） |
| `operators[id].speaking_style` | - | String | 話し方の特徴（ドキュメント用） |
| `operators[id].greeting` | ✓ | String | アサイン時の挨拶メッセージ |
| `operators[id].farewell` | ✓ | String | 解放時のお別れメッセージ |

#### 基本設定例

```json
{
  "operators": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
      "personality": "冷静で丁寧、報告は簡潔で正確",
      "speaking_style": "敬語、落ち着いた口調",
      "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
      "farewell": "本日の作業、お疲れさまでした。"
    }
  }
}
```

#### 複数キャラクター設定例

```json
{
  "operators": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
      "personality": "冷静で丁寧、報告は簡潔で正確",
      "speaking_style": "敬語、落ち着いた口調",
      "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
      "farewell": "本日の作業、お疲れさまでした。"
    },
    "angie": {
      "name": "アンジーさん",
      "voice_id": "cc213e6d-d847-45b5-a1df-415744c890f2",
      "personality": "フレンドリーで親しみやすい、明るく積極的",
      "speaking_style": "カジュアル、親近感のある口調",
      "greeting": "今日もよろしくお願いします！アンジーです。",
      "farewell": "今日もお疲れ様でした！"
    },
    "kana": {
      "name": "KANA",
      "voice_id": "297a5b91-f88a-6951-5841-f1e648b2e594",
      "personality": "クールでスマート、論理的",
      "speaking_style": "簡潔で的確、無駄のない表現",
      "greeting": "KANA、オペレータ業務を開始します。",
      "farewell": "業務終了。お疲れさまでした。"
    }
  }
}
```

### coeiroink-config.json（COEIROINK接続設定）

**目的**: COEIROINKサーバーへの接続設定と音声合成パラメータの設定

#### 設定項目

```json
{
  "host": "localhost",
  "port": "50032", 
  "voice_id": "現在選択中の音声ID（自動更新）",
  "rate": 200,
  "voice_presets": {
    "プリセット名": {
      "voice_id": "音声UUID",
      "style_id": "スタイルID",
      "description": "説明"
    }
  }
}
```

#### 設定項目詳細

| 項目 | 必須 | 型 | デフォルト | 説明 |
|------|------|----|-----------|----|
| `host` | - | String | "localhost" | COEIROINKサーバーのホスト |
| `port` | - | String | "50032" | COEIROINKサーバーのポート |
| `voice_id` | - | String | null | 現在選択中の音声ID（自動更新） |
| `rate` | - | Number | 200 | 音声合成速度（WPM） |
| `voice_presets` | - | Object | {} | 音声プリセット定義 |

#### デフォルト設定

```json
{
  "host": "localhost",
  "port": "50032",
  "rate": 200
}
```

## 自動生成ファイル

以下のファイルはシステムが自動的に作成・管理します。手動で編集する必要はありません。

### active-operators.json（利用状況管理）

**目的**: 複数セッション間でのオペレータ重複を防ぐため、現在利用中のオペレータを記録

**構造**:
```json
{
  "active": {
    "オペレータID": "セッションID",
    "tsukuyomi": "12345"
  },
  "last_updated": "2025-08-05T10:30:00.000Z"
}
```

### session-operator-*.json（セッション情報）

**目的**: 各セッションで使用中のオペレータ情報を保存

**ファイル名**: `session-operator-{セッションID}.json`

**構造**:
```json
{
  "operator_id": "tsukuyomi",
  "session_id": "12345",
  "reserved_at": "2025-08-05T10:30:00.000Z"
}
```

## 設定ファイルの作成と管理

### 基本設定ファイルの作成

```bash
# 設定ディレクトリの作成
mkdir -p ~/.coeiro-operator

# 最小構成のoperator-config.jsonを作成（新構造）
cat > ~/.coeiro-operator/operator-config.json << 'EOF'
{
  "characters": {},
  "operators": {}
}
EOF
```

### キャラクター設定の追加手順

1. **利用可能キャラクターの確認**
2. **音声IDの取得**  
3. **設定ファイルへの追加**

#### 音声IDの取得方法

```bash
# 利用可能音声の一覧取得
curl -X GET "http://localhost:50032/v1/speakers" > available-voices.json

# 音声名・IDの確認
jq '.[] | {name: .speakerName, uuid: .speakerUuid, styles: [.styles[].styleName]}' available-voices.json

# 特定キャラクターの音声ID取得例
TSUKUYOMI_ID=$(jq -r '.[] | select(.speakerName == "つくよみちゃん") | .speakerUuid' available-voices.json)
echo "つくよみちゃんの音声ID: $TSUKUYOMI_ID"
```

#### コマンドでの設定追加

```bash
# jqコマンドでキャラクター設定を追加（新構造）
jq --arg id "$TSUKUYOMI_ID" '
.characters.tsukuyomi = {
  "name": "つくよみちゃん",
  "voice_id": $id,
  "default_style": "normal",
  "style_selection": "default",
  "personality": "冷静で丁寧、報告は簡潔で正確、知的で落ち着いた性格",
  "speaking_style": "敬語、落ち着いた口調、丁寧語を基調とした上品な話し方",
  "background": "秘書やアシスタント的な役割、信頼性が高く効率を重視",
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
} | 
.operators.tsukuyomi = {
  "character_id": "tsukuyomi",
  "enabled": true
}' ~/.coeiro-operator/operator-config.json > temp.json && mv temp.json ~/.coeiro-operator/operator-config.json
```

### 設定ファイルのカスタマイズ

#### 設定確認

```bash
# 設定ファイルの確認
jq '.' .coeiroink/operator-config.json
```

#### メッセージの変更

```bash
# 特定キャラクターの挨拶メッセージ変更例
jq '.operators.tsukuyomi.greeting = "おはようございます。つくよみちゃんです。"' \
  .coeiroink/operator-config.json > temp.json && mv temp.json .coeiroink/operator-config.json
```


## 音声ID管理

### 音声IDの確認

```bash
# 1. 現在の設定確認
echo "=== 現在の設定キャラクター ==="
jq -r '.characters | to_entries[] | "\(.key): \(.value.name) (\(.value.voice_id))"' ~/.coeiro-operator/operator-config.json

echo "=== 現在の設定オペレータ ==="
jq -r '.operators | to_entries[] | "\(.key): \(.value.character_id) (enabled: \(.value.enabled))"' ~/.coeiro-operator/operator-config.json

# 2. COEIROINKの実際の音声ID確認
echo "=== COEIROINK利用可能音声 ==="
jq -r '.[] | "\(.speakerName): \(.speakerUuid)"' available-voices.json

# 3. 音声IDの整合性確認
echo "=== 音声ID整合性確認 ==="
jq -r '.characters | to_entries[] | .key + ": " + .value.voice_id' ~/.coeiro-operator/operator-config.json | while read line; do
  char_id=$(echo "$line" | cut -d: -f1)
  voice_id=$(echo "$line" | cut -d: -f2 | tr -d ' ')
  char_name=$(jq -r --arg id "$voice_id" '.[] | select(.speakerUuid == $id) | .speakerName' available-voices.json)
  if [[ "$char_name" != "null" && "$char_name" != "" ]]; then
    echo "✅ $char_id: $char_name ($voice_id)"
  else
    echo "❌ $char_id: 音声ID不一致または利用不可 ($voice_id)"
  fi
done
```

### 音声IDの自動更新

```bash
# 名前ベースでの音声ID自動更新スクリプト
cat > update-voice-ids.sh << 'EOF'
#!/bin/bash

CONFIG_FILE="~/.coeiro-operator/operator-config.json"

echo "=== 音声ID自動更新 ==="

# 設定ファイル内の各キャラクターについて音声IDを更新
jq -r '.characters | keys[]' "$CONFIG_FILE" | while read char_id; do
  char_name=$(jq -r --arg id "$char_id" '.characters[$id].name' "$CONFIG_FILE")
  
  # COEIROINKから該当キャラクターの音声IDを取得
  new_voice_id=$(jq -r --arg name "$char_name" '.[] | select(.speakerName == $name) | .speakerUuid' available-voices.json 2>/dev/null)
  
  if [[ "$new_voice_id" != "null" && "$new_voice_id" != "" ]]; then
    echo "✅ $char_id ($char_name): 音声ID更新 -> $new_voice_id"
    # 音声IDを更新
    jq --arg id "$char_id" --arg voice_id "$new_voice_id" \
      '.characters[$id].voice_id = $voice_id' "$CONFIG_FILE" > temp.json && mv temp.json "$CONFIG_FILE"
  else
    echo "⚠️  $char_id ($char_name): 対応する音声が見つかりません"
  fi
done

echo "音声ID更新完了"
EOF

chmod +x update-voice-ids.sh
./update-voice-ids.sh
```

### 手動での音声ID更新

```bash
# 特定キャラクターの音声ID手動更新例
NEW_VOICE_ID="新しい音声ID"
jq --arg id "$NEW_VOICE_ID" '.characters.tsukuyomi.voice_id = $id' \
  ~/.coeiro-operator/operator-config.json > temp.json && mv temp.json ~/.coeiro-operator/operator-config.json
```

## 自動設定スクリプト

環境に応じて自動的に設定ファイルを生成したい場合の参考スクリプト：

```bash
# 自動設定スクリプトの例（add-characters.sh）
#!/bin/bash
CONFIG_FILE="~/.coeiro-operator/operator-config.json"

# 利用可能音声の取得
curl -s -X GET "http://localhost:50032/v1/speakers" > available-voices.json

# 各キャラクターをチェックして追加
for char in "つくよみちゃん" "アンジーさん" "KANA" "ディアちゃん"; do
  VOICE_ID=$(jq -r --arg name "$char" '.[] | select(.speakerName == $name) | .speakerUuid' available-voices.json 2>/dev/null)
  if [[ "$VOICE_ID" != "null" && "$VOICE_ID" != "" ]]; then
    echo "✅ $char: 利用可能 (ID: $VOICE_ID)"
    # ここで設定ファイルに追加する処理を記述
  else
    echo "❌ $char: 利用不可（ダウンロードが必要）"
  fi
done

rm available-voices.json
```

### スタイル選択方法

新しい設定構造では、キャラクターごとにスタイル選択方法を指定できます：

- **default**: `default_style`で指定されたスタイルを常に使用
- **random**: 有効化されたスタイルからランダムに選択
- **specified**: 特定の条件に基づいてスタイルを選択（現在はdefaultと同じ動作）

```json
{
  "style_selection": "random",
  "default_style": "normal",
  "available_styles": {
    "normal": { "enabled": true, ... },
    "sleepy": { "enabled": true, ... }
  }
}
```

## 注意事項

### 設定時の注意点

- **voice_id**: 実際のCOEIROINK環境で確認した正確なUUIDを使用
- **キャラクターID**: システム内部で使用される一意の識別子（英数字推奨）
- **オペレータID**: 通常はキャラクターIDと同じにするが、必須ではない
- **スタイルID**: 内部的なスタイル識別子（style_idは数値、スタイルIDは文字列）
- **ダウンロード状況**: 設定に含めるのはダウンロード済みキャラクターのみ
- **JSON形式**: 正しいJSON形式を維持（構文エラーによる設定読み込み失敗を防ぐ）

### 新旧設定の互換性について

**重要**: 新しいキャラクター:スタイル構造は従来の設定ファイルと互換性がありません。

- 従来の `operators` 直下のキャラクター設定は動作しません
- 新しい構造では `characters` セクションでキャラクター詳細を定義
- `operators` セクションはキャラクターへの参照のみを保持
- MCP統合では詳細なキャラクター情報が提供されます

### キャラクター選択の指針

**重要**: COEIROINKは**つくよみちゃんのみがデフォルト**で利用可能です。その他のキャラクターは追加ダウンロードが必要です。

**用途別おすすめ**（ダウンロード済みの場合）:
- **ビジネス・フォーマル**: つくよみちゃん、AI声優-朱花
- **親しみやすい・カジュアル**: アンジーさん、ディアちゃん
- **元気・活発**: リリンちゃん、アンジーさん
- **クール・効率重視**: KANA、AI声優-朱花

## 関連ファイル

- **キャラクター詳細情報**: [../prompts/CHARACTERS.md](../prompts/CHARACTERS.md)
- **音声ID更新手順**: [../prompts/UPDATE_CHARACTER_SETTINGS.md](../prompts/UPDATE_CHARACTER_SETTINGS.md)
- **インストールガイド**: [../INSTALLATION.md](../INSTALLATION.md)

---
**作成日**: 2025年8月5日  
**更新頻度**: 設定仕様変更時・新機能追加時  
**対象バージョン**: COEIRO Operator v1.0+