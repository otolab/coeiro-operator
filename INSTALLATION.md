# COEIRO Operator インストールガイド

COEIRO OperatorはCOEIROINK音声合成システムのMCPサーバーとオペレータ管理システムです。

## 事前要件

### 必須ソフトウェア
- **Node.js 18以上** (推奨: LTS版)
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **macOS** - 音声再生にafplayを使用

### 推奨ソフトウェア
- **Claude Desktop** - MCPサーバー統合用
- **GitHub CLI (gh)** - リポジトリ管理用

## インストール方法

### NPMからのインストール（推奨）
```bash
npm install -g @otolab/coeiro-operator
```

### ソースからのインストール
```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm link
```

## 初期設定

### ディレクトリの自動作成
初回実行時にユーザーのホームディレクトリに`~/.coeiro-operator/`フォルダが自動作成されます。

### 設定ファイルの作成

#### 基本設定（任意）
ホームディレクトリに`~/.coeiro-operator/coeiroink-config.json`を作成：
```json
{
  "host": "localhost",
  "port": "50032",
  "rate": 200,
  "voice_id": "3c37646f-3881-5374-2a83-149267990abc"
}
```

#### オペレータ設定（必須）
ホームディレクトリに`~/.coeiro-operator/operator-config.json`を作成：
```json
{
  "characters": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
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
  },
  "operators": {
    "tsukuyomi": {
      "character_id": "tsukuyomi",
      "enabled": true
    }
  }
}
```

## 環境確認・設定

### 1. COEIROINK エンジンの起動確認
```bash
# COEIROINKサーバーの起動確認
curl -X GET "http://localhost:50032/speakers"
```

期待される結果: 利用可能な音声一覧のJSON応答

### 2. 利用可能キャラクターの検出

#### 自動検出（推奨）
```bash
# COEIROINKから直接取得
curl -X GET "http://localhost:50032/v1/speakers" | jq '.[].name'
```

#### 詳細情報の取得
```bash
# 音声ID付きで確認
curl -X GET "http://localhost:50032/v1/speakers" | jq '.[] | {name: .name, uuid: .speaker_uuid, styles: [.styles[].name]}'
```

### 3. 設定状況の確認

#### インストール状態の確認
```bash
# パッケージインストール確認
which coeiro-operator
which say-coeiroink
which operator-manager

# バージョン確認
npm list -g coeiro-operator
```

#### 設定ファイルの確認
```bash
# 設定ディレクトリの確認
ls -la ~/.coeiro-operator/

# または作業ディレクトリ内
ls -la ./.coeiroink/

# 設定ファイル内容の確認
cat ~/.coeiro-operator/operator-config.json 2>/dev/null || echo "設定ファイルが存在しません"
```

### 4. 環境に合わせた初期設定

#### Step 1: COEIROINKキャラクター検出・環境確認

**利用可能音声の確認**:
```bash
# 1. 利用可能音声の一覧取得
curl -X GET "http://localhost:50032/v1/speakers" > available-voices.json

# 2. 音声名・IDの確認
jq '.[] | {name: .speakerName, uuid: .speakerUuid, styles: [.styles[].styleName]}' available-voices.json

# 3. 特定キャラクターの音声ID取得例
echo "つくよみちゃんの音声ID:"
jq '.[] | select(.speakerName == "つくよみちゃん") | .speakerUuid' available-voices.json

echo "利用可能な全キャラクター名:"
jq -r '.[].speakerName' available-voices.json
```

**環境に応じたキャラクター判定**:

COEIROINKは**つくよみちゃんのみがデフォルトで利用可能**です。その他のキャラクターは個別にダウンロードが必要です。

