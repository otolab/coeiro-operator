# 設定・カスタマイズガイド

COEIRO Operatorの詳細な設定方法とカスタマイズオプションについて説明します。

## 設定システム概要

### 設定の自動構築システム

- **手動設定ファイル作成は不要**: 内蔵設定から自動構築
- **音声フォント自動検出**: COEIROINKサーバーから動的取得
- **設定の階層マージ**: 内蔵設定 + 動的検出 + ユーザー設定
- **部分カスタマイズ対応**: 必要な項目のみオーバーライド可能

### 設定ファイルの場所
```
~/.coeiro-operator/
├── coeiroink-config.json      # COEIROINK・音声設定
├── operator-config.json       # オペレータ管理設定  
└── active-operators.json      # 利用状況管理（自動生成）
```

### 設定の優先順位
1. **内蔵デフォルト設定** (基盤): 13キャラクターの内蔵設定
2. **動的音声検出** (自動): COEIROINKサーバーから音声情報取得
3. **ユーザー設定** (カスタマイズ): `~/.coeiro-operator/operator-config.json`

## オペレータ設定（キャラクター管理）

### operator-config.json（部分オーバーライド設定）

**目的**: 内蔵設定の部分的なカスタマイズ（全項目の定義は不要）

#### 最小設定例（一部カスタマイズ）

```json
{
  "characterSettings": {
    "assignmentStrategy": "random"
  },
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
  "operatorTimeout": 14400000,
  "characterSettings": {
    "assignmentStrategy": "random"
  },
  "characters": {
    "tsukuyomi": {
      "personality": "カスタマイズされた性格設定",
      "speakingStyle": "カスタマイズされた話し方",
      "greeting": "カスタマイズされた挨拶",
      "farewell": "カスタマイズされたお別れ"
    },
    "angie": {
      "greeting": "元気いっぱいで今日もよろしく！"
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
| `operatorTimeout` | ✓ | Number | オペレータ予約タイムアウト（ミリ秒、デフォルト4時間） |
| `characterSettings` | ✓ | Object | グローバルなキャラクター動作設定 |
| `characterSettings.assignmentStrategy` | ✓ | String | オペレータ割り当て戦略 (現在はrandomのみ) |
| `characters` | ✓ | Object | キャラクター設定のオーバーライド |
| `characters[id].name` | ✓ | String | 表示名（通常は変更不要） |
| `characters[id].personality` | ✓ | String | 性格設定（MCP出力時に表示） |
| `characters[id].speakingStyle` | ✓ | String | 話し方の特徴（MCP出力時に表示） |
| `characters[id].greeting` | ✓ | String | アサイン時の挨拶メッセージ |
| `characters[id].farewell` | ✓ | String | 解放時のお別れメッセージ |
| `characters[id].defaultStyle` | ✓ | String | デフォルトスタイル名（スタイル未指定時のデフォルト） |
| `characters[id].disabled` | ✓ | Boolean | キャラクターの無効化フラグ |

**注意**: 
- `speakerId`は動的検出されるため通常は設定不要です（新規キャラクター作成時のみ必須）

### 新規キャラクターの作成

COEIROINKの音声ライブラリに対応する新規キャラクターを定義できます：

```json
{
  "characters": {
    "my_custom_character": {
      "name": "カスタムキャラクター",
      "speakerId": "d1143ac1-c486-4273-92ef-a30938d01b91",  // 必須: COEIROINKのspeakerUuid
      "personality": "独自の性格設定",
      "speakingStyle": "独自の話し方",
      "greeting": "カスタム挨拶メッセージ",
      "farewell": "カスタムお別れメッセージ",
      "defaultStyle": "のーまる"
    }
  }
}
```

**重要**: 新規キャラクター作成時は`speakerId`（COEIROINKのspeakerUuid）が必須です。  
利用可能なspeakerIdは`http://localhost:50032/v1/speakers`で確認できます。

### 一時的なスタイル指定

MCPツールの`say`でスタイルを一時的に指定可能：

```json
{
  "message": "こんにちは",
  "style": "sleepy"
}
```

利用可能なスタイルは自動検出され、無効なスタイル指定時はデフォルトスタイルが使用されます。

## COEIROINK・音声設定

### coeiroink-config.json

#### 設定ファイル構造（v2.1.0+）

最新の設定は以下の構造を使用します：

```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_speaker_id": "3c37646f-3881-5374-2a83-149267990abc",
    "default_style_id": 0,
    "rate": 200
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "bufferSize": 1024,
    "processing": {
      "synthesisRate": 24000,
      "playbackRate": 48000,
      "lowpassFilter": true,
      "lowpassCutoff": 24000,
      "noiseReduction": false
    },
    "splitSettings": {
      "smallSize": 30,
      "mediumSize": 50,
      "largeSize": 100,
      "overlapRatio": 0.1
    }
  }
}
```

#### 分割モード（splitMode）

- **punctuation** (デフォルト): 句読点ベースの自然分割
- **none**: 分割なし
- **small/medium/large**: 文字数ベース分割
- **auto**: 自動判定

