# カスタムキャラクター追加ガイド

COEIROINKに追加インストールしたキャラクターボイスをCoeiro-operatorに取り込む方法を説明します。

## 前提条件

- COEIROINKに新しいキャラクターボイスがインストール済み
- COEIROINKサーバーが起動中（`http://localhost:50032`）
- Coeiro-operatorがインストール済み

## 追加方法の概要

COEIROINKの追加キャラクターをCoeiro-operatorで使用するには、以下の手順が必要です：

1. **COEIROINK APIから情報取得**: キャラクターのUUIDとスタイル情報を取得
2. **話速測定**: キャラクターの話す速度を測定
3. **設定追加**: `~/.coeiro-operator/config.json`に設定を追加
4. **動作確認**: operator-managerで確認

**推奨**: `add-character`コマンドを使うと、手順1〜3を自動化できます。詳しくは「add-characterコマンドを使用した追加（推奨）」を参照してください。

## add-characterコマンドを使用した追加（推奨）

`add-character`コマンドを使うと、キャラクター追加の大部分を自動化できます。

### ステップ1: 利用可能なキャラクター一覧を表示

```bash
add-character
```

出力例:
```
Available COEIROINK Characters:

  ✓ つくよみちゃん (3c37646f-3881-5374-2a83-149267990abc) - 登録済み
      - れいせい (ID: 0)
      - おしとやか (ID: 5)

    ナースロボ＿タイプＴ (9bf2ab50-c756-11ec-9374-0242ac1c0002)
      - 通常 (ID: 1403759395)
      - 内緒話 (ID: 1403759396)

Usage: add-character <speakerId>
```

### ステップ2: キャラクターを追加

追加したいキャラクターのspeakerIdをコピーして実行:

```bash
add-character 9bf2ab50-c756-11ec-9374-0242ac1c0002
```

コマンドが以下を自動的に実行します:
1. COEIROINK APIからキャラクター情報を取得
2. 各スタイルの話速を測定（4つのテスト文章で測定）
3. `~/.coeiro-operator/config.json`に設定を追加

### ステップ3: キャラクター性の設定

`~/.coeiro-operator/config.json`を開いて、追加されたキャラクターの設定を編集します:

```json
{
  "characters": {
    "nurserobo": {
      "speakerId": "9bf2ab50-c756-11ec-9374-0242ac1c0002",
      "name": "ナースロボ＿タイプＴ",
      "personality": "優しく献身的、看護師らしい親切さと思いやり",
      "speakingStyle": "ロボットらしい淡々としたクールさと、柔らかな優しさが同居した口調",
      "greeting": "こんにちは。ナースロボ＿タイプＴです。体調はいかがですか？",
      "farewell": "お疲れ様でした。ゆっくり休んでくださいね。",
      "defaultStyleId": 1403759395,
      "styles": {
        "1403759395": {
          "styleName": "通常",
          "morasPerSecond": 7.03
        }
      }
    }
  }
}
```

### ステップ4: 動作確認

```bash
# 利用可能なキャラクター一覧に表示されるか確認
operator-manager available

# キャラクターを割り当て
operator-manager assign nurserobo

# 音声出力テスト
say-coeiroink "こんにちは。テストです。"
```

---

## 手動での追加手順

### ステップ1: キャラクター情報の取得

COEIROINKサーバーから追加したキャラクターの情報を取得します：

```bash
# 全キャラクター一覧を表示
curl -s -X GET "http://localhost:50032/v1/speakers" | \
  jq 'map({speakerName, speakerUuid, styles: [.styles[] | {styleName, styleId}]})'

# 特定キャラクターのみ表示（例：ナースロボ）
curl -s -X GET "http://localhost:50032/v1/speakers" | \
  jq '.[] | select(.speakerName | contains("ナースロボ")) |
    {speakerName, speakerUuid, styles: [.styles[] | {styleName, styleId}]}'
```

**取得する情報：**
- `speakerUuid`: キャラクターの一意識別子
- `speakerName`: キャラクター名
- `styles`: 利用可能なスタイル一覧（styleIdとstyleName）

### ステップ2: 話速測定

キャラクターの話す速度（モーラ/秒）を測定します：

```bash
# プロジェクトディレクトリで実行
npx tsx packages/cli/scripts/measure-speech-rate.ts
```

測定結果から対象キャラクターの値をメモします：

```
ナースロボ＿タイプＴ - 通常: 7.03 モーラ/秒
ナースロボ＿タイプＴ - 内緒話: 6.63 モーラ/秒
ナースロボ＿タイプＴ - 淡々: 6.99 モーラ/秒
...
```

### ステップ3: 設定ファイルへの追加