```bash
# 現在ダウンロード済みキャラクターの確認
echo "=== ダウンロード済みキャラクター ==="
curl -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName' | sort

# ダウンロード可能なキャラクターの確認
echo "=== ダウンロード可能キャラクター（追加可能） ==="
curl -X GET "http://localhost:50032/v1/downloadable_speakers" | jq -r '.[].speakerName' | sort

# 利用可能性の比較（ダウンロード済み vs 利用可能）
echo "=== キャラクター利用状況確認 ==="
available_speakers=$(mktemp)
downloadable_speakers=$(mktemp)

curl -s -X GET "http://localhost:50032/v1/speakers" | jq -r '.[].speakerName' | sort > "$available_speakers"
curl -s -X GET "http://localhost:50032/v1/downloadable_speakers" | jq -r '.[].speakerName' | sort > "$downloadable_speakers"

echo "✅ ダウンロード済み（すぐ利用可能）:"
cat "$available_speakers"

echo "📥 ダウンロード可能（追加でダウンロードが必要）:"
comm -23 "$downloadable_speakers" "$available_speakers"

rm "$available_speakers" "$downloadable_speakers"
```

#### Step 2: 設定ファイルの作成

### 設定ファイル仕様

COEIRO Operatorの設定ファイルについては **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** を参照してください。

### 基本設定の作成

```bash
# 設定ディレクトリの作成
mkdir -p .coeiroink

# 最小構成のoperator-config.jsonを作成
cat > .coeiroink/operator-config.json << 'EOF'
{
  "operators": {}
}
EOF
```

### キャラクター設定例

**つくよみちゃんの設定追加例**:
```bash
# 音声IDの取得
TSUKUYOMI_ID=$(jq -r '.[] | select(.speakerName == "つくよみちゃん") | .speakerUuid' available-voices.json)

# 設定ファイルに追加
jq --arg id "$TSUKUYOMI_ID" '
.operators.tsukuyomi = {
  "name": "つくよみちゃん",
  "voice_id": $id,
  "personality": "冷静で丁寧、報告は簡潔で正確",
  "speaking_style": "敬語、落ち着いた口調",
  "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
  "farewell": "本日の作業、お疲れさまでした。"
}' .coeiroink/operator-config.json > temp.json && mv temp.json .coeiroink/operator-config.json
```

詳細な設定方法、音声ID管理、カスタマイズについては **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** を参照してください。

#### Step 3: 音声ID確認・更新

**基本的な確認**:
```bash
# 現在の設定確認
jq '.' .coeiroink/operator-config.json

# 音声ID整合性確認
jq -r '.operators | to_entries[] | "\(.key): \(.value.name) (\(.value.voice_id))"' .coeiroink/operator-config.json
```

音声IDの詳細な確認・更新方法については **[docs/CONFIGURATION.md](docs/CONFIGURATION.md)** および **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** を参照してください。

### 5. 動作テスト

#### 基本動作テスト
```bash
# 音声出力テスト
say-coeiroink "音声テストです"

# オペレータ管理テスト
operator-manager available
operator-manager assign
operator-manager status
operator-manager release
```

#### MCPサーバーテスト
```bash
# MCPサーバー起動テスト
coeiro-operator &
echo "MCPサーバーが起動しました"

# プロセス確認
ps aux | grep coeiro-operator

# 停止
killall coeiro-operator
```

## 使用可能なコマンド

### coeiro-operator
MCPサーバーのメインコマンド。Claudeとの統合に使用。

### say-coeiroink
音声合成コマンド（macOS `say`コマンド互換）
```bash
say-coeiroink "読み上げたいテキスト"
say-coeiroink -r 150 "読み上げ速度を指定"
say-coeiroink -v 1 "音声を指定"
```