### 音質プリセット

#### 高品質設定
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_speaker_id": "your-speaker-id",
    "rate": 200
  },
  "audio": {
    "latencyMode": "quality",
    "splitMode": "large",
    "bufferSize": 2048,
    "processing": {
      "synthesisRate": 24000,
      "playbackRate": 48000,
      "lowpassFilter": true,
      "lowpassCutoff": 24000,
      "noiseReduction": true
    }
  }
}
```

#### 超低遅延設定
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_speaker_id": "your-speaker-id",
    "rate": 180
  },
  "audio": {
    "latencyMode": "ultra-low",
    "splitMode": "small",
    "bufferSize": 512,
    "processing": {
      "synthesisRate": 22050,
      "playbackRate": 44100,
      "lowpassFilter": false,
      "noiseReduction": false
    }
  }
}
```

#### バランス設定（推奨）
```json
{
  "connection": {
    "host": "localhost",
    "port": "50032"
  },
  "voice": {
    "default_speaker_id": "your-speaker-id",
    "rate": 200
  },
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "bufferSize": 1024,
    "processing": {
      "synthesisRate": 24000,
      "playbackRate": 48000,
      "lowpassFilter": true,
      "lowpassCutoff": 24000,
      "noiseReduction": false
    }
  }
}
```

## 設定の動作確認

### 現在の設定状況確認

```bash
# 利用可能なキャラクターの確認
operator-manager available

# 設定ファイルの存在確認
ls -la ~/.coeiro-operator/

# ユーザー設定の内容確認（存在する場合）
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "ユーザー設定なし（内蔵設定を使用）"

# 現在利用可能な音声確認
curl -s -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName'
```

### 設定の階層構造確認

システムは以下の順序で設定をマージします：

1. **内蔵デフォルト設定** - 13キャラクターの基本設定
2. **動的音声検出** - COEIROINKサーバーから取得
3. **ユーザー設定** - `~/.coeiro-operator/operator-config.json`

各段階で設定が重ね合わされ、最終的な設定が決定されます。

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

## 注意事項

### 設定のポイント

- **JSON形式**: 正しいJSON形式を維持（構文エラー防止）
- **キャラクター無効化**: `disabled: true`で特定キャラクターを無効化可能
- **部分設定**: 必要な項目のみオーバーライド可能（全項目定義は不要）

## スタイル管理と永続化

### スタイル選択の優先順位

音声合成時のスタイルは以下の優先順位で決定されます：

1. **明示的な指定** (最優先)
   - CLIの`--style`オプション: `say-coeiroink --style "セクシー" "テキスト"`
   - MCPツールの`style`パラメータ: `say({ message: "テキスト", style: "セクシー" })`

2. **オペレータセッション保存値**
   - `operator-manager assign --style=<スタイル名>`で保存された値
   - セッション期間中（最大4時間）は永続化

3. **キャラクターのデフォルト**
   - Character定義の`defaultStyle`（`operator-config.json`でカスタマイズ可能）

4. **最初のスタイル** (フォールバック)
   - Speakerのstyles配列の最初の要素

### スタイル永続化の仕組み

オペレータ割り当て時にスタイルを指定すると、そのスタイルがセッションに保存されます：

```bash
# スタイル付きでオペレータを割り当て
operator-manager assign angie --style=セクシー

# 以降、スタイル指定なしでもセクシースタイルが使用される
say-coeiroink "このメッセージはセクシースタイルで再生"

# 明示的な指定で一時的に上書き
say-coeiroink --style "のーまる" "このメッセージだけ通常スタイル"

# 再び保存されたスタイルが使用される
say-coeiroink "またセクシースタイルに戻る"
```

### active-operators.json（セッション状態）

**保存場所**: `~/.coeiro-operator/active-operators.json`

```json
{
  "sessions": {
    "terminal_session_123": {
      "characterId": "angie",
      "styleId": 121,          // 保存されたスタイルID
      "styleName": "セクシー",   // 保存されたスタイル名
      "assignedAt": 1698123456789
    }
  }
}
```

### キャラクター利用について

**重要**: COEIROINKは**つくよみちゃんのみがデフォルト**で利用可能です。その他のキャラクターはCOEIROINKアプリでのダウンロードが必要です。

**用途別おすすめ**（ダウンロード済みの場合）:
- **ビジネス・フォーマル**: つくよみちゃん、AI声優-朱花
- **親しみやすい・カジュアル**: アンジーさん、ディアちゃん
- **元気・活発**: リリンちゃん、アンジーさん
- **クール・効率重視**: KANA、AI声優-朱花

## 関連ファイル

- **キャラクター詳細情報**: [CHARACTERS.md](CHARACTERS.md)
- **音声ID更新手順**: [../prompts/UPDATE_CHARACTER_SETTINGS.md](../prompts/UPDATE_CHARACTER_SETTINGS.md)
- **インストールガイド**: [../README.md](../README.md)

---
**作成日**: 2025年8月5日  
**更新頻度**: 設定仕様変更時・新機能追加時  
**対象バージョン**: COEIRO Operator v1.0+