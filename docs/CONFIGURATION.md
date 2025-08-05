# COEIRO Operator 設定ファイル仕様

COEIRO Operatorの設定ファイルシステムの詳細仕様と利用方法について説明します。

## 重要な変更点 🚀

- **手動設定ファイル作成は不要**: 内蔵設定から自動構築
- **音声フォント自動検出**: COEIROINKサーバーから動的取得
- **設定の階層マージ**: 内蔵設定 + 動的検出 + ユーザー設定
- **部分カスタマイズ対応**: 必要な項目のみオーバーライド可能

## 設定ファイルシステム概要

### 設定の優先順位

1. **内蔵デフォルト設定** (基盤): 13キャラクターの内蔵設定
2. **動的音声検出** (自動): COEIROINKサーバーから音声情報取得
3. **ユーザー設定** (カスタマイズ): `~/.coeiro-operator/operator-config.json`

### 設定ファイルの配置場所

| 場所 | 目的 | 作成タイミング |
|------|------|----------------|
| `~/.coeiro-operator/` | ユーザー設定（カスタマイズ用） | 手動/任意 |
| `~/.coeiro-operator/active-operators.json` | 利用状況管理 | 自動生成 |
| `/tmp/coeiroink-mcp-session-*/` | セッション情報 | 自動生成 |

## ユーザー設定ファイル（カスタマイズ用）

### operator-config.json（部分オーバーライド設定）

**目的**: 内蔵設定の部分的なカスタマイズ（全項目の定義は不要）

#### 最小設定例（一部カスタマイズ）

```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶メッセージ"
    },
    "angie": {
      "disabled": true
    }
  }
}
```

#### 複数キャラクターのカスタマイズ例

```json
{
  "characters": {
    "tsukuyomi": {
      "personality": "カスタマイズされた性格設定",
      "speaking_style": "カスタマイズされた話し方",
      "greeting": "カスタマイズされた挨拶",
      "farewell": "カスタマイズされたお別れ"
    },
    "angie": {
      "greeting": "元気いっぱいで今日もよろしく！",
      "style_selection": "random"
    },
    "mana": {
      "disabled": true
    }
  }
}
```

#### 設定項目詳細

| 項目 | カスタマイズ可能 | 型 | 説明 |
|------|------|----|----|
| `characters` | ✓ | Object | キャラクター設定のオーバーライド |
| `characters[id].name` | ✓ | String | 表示名（通常は変更不要） |
| `characters[id].personality` | ✓ | String | 性格設定（MCP出力時に表示） |
| `characters[id].speaking_style` | ✓ | String | 話し方の特徴（MCP出力時に表示） |
| `characters[id].greeting` | ✓ | String | アサイン時の挨拶メッセージ |
| `characters[id].farewell` | ✓ | String | 解放時のお別れメッセージ |
| `characters[id].default_style` | ✓ | String | デフォルトスタイルID |
| `characters[id].style_selection` | ✓ | String | スタイル選択方法 (default/random) |
| `characters[id].disabled` | ✓ | Boolean | キャラクターの無効化フラグ |

**注意**: `voice_id`や`available_styles`は動的検出されるため設定不要です。

### 設定の動作確認

#### 現在の設定状況確認

```bash
# 利用可能なキャラクターの確認
operator-manager available

# 設定ファイルの存在確認
ls -la ~/.coeiro-operator/

# ユーザー設定の内容確認（存在する場合）
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "ユーザー設定なし（内蔵設定を使用）"
```

#### 設定の階層構造確認

システムは以下の順序で設定をマージします：

1. **内蔵デフォルト設定** - 13キャラクターの基本設定
2. **動的音声検出** - COEIROINKサーバーから取得
3. **ユーザー設定** - `~/.coeiro-operator/operator-config.json`

各段階で設定が重ね合わされ、最終的な設定が決定されます。

### coeiroink-config.json（COEIROINK接続設定）

**目的**: COEIROINKサーバーへの接続設定（通常は設定不要）

```json
{
  "host": "localhost",
  "port": "50032"
}
```

| 項目 | デフォルト | 説明 |
|------|-----------|----| 
| `host` | "localhost" | COEIROINKサーバーのホスト |
| `port` | "50032" | COEIROINKサーバーのポート |

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

## カスタマイズ設定の作成

### 設定ディレクトリの準備

```bash
# 設定ディレクトリの作成（必要に応じて）
mkdir -p ~/.coeiro-operator
```

### 基本的なカスタマイズ例

#### 挨拶メッセージの変更

```bash
# 設定ファイルを作成
cat > ~/.coeiro-operator/operator-config.json << 'EOF'
{
  "characters": {
    "tsukuyomi": {
      "greeting": "おはようございます。つくよみちゃんです。"
    }
  }
}
EOF
```

#### キャラクターの無効化

```bash
# 特定キャラクターを無効化
cat > ~/.coeiro-operator/operator-config.json << 'EOF'
{
  "characters": {
    "angie": {
      "disabled": true
    }
  }
}
EOF
```

### 設定の確認

```bash
# 現在利用可能なキャラクター確認
operator-manager available

# 設定ファイルの内容確認
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "ユーザー設定なし（内蔵設定を使用）"

# 現在利用可能な音声確認
curl -s -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName'
```

### スタイル選択のカスタマイズ

キャラクターごとにスタイル選択方法を設定可能：

```json
{
  "characters": {
    "tsukuyomi": {
      "style_selection": "random",
      "default_style": "normal"
    }
  }
}
```

- **default**: デフォルトスタイルを常に使用
- **random**: 利用可能なスタイルからランダム選択

### 一時的なスタイル指定

MCPツールの`say`でスタイルを一時的に指定可能：

```json
{
  "message": "こんにちは",
  "style": "sleepy"
}
```

利用可能なスタイルは自動検出され、無効なスタイル指定時はデフォルトスタイルが使用されます。

## 注意事項

### 設定のポイント

- **JSON形式**: 正しいJSON形式を維持（構文エラー防止）
- **キャラクター無効化**: `disabled: true`で特定キャラクターを無効化可能
- **部分設定**: 必要な項目のみオーバーライド可能（全項目定義は不要）

### キャラクター利用について

**重要**: COEIROINKは**つくよみちゃんのみがデフォルト**で利用可能です。その他のキャラクターはCOEIROINKアプリでのダウンロードが必要です。

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