### operator-manager
オペレータ管理コマンド
```bash
operator-manager available        # 利用可能オペレータ一覧
operator-manager assign [name]    # オペレータ割り当て
operator-manager status           # 現在のステータス
operator-manager release          # オペレータ解放
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

### オペレータ管理エラー
1. `~/.coeiro-operator/`ディレクトリの存在と権限を確認
2. 設定ファイルのJSON形式が正しいことを確認
3. セッションファイルの権限問題を確認

### 設定ファイルの場所
- `~/.coeiro-operator/coeiroink-config.json` - 音声合成設定
- `~/.coeiro-operator/operator-config.json` - オペレータ定義
- `~/.coeiro-operator/active-operators.json` - 利用状況管理（自動生成）
- `/tmp/coeiroink-mcp-session-*/session-operator-*.json` - セッション情報（自動生成）

## 開発者向け情報

### ディレクトリ構造
```
coeiro-operator/
├── src/
│   ├── index.js              # MCPサーバーメイン
│   ├── operator/
│   │   ├── index.js          # オペレータ管理ライブラリ
│   │   └── cli.js            # オペレータ管理CLI
│   └── say/
│       ├── index.js          # 音声合成ライブラリ
│       └── cli.js            # 音声合成CLI
├── scripts/
│   ├── operator-manager      # オペレータ管理シェルスクリプト
│   └── say-coeiroink         # 音声合成シェルスクリプト
├── package.json
├── README.md
└── INSTALLATION.md
```

### 設定カスタマイズ
設定ファイルを編集することで、音声、オペレータ、動作をカスタマイズできます。

### MCPサーバー統合
Claudeの設定ファイルにMCPサーバーとして追加してご利用ください。

## MCP統合設定

### Claude Desktop設定

#### 設定ファイルの場所
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

#### 設定手順

**Step 1: 設定ファイルの確認・作成**
```bash
# macOSの場合
CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# 設定ファイルが存在するか確認
if [[ -f "$CONFIG_FILE" ]]; then
    echo "設定ファイルが存在します: $CONFIG_FILE"
    cat "$CONFIG_FILE"
else
    echo "設定ファイルを新規作成します"
    mkdir -p "$(dirname "$CONFIG_FILE")"
fi
```

**Step 2: MCPサーバー設定の追加**

**新規設定の場合**:
```bash
cat > "$CONFIG_FILE" << 'EOF'
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": []
    }
  }
}
EOF
```

**既存設定に追加する場合**:
```bash
# 現在の設定をバックアップ
cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

# jqを使用して設定を追加
jq '.mcpServers["coeiro-operator"] = {"command": "coeiro-operator", "args": []}' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
```

**Step 3: Claude Desktop再起動**
```bash
# macOSの場合
osascript -e 'quit app "Claude"'
sleep 2
open -a "Claude"
```

#### 設定確認
```bash
# 設定ファイル内容の確認
cat "$CONFIG_FILE" | jq '.mcpServers'

# Claude Desktop再起動後、Claude Codeで確認
# MCP接続状況は Claude > Settings > Developer で確認可能
```

#### 詳細設定オプション

**環境変数の設定**:
```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": [],
      "env": {
        "COEIROINK_HOST": "localhost",
        "COEIROINK_PORT": "50032",
        "OPERATOR_CONFIG_DIR": ".coeiroink"
      }
    }
  }
}
```

**作業ディレクトリの指定**:
```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": [],
      "cwd": "/path/to/your/project"
    }
  }
}
```

#### トラブルシューティング

**MCPサーバーが認識されない場合**:
```bash
# 1. コマンドパスの確認
which coeiro-operator

# 2. 絶対パスで設定
jq --arg path "$(which coeiro-operator)" '.mcpServers["coeiro-operator"].command = $path' "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"

# 3. ログファイルの確認（Claude Desktop ログ）
tail -f ~/Library/Logs/Claude/claude_desktop.log
```

**権限エラーの場合**:
```bash
# 実行権限の確認・付与
chmod +x "$(which coeiro-operator)"

# 設定ディレクトリの権限確認
ls -la ~/.coeiro-operator/
chmod 755 ~/.coeiro-operator/
```

### オペレータキャラクタ設定

#### 基本設定
初回実行時にデフォルトのオペレータ設定が自動作成されます。

#### カスタマイズ
利用可能なオペレータの詳細については **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** を参照してください。

9種類のキャラクター（つくよみちゃん、アンジーさん、アルマちゃん、朱花、ディアちゃん、KANA、金苗、リリンちゃん、MANA）が利用可能です。

#### 設定更新
キャラクター設定の更新方法については **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** を参照してください。

### 統合テスト・完了確認

#### セットアップ完了チェックリスト

**必須項目**:
- [ ] COEIROINKが起動している
- [ ] `coeiro-operator`コマンドが実行可能
- [ ] 設定ファイルが正しく配置されている
- [ ] Claude DesktopのMCP設定が完了している

**確認コマンド**:
```bash
# 1. 全体状況の確認
echo "=== COEIRO Operator セットアップ確認 ==="