`~/.coeiro-operator/config.json`を編集して、`characters`セクションに設定を追加します：

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "audio": { ... },
  "terminal": { ... },
  "characters": {
    "nurserobo": {
      "speakerId": "9bf2ab50-c756-11ec-9374-0242ac1c0002",
      "name": "ナースロボ＿タイプＴ",
      "personality": "優しく献身的、看護師らしい親切さと思いやり",
      "speakingStyle": "ロボットらしい淡々としたクールさと、柔らかな優しさが同居した口調",
      "greeting": "こんにちは。ナースロボ＿タイプＴです。体調はいかがですか？",
      "farewell": "お疲れ様でした。ゆっくり休んでくださいね。",
      "defaultStyleId": 1403759395,
      "styles": {
        "1403759395": {
          "styleName": "通常",
          "morasPerSecond": 7.03
        },
        "1403759396": {
          "styleName": "内緒話",
          "morasPerSecond": 6.63
        }
      }
    }
  }
}
```

**設定項目の説明：**

| フィールド | 必須 | 説明 | 例 |
|-----------|------|------|-----|
| `speakerId` | ✅ | COEIROINK APIのspeakerUuid | `"9bf2ab50-..."` |
| `name` | ✅ | キャラクター表示名 | `"ナースロボ＿タイプＴ"` |
| `personality` | ✅ | キャラクターの性格設定 | `"優しく献身的..."` |
| `speakingStyle` | ✅ | 話し方の特徴 | `"ロボットらしい..."` |
| `greeting` | ✅ | アサイン時の挨拶メッセージ | `"こんにちは..."` |
| `farewell` | ✅ | 解放時のお別れメッセージ | `"お疲れ様でした..."` |
| `defaultStyleId` | ✅ | デフォルトのスタイルID（数値） | `1403759395` |
| `styles` | ✅ | スタイル別の話速設定 | 以下参照 |

**stylesオブジェクトの構造：**

```json
"styles": {
  "<styleId（数値）>": {
    "styleName": "スタイル名",
    "morasPerSecond": <話速（数値）>
  }
}
```

### ステップ4: 動作確認

設定を追加したら、以下のコマンドで動作確認します：

```bash
# 利用可能なキャラクター一覧に表示されるか確認
operator-manager available

# キャラクターを割り当て
operator-manager assign nurserobo

# 音声出力テスト
say-coeiroink "こんにちは。テストです。"
```

## characterIdの命名規則

characterIdは以下のルールに従って命名してください：

- **英小文字のみ**（a-z）
- **アンダースコアなし**
- **speakerNameから推測できる短縮形**

**例：**
- `つくよみちゃん` → `tsukuyomi`
- `ナースロボ＿タイプＴ` → `nurserobo`
- `AI声優-朱花` → `akane`

## トラブルシューティング

### キャラクターが表示されない

1. **COEIROINKサーバーの確認**:
   ```bash
   curl -s -X GET "http://localhost:50032/v1/speakers" | jq '.[].speakerName'
   ```

2. **speakerIdの確認**: config.jsonのspeakerIdとCOEIROINK APIのspeakerUuidが一致しているか確認

3. **JSON形式の確認**: config.jsonが正しいJSON形式になっているか確認
   ```bash
   cat ~/.coeiro-operator/config.json | jq .
   ```

4. **ビルドの実行**: プロジェクトをソースからビルドしている場合
   ```bash
   pnpm build
   ```

### 話速がおかしい

1. **再測定**: 話速測定を再実行して正しい値を確認
2. **スタイルIDの確認**: defaultStyleIdとstylesのキーが一致しているか確認
3. **morasPerSecondの型**: 数値型（クォートなし）で指定されているか確認

### 音声が出ない

1. **COEIROINKサーバーの起動確認**
2. **speakerIdの存在確認**: COEIROINK APIにそのspeakerIdが存在するか確認
3. **ログの確認**: エラーメッセージを確認

## add-characterコマンドについて

`add-character`コマンドは以下を自動化します：
- COEIROINK APIからの情報取得
- 話速の自動測定
- config.jsonへの追加
- characterIdの自動生成

キャラクターの性格や挨拶メッセージは、追加後に手動で設定する必要があります。これは、各キャラクターの個性を適切に表現するために、人間が判断すべき要素だからです。

## 関連ドキュメント

- **[UPDATE_CHARACTER_SETTINGS.md](UPDATE_CHARACTER_SETTINGS.md)** - 開発者向けビルトインキャラクター更新ガイド
- **[../docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)** - 内蔵キャラクター詳細
- **[../docs/user-guide/configuration-guide.md](../docs/user-guide/configuration-guide.md)** - 設定ガイド全般

---

**作成日**: 2025-10-31
**対象バージョン**: COEIRO Operator v1.3.3+
