# @coeiro-operator/cli

COEIROINKと連携するCLIツール集

## インストール

```bash
npm install -g @coeiro-operator/cli
```

## コマンド

### say-coeiroink

COEIROINK音声合成コマンド（macOS sayコマンド互換）

```bash
# 基本使用
say-coeiroink "こんにちは"

# 音声一覧表示
say-coeiroink -v "?"

# 話速調整（WPM）
say-coeiroink -r 150 "ゆっくり話します"

# ファイル出力
say-coeiroink -o output.wav "保存テスト"

# スタイル指定
say-coeiroink --style "セクシー" "別のスタイルで話します"
```

### operator-manager

ターミナルセッションのオペレータ管理

#### 基本操作

```bash
# オペレータ割り当て（ランダム）
operator-manager assign

# 特定キャラクターを指定
operator-manager assign tsukuyomi

# スタイルを指定して割り当て
operator-manager assign mana --style=ねむねむ

# 現在の状態確認
operator-manager status

# オペレータ解放
operator-manager release

# 利用可能なオペレータ一覧
operator-manager available
```

#### 新規Speakerの登録方法

COEIROINKに追加された新しいSpeakerをcoeiro-operatorで使用するための手順：

##### 1. 未登録Speakerの確認

```bash
# 未計測のSpeaker/Styleを一覧表示
operator-manager list-unmeasured

# JSON形式で出力（スクリプト処理用）
operator-manager list-unmeasured --json
```

出力例：
```
=== キャラクター登録状況 ===

【未登録キャラクター】
  SpeakerName (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    スタイル数: 1
      - スタイル名 (ID: xxxxxxxxxx)

【未計測スタイルがあるキャラクター】
  既存Speaker (characterId: existing-character)
    未計測スタイル: 1個
      - 未計測スタイル (ID: xxx)
```

##### 2. キャラクターの登録

```bash
# キャラクターIDとSpeaker名を指定して登録
operator-manager add-character <characterId> <speakerName>

# UUID指定も可能
operator-manager add-character <characterId> <speakerUuid>
```

この時点で、最小限の設定がconfig.jsonに追加されます。

##### 3. キャラクター設定の編集

`~/.coeiro-operator/config.json`を編集して、キャラクターの性格や挨拶を設定：

```json
{
  "characters": {
    "tsukuyomi": {
      "speakerId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "name": "つくよみちゃん",
      "personality": "冷静で丁寧、知的で落ち着いた司会進行",
      "speakingStyle": "安定感のある上品な話し方",
      "greeting": "こんにちは、つくよみです",
      "farewell": "またお会いしましょう",
      "defaultStyleId": 0,
      "styles": {}
    }
  }
}
```

##### 4. 話速の測定

```bash
# dry-runモードで測定結果を確認（設定は更新しない）
operator-manager measure <characterId> --dry-run

# 実際に測定して設定を更新
operator-manager measure <characterId>

# 特定のスタイルのみ測定（必要に応じて）
operator-manager measure tsukuyomi --style=れいせい
```

測定仕様：
- 4つのテスト文章（19〜24モーラ）で測定
- speedScale=1.0での標準話速を測定
- 複数文章の平均値を最終測定値とする

##### 5. 動作確認

```bash
# MCPサーバーを使用している場合は再接続

# オペレータとして使用可能か確認
operator-manager available

# 実際に割り当てて確認
operator-manager assign <characterId>

# say-coeiroinkで音声合成
say-coeiroink "音声テストです"
```

#### トラブルシューティング

- **Speakerが表示されない**: COEIROINKが起動しているか確認
- **測定に失敗する**: COEIROINKのAPIが応答しているか確認
- **MCPで認識されない**: MCPサーバーを再接続してください

### dictionary-register

COEIROINK用語辞書登録

```bash
# 単語登録
dictionary-register "COEIROINK" "コエイロインク" 0 7

# パラメータ
# - 単語（表記）
# - 読み方（カタカナ）
# - アクセント位置
# - モーラ数
```

## 動作要件

- Node.js 18以上
- COEIROINK本体が起動済み（http://localhost:50032）

## 詳細

完全なドキュメントは [GitHub](https://github.com/otolab/coeiro-operator) を参照してください。

## ライセンス

MIT