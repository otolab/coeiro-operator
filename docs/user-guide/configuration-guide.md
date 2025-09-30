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
├── config.json                # 統一設定ファイル（全設定を一元管理）
└── active-operators.json      # 利用状況管理（自動生成）
```

### 設定の優先順位
1. **内蔵デフォルト設定** (基盤): 13キャラクターの内蔵設定（speakerIdで識別）
2. **動的音声検出** (自動): COEIROINKサーバーから音声情報取得（speakerIdでマッチング）
3. **ユーザー設定** (カスタマイズ): `~/.coeiro-operator/operator-config.json`

## 統一設定ファイル（config.json）

### 設定値一覧表

| セクション | 設定項目 | 型 | デフォルト値 | 説明 |
|------------|----------|------|-------------|------|
| **connection** | | | | COEIROINK接続設定 |
| | `host` | String | `"localhost"` | COEIROINKサーバーのホスト |
| | `port` | String | `"50032"` | COEIROINKサーバーのポート |
| **audio** | | | | 音声処理設定 |
| | `latencyMode` | String | `"balanced"` | レイテンシモード: `"ultra-low"`, `"low"`, `"balanced"`, `"quality"` |
| | `splitMode` | String | `"punctuation"` | テキスト分割モード: `"none"`, `"punctuation"`, `"small"`, `"medium"`, `"large"`, `"auto"` |
| | `bufferSize` | Number | `1024` | バッファサイズ（256-4096） |
| | `processing.synthesisRate` | Number | `24000` | 合成サンプリングレート |
| | `processing.playbackRate` | Number | `48000` | 再生サンプリングレート |
| | `processing.lowpassFilter` | Boolean | `true` | ローパスフィルター有効化 |
| | `processing.lowpassCutoff` | Number | `24000` | ローパスフィルターカットオフ周波数 |
| | `processing.noiseReduction` | Boolean | `false` | ノイズリダクション有効化 |
| **operator** | | | | オペレータ管理設定 |
| | `rate` | Number | `200` | 話速（WPM） |
| | `timeout` | Number | `14400000` | オペレータ予約タイムアウト（ミリ秒、4時間） |
| | `assignmentStrategy` | String | `"random"` | 割り当て戦略（現在は`"random"`のみ） |
| **terminal.background** | | | | ターミナル背景設定（iTerm2限定） |
| | `enabled` | Boolean | `false` | 背景画像機能の有効化 |
| | `backgroundImages[id]` | String | - | キャラクターIDごとの背景画像パス |
| | `operatorImage.display` | String | `"api"` | オペレータ画像取得方法: `"api"`, `"file"`, `"none"` |
| | `operatorImage.opacity` | Number | `0.3` | 透明度（0.0-1.0） |
| | `operatorImage.filePath` | String | - | 画像ファイルパス（`display: "file"`の場合） |
| **characters[id]** | | | | キャラクター個別設定 |
| | `name` | String | 内蔵設定 | 表示名 |
| | `personality` | String | 内蔵設定 | 性格設定 |
| | `speakingStyle` | String | 内蔵設定 | 話し方の特徴 |
| | `greeting` | String | 内蔵設定 | アサイン時の挨拶 |
| | `farewell` | String | 内蔵設定 | 解放時のお別れ |
| | `defaultStyle` | String | 内蔵設定 | デフォルトスタイル名 |
| | `disabled` | Boolean | `false` | キャラクターの無効化 |

### 最小設定例

```json
{
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶"
    }
  }
}
```

**注意**: 
- キャラクターIDは`tsukuyomi`のような識別子で、内蔵キャラクターは固定です
- 各キャラクターは`speakerId`（UUID）でCOEIROINKのSpeakerと紐付けられます
- 起動時に利用可能なspeakerIdを持つキャラクターのみが有効になります

### キャラクターとSpeakerの関係

- **キャラクターID**: `tsukuyomi`, `angie`など、オペレータ指定に使用する識別子
- **speakerId**: COEIROINKのSpeaker UUID（音声を特定）
- **マッチング**: 起動時にspeakerIdでCOEIROINKのSpeakerと自動マッチング
- **利用可能性**: COEIROINKで利用可能なspeakerのみがオペレータ候補となる

### 利用可能なキャラクターID一覧

| キャラクターID | 表示名 | speakerId |
|------|------|------|
| tsukuyomi | つくよみちゃん | 3c37646f-3881-5374-2a83-149267990abc |
| angie | アンジーさん | cc213e6d-d847-45b5-a1df-415744c890f2 |
| alma | アルマちゃん | c97966b1-d80c-04f5-aba5-d30a92843b59 |
| akane | AI声優-朱花 | d1143ac1-c486-4273-92ef-a30938d01b91 |
| kana | KANA | 297a5b91-f88a-6951-5841-f1e648b2e594 |
| kanae | AI声優-金苗 | d41bcbd9-f4a9-4e10-b000-7a431568dd01 |
| mana | MANA | 292ea286-3d5f-f1cc-157c-66462a6a9d08 |
| dia | ディアちゃん | b28bb401-bc43-c9c7-77e4-77a2bbb4b283 |
| rilin | リリンちゃん | cb11bdbd-78fc-4f16-b528-a400bae1782d |
| ofutonp | おふとんP | a60ebf6c-626a-7ce6-5d69-c92bf2a1a1d0 |
| kurowa | クロワちゃん | cc1153b4-d20c-46dd-a308-73ca38c0e85a |
| aoba | AI声優-青葉 | d219f5ab-a50b-4d99-a26a-a9fc213e9100 |
| ginga | AI声優-銀芽 | d312d0fb-d38d-434e-825d-cbcbfd105ad0 |

**利用可能なspeakerIdの確認**: `http://localhost:50032/v1/speakers`

