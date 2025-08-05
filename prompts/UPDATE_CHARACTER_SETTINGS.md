# キャラクター設定更新ガイド

COEIRO Operator v1.0以降での新しい動的設定管理システムについて説明します。

## 重要な変更点 🚀

**COEIRO Operator v1.0以降では設定更新が自動化されています！**

- **手動での音声ID設定は不要**: COEIROINKサーバーから自動検出
- **キャラクター情報は内蔵**: 13キャラクターの詳細情報を内蔵
- **設定ファイルは部分カスタマイズのみ**: 必要に応じて個別設定をオーバーライド

## 動的設定システムの動作

システムは以下の手順で自動的に設定を構築します：

1. **内蔵デフォルト設定** - 13キャラクターの基本情報
2. **動的音声検出** - COEIROINKサーバーから音声フォント情報を自動取得
3. **ユーザー設定マージ** - `~/.coeiro-operator/operator-config.json`で部分カスタマイズ

## 前提条件

- COEIROINKが`http://localhost:50032`で稼働していること
- 利用したいキャラクターの音声がCOEIROINKにダウンロード済みであること

## 手順

### 1. 動作確認

COEIRO Operatorの動的設定が正常に動作していることを確認します：

```bash
# 利用可能なキャラクター確認（自動検出結果）
operator-manager available

# COEIROINK接続確認
curl -X GET "http://localhost:50032/v1/speakers" | jq length
```

正常に動作している場合、利用可能なキャラクター一覧が表示されます。

### 2. 利用可能キャラクターの確認

現在利用可能なキャラクターを確認：

```bash
# 動的検出されたキャラクター一覧
operator-manager available

# COEIROINKの生データ確認（参考）
curl -s "http://localhost:50032/v1/speakers" | jq '.[] | {name: .speakerName, uuid: .speakerUuid, styles: [.styles[].styleName]}'

# ダウンロード可能な追加キャラクター
curl -s "http://localhost:50032/v1/downloadable_speakers" | jq '.[] | .speakerName'
```

### 3. キャラクター追加手順

新しいキャラクターを利用可能にするには：

1. **COEIROINKアプリを起動**
2. **ライブラリ → キャラクターダウンロード**
3. **利用したいキャラクターをダウンロード**
4. **COEIRO Operatorが自動的に検出** - 再起動不要

### 4. カスタマイズ設定（任意）

**注意**: v1.0以降では音声IDの手動設定は不要です。必要に応じて挨拶メッセージなどをカスタマイズできます。

#### A. 設定の確認

```bash
# 現在の設定状況確認
ls -la ~/.coeiro-operator/

# ユーザー設定の内容確認（存在する場合）
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "ユーザー設定なし（内蔵設定を使用）"
```

#### B. 部分カスタマイズ例

挨拶メッセージの変更：
```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "おはようございます。つくよみちゃんです。"
    }
  }
}
```

キャラクターの無効化：
```json
{
  "characters": {
    "angie": {
      "disabled": true
    }
  }
}
```

#### C. 設定ファイルの作成

```bash
# 設定ディレクトリ作成
mkdir -p ~/.coeiro-operator

# カスタマイズ設定ファイル作成
cat > ~/.coeiro-operator/operator-config.json << 'EOF'
{
  "characters": {
    "tsukuyomi": {
      "greeting": "今日もよろしくお願いします。つくよみちゃんです。"
    }
  }
}
EOF
```

### 5. 設定の検証

設定が正しく反映されているか確認します：

```bash
# 利用可能なキャラクター確認
operator-manager available

# オペレータアサインテスト（詳細情報を確認）
operator-manager assign

# 音声テスト
say-coeiroink "設定のテストです"

# オペレータ解放
operator-manager release
```

## COEIROINK API参考情報

### 主要なAPI（参考用）

- **ダウンロード済み音声一覧**: `GET /v1/speakers`
- **ダウンロード可能音声一覧**: `GET /v1/downloadable_speakers`
- **API仕様書**: `GET /docs` (Swagger UI)

**注意**: これらのAPIは参考情報です。COEIRO Operatorでは自動的に処理されます。

### キャラクター詳細情報

公式キャラクター情報：

- **公式サイト**: https://coeiroink.com/character/
- **内蔵キャラクター情報**: [prompts/CHARACTERS.md](../prompts/CHARACTERS.md)

利用可能な13キャラクターの詳細情報は内蔵されており、追加設定は不要です。

## トラブルシューティング

### 利用可能キャラクターが少ない場合

1. **COEIROINKでキャラクターダウンロード**：
   - COEIROINKアプリを起動
   - ライブラリ → キャラクターダウンロード
   - 必要なキャラクターをダウンロード

2. **ダウンロード状況確認**：
   ```bash
   curl -s "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName'
   ```

### COEIROINKに接続できない場合

1. **サーバー起動確認**：
   ```bash
   curl -X GET "http://localhost:50032/v1/speakers"
   ```

2. **ポート確認**：
   ```bash
   netstat -an | grep 50032
   ```

### 設定が反映されない場合

1. **JSON形式確認**：
   ```bash
   cat ~/.coeiro-operator/operator-config.json | jq
   ```

2. **設定ディレクトリ権限確認**：
   ```bash
   ls -la ~/.coeiro-operator/
   ```

## 重要な変更点

- **v1.0以降では音声IDの手動設定は不要**：自動検出されます
- **キャラクター情報は内蔵**：追加設定不要で13キャラクター利用可能
- **設定ファイルは部分カスタマイズのみ**：必要な項目のみオーバーライド

## 関連ファイル

- **[prompts/CHARACTERS.md](CHARACTERS.md)** - 内蔵キャラクター詳細情報
- **[../INSTALLATION.md](../INSTALLATION.md)** - インストール・セットアップガイド
- **[../docs/CONFIGURATION.md](../docs/CONFIGURATION.md)** - 設定ファイル仕様詳細
- **[OPERATOR_SYSTEM.md](OPERATOR_SYSTEM.md)** - システム仕様

---
**作成日**: 2025年8月5日  
**最終更新**: v1.0対応（動的設定管理システム）  
**対象バージョン**: COEIRO Operator v1.0+