# COEIROINK起動確認
echo "1. COEIROINK起動確認:"
curl -s -X GET "http://localhost:50032/speakers" >/dev/null && echo "✅ COEIROINK起動中" || echo "❌ COEIROINK未起動"

# コマンド存在確認
echo "2. コマンド確認:"
which coeiro-operator >/dev/null && echo "✅ coeiro-operator利用可能" || echo "❌ coeiro-operator未インストール"
which operator-manager >/dev/null && echo "✅ operator-manager利用可能" || echo "❌ operator-manager未インストール"
which say-coeiroink >/dev/null && echo "✅ say-coeiroink利用可能" || echo "❌ say-coeiroink未インストール"

# 設定ファイル確認
echo "3. 設定ファイル確認:"
[[ -f ".coeiroink/operator-config.json" ]] && echo "✅ 作業ディレクトリ設定あり" || echo "⚠️  作業ディレクトリ設定なし"
[[ -f "$HOME/.coeiro-operator/operator-config.json" ]] && echo "✅ ホームディレクトリ設定あり" || echo "⚠️  ホームディレクトリ設定なし"

# Claude Desktop設定確認
echo "4. Claude Desktop設定確認:"
CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [[ -f "$CONFIG_FILE" ]] && jq -e '.mcpServers["coeiro-operator"]' "$CONFIG_FILE" >/dev/null 2>&1; then
    echo "✅ Claude Desktop MCP設定済み"
else
    echo "❌ Claude Desktop MCP設定未完了"
fi

echo "=== 確認完了 ==="
```

#### 統合テスト

**Claude Codeでのテスト手順**:

1. **挨拶テスト**:
   ```
   こんにちは
   ```
   期待結果: オペレータが自動アサインされ、音声で挨拶

2. **オペレータ情報確認**:
   ```
   現在のオペレータは？
   ```
   期待結果: アサインされたオペレータ情報の表示

3. **音声出力テスト**:
   ```
   何か話してください
   ```
   期待結果: オペレータの音声出力

4. **オペレータ切り替えテスト**:
   ```
   ありがとう
   ```
   期待結果: お別れの音声後、オペレータ解放

#### よくある問題の対処法

**音声が出力されない場合**:
```bash
# 1. システム音量確認
osascript -e "output volume of (get volume settings)"

# 2. afplayコマンド確認
which afplay

# 3. 手動音声テスト
say-coeiroink "テスト音声です"
```

**オペレータがアサインされない場合**:
```bash
# 1. 利用可能オペレータ確認
operator-manager available

# 2. 手動アサイン
operator-manager assign

# 3. ログ確認
tail -f ~/.coeiro-operator/debug.log 2>/dev/null || echo "ログファイルなし"
```

**MCPサーバーが接続できない場合**:
```bash
# 1. プロセス確認
ps aux | grep coeiro-operator

# 2. 手動起動テスト
coeiro-operator &
sleep 2
ps aux | grep coeiro-operator
killall coeiro-operator

# 3. Claude Desktop再起動
osascript -e 'quit app "Claude"'
sleep 3
open -a "Claude"
```

#### 動作仕様の確認
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - オペレータシステムの詳細仕様
- **挨拶時の自動オペレータアサイン** - ユーザの挨拶に応じてランダムにオペレータを選択
- **作業完了時の音声通知** - 長時間作業時に完了を音声でお知らせ
- **入力待ち通知** - Claude Code入力待ち状態で音声通知（hooks設定）

### 注意事項
- COEIROINKが起動していない場合、音声出力は無効化されます
- オペレータシステムは複数セッション間での重複を自動回避します
- 設定ファイルはユーザーのホームディレクトリの`~/.coeiro-operator/`ディレクトリに配置されます