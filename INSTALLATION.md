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

### 自動設定
初回実行時にユーザーのホームディレクトリに`~/.coeiro-operator/`フォルダが自動作成され、設定ファイルが配置されます。

### 手動設定（カスタマイズする場合）

ホームディレクトリに`~/.coeiro-operator/coeiroink-config.json`を作成：
```json
{
  "host": "localhost",
  "port": "50032",
  "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
  "rate": 200,
  "voice_presets": {
    "tsukuyomi": {
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
      "style_id": 0,
      "description": "つくよみちゃん"
    }
  }
}
```

ホームディレクトリに`~/.coeiro-operator/operator-config.json`を作成：
```json
{
  "operators": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
      "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
      "farewell": "本日の作業、お疲れさまでした。"
    }
  }
}
```

## 動作確認

### 1. COEIROINK エンジンの起動確認
```bash
curl -X GET "http://localhost:50032/speakers"
```

### 2. 音声出力テスト
```bash
say-coeiroink "音声テストです"
```

### 3. オペレータ管理テスト
```bash
# 利用可能オペレータ一覧
operator-manager available

# オペレータ割り当て
operator-manager assign Alice

# ステータス確認
operator-manager status

# オペレータ解放
operator-manager release
```

### 4. MCPサーバーテスト
```bash
coeiro-operator
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
`claude_desktop_config.json`にMCPサーバーを追加：

```json
{
  "mcpServers": {
    "coeiro-operator": {
      "command": "coeiro-operator",
      "args": []
    }
  }
}
```

### オペレータキャラクタ設定

#### 基本設定
初回実行時にデフォルトのオペレータ設定が自動作成されます。

#### カスタマイズ
利用可能なオペレータの詳細については **[prompts/CHARACTERS.md](prompts/CHARACTERS.md)** を参照してください。

9種類のキャラクター（つくよみちゃん、アンジーさん、アルマちゃん、朱花、ディアちゃん、KANA、金苗、リリンちゃん、MANA）が利用可能です。

#### 設定更新
キャラクター設定の更新方法については **[prompts/UPDATE_CHARACTER_SETTINGS.md](prompts/UPDATE_CHARACTER_SETTINGS.md)** を参照してください。

### オペレータシステム統合完了確認

#### 統合テスト
1. **Claude Codeでの挨拶テスト**：
   ```
   こんにちは
   ```
   → オペレータが自動アサインされ、音声で挨拶されます

2. **音声通知テスト**：
   長時間の作業完了時に音声通知が発生することを確認

3. **オペレータ切り替えテスト**：
   ```
   ありがとう
   ```
   → 現在のオペレータが解放され、お別れの音声が出力されます

#### 動作仕様の確認
- **[prompts/OPERATOR_SYSTEM.md](prompts/OPERATOR_SYSTEM.md)** - オペレータシステムの詳細仕様
- **挨拶時の自動オペレータアサイン** - ユーザの挨拶に応じてランダムにオペレータを選択
- **作業完了時の音声通知** - 長時間作業時に完了を音声でお知らせ
- **入力待ち通知** - Claude Code入力待ち状態で音声通知（hooks設定）

### 注意事項
- COEIROINKが起動していない場合、音声出力は無効化されます
- オペレータシステムは複数セッション間での重複を自動回避します
- 設定ファイルはユーザーのホームディレクトリの`~/.coeiro-operator/`ディレクトリに配置されます