### 一時的なスタイル指定

MCPツールの`say`でスタイルを一時的に指定可能：

```json
{
  "message": "こんにちは",
  "style": "sleepy"
}
```

利用可能なスタイルは自動検出され、無効なスタイル指定時はデフォルトスタイルが使用されます。

## 音声処理詳細設定

### 分割モード（splitMode）

- **punctuation** (デフォルト): 句読点ベースの自然分割
- **none**: 分割なし
- **small/medium/large**: 文字数ベース分割
- **auto**: 自動判定

### レイテンシモード（latencyMode）

- **ultra-low**: 超低遅延（品質を犠牲にして応答速度を最優先）
- **low**: 低遅延
- **balanced**: バランス（デフォルト、品質と遅延のバランス）
- **quality**: 高品質（遅延よりも品質を優先）

### 音質プリセット例

#### 高品質設定
```json
{
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
  "operator": {
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

#### バランス設定（推奨・デフォルト値）
```json
{
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "bufferSize": 1024
  }
}
```

## ターミナル背景画像設定（iTerm2限定）

オペレータの立ち絵をiTerm2の背景に表示する機能です。

### 必要環境
- macOS + iTerm2
- Python 3.12以上
- [uv](https://github.com/astral-sh/uv)（Pythonパッケージマネージャー）

### 設定例

```json
{
  "terminal": {
    "background": {
      "enabled": true,
      "backgroundImages": {
        "tsukuyomi": "/path/to/tsukuyomi-bg.png"
      },
      "operatorImage": {
        "display": "api",
        "opacity": 0.3
      }
    }
  }
}
```

### 動作仕様
- オペレータ切り替え時に自動で背景画像を更新
- オペレータ画像は右下に15%のサイズで表示（現在固定値）
- セッションIDを使用して特定のターミナルウィンドウに背景を設定
- backgroundImagesで指定した画像が優先、なければoperatorImageを使用

## 設定の動作確認

### 現在の設定状況確認

```bash
# 利用可能なキャラクターの確認
operator-manager available

# 設定ファイルの存在確認
ls -la ~/.coeiro-operator/

# ユーザー設定の内容確認（存在する場合）
cat ~/.coeiro-operator/config.json 2>/dev/null || echo "ユーザー設定なし（内蔵設定を使用）"

# 現在利用可能な音声確認
curl -s -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName'
```

### 設定の階層構造

システムは以下の順序で設定をマージします：

1. **内蔵デフォルト設定** - 13キャラクターの基本設定
2. **動的音声検出** - COEIROINKサーバーから取得
3. **ユーザー設定** - `~/.coeiro-operator/config.json`

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
cat > ~/.coeiro-operator/config.json << 'EOF'
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
cat > ~/.coeiro-operator/config.json << 'EOF'
{
  "characters": {
    "angie": {
      "disabled": true
    }
  }
}
EOF
```

#### 背景画像の有効化（iTerm2）

```bash
# ターミナル背景画像を有効化
cat > ~/.coeiro-operator/config.json << 'EOF'
{
  "terminal": {
    "background": {
      "enabled": true,
      "operatorImage": {
        "display": "api",
        "opacity": 0.3
      }
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

## セッション管理ファイル

オペレータの予約状態は`/tmp/coeiroink-operators-<hostname>.json`に保存され、セッションごとに管理されます。このファイルはシステムが自動管理し、手動編集の必要はありません。

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

- **キャラクター詳細情報**: [../user-guide/CHARACTERS.md](../user-guide/CHARACTERS.md)
- **音声ID更新手順**: [../../prompts/UPDATE_CHARACTER_SETTINGS.md](../../prompts/UPDATE_CHARACTER_SETTINGS.md)
- **インストールガイド**: [../../README.md](../../README.md)

---
**作成日**: 2025年8月5日  
**更新頻度**: 設定仕様変更時・新機能追加時  
**対象バージョン**: COEIRO Operator v1.0+