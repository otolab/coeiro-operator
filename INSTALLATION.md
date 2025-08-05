# coeiro-operator インストールガイド

coeiro-operatorは、COEIROINK音声合成とオペレータ管理機能を提供するMCPサーバーです。

## 事前要件

### 必須ソフトウェア
- **Node.js** (推奨: LTS版)
- **COEIROINK** - 音声合成エンジン（ポート50032で動作）
- **jq** - JSON処理用コマンドラインツール

### 推奨ソフトウェア
- **nvm** - Node.jsバージョン管理
- **Homebrew** - macOSパッケージマネージャー

## インストール手順

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd coeiro-operator
```

### 2. 依存関係のインストール
```bash
npm install
```

### 3. グローバルインストール（推奨）
```bash
npm install -g .
```

### 4. 手動パス設定（グローバルインストールしない場合）
```bash
# ~/.bashrc または ~/.zshrc に追加
export PATH="$PATH:/Users/naoto.kato/Develop/tools"
```

## 初期設定

### 設定ファイルディレクトリの作成
```bash
mkdir -p ~/.claude
```

### COEIROINK設定ファイルの作成
`~/.claude/coeiroink-config.json`
```json
{
  "host": "localhost",
  "port": "50032",
  "voice": "0",
  "rate": "200"
}
```

### オペレータ設定ファイルの作成
`~/.claude/operator-config.json`
```json
{
  "operators": {
    "Alice": {
      "name": "アリス",
      "voice": "0",
      "greeting": "こんにちは、アリスです。",
      "farewell": "お疲れ様でした。"
    },
    "Bob": {
      "name": "ボブ",
      "voice": "1", 
      "greeting": "ボブです、よろしくお願いします。",
      "farewell": "また次回お会いしましょう。"
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
1. `~/.claude/`ディレクトリの存在と権限を確認
2. 設定ファイルのJSON形式が正しいことを確認
3. セッションファイルの権限問題を確認

### 設定ファイルの場所
- `~/.claude/coeiroink-config.json` - 音声合成設定
- `~/.claude/operator-config.json` - オペレータ定義
- `~/.claude/active-operators.json` - 利用状況管理（自動生成）
- `~/.claude/session-operator-$$.json` - セッション情報（自動生成）

## 開発者向け情報

### ディレクトリ構造
```
coeiro-operator/
├── src/
│   └── index.js          # MCPサーバーメイン
├── scripts/
│   ├── operator-manager  # オペレータ管理スクリプト
│   └── say-coeiroink     # 音声合成スクリプト
├── package.json
├── README.md
└── INSTALLATION.md
```

### 設定カスタマイズ
設定ファイルを編集することで、音声、オペレータ、動作をカスタマイズできます。

### MCPサーバー統合
Claudeの設定ファイルにMCPサーバーとして追加してご利用ください。

## Claude Code オペレータシステム統合

### Claude Code設定ファイルの設定

#### MCPサーバー登録
`~/.claude/settings.json`にMCPサーバーを追加：

```json
{
  "permissions": {
    "allow": [
      "mcp__coeiro-operator__operator_assign",
      "mcp__coeiro-operator__operator_release", 
      "mcp__coeiro-operator__operator_status",
      "mcp__coeiro-operator__operator_available",
      "mcp__coeiro-operator__say"
    ],
    "deny": []
  },
  "hooks": {
    "Notification": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "say-coeiroink '入力待ちです'"
          }
        ]
      }
    ]
  },
  "enabledMcpjsonServers": ["coeiro-operator"]
}
```

#### MCPサーバー登録コマンド
```bash
claude mcp add coeiro-operator coeiro-operator
```

### オペレータキャラクタ設定

#### フルオペレータ設定ファイル
`~/.claude/operator-config.json`に完全なオペレータ定義を追加：

```json
{
  "operators": {
    "tsukuyomi": {
      "name": "つくよみちゃん",
      "voice_id": "3c37646f-3881-5374-2a83-149267990abc",
      "greeting": "本日も作業をサポートさせていただきます。つくよみちゃんです。",
      "farewell": "お疲れ様でした。"
    },
    "angie": {
      "name": "アンジーさん", 
      "voice_id": "cc213e6d-d847-45b5-a1df-415744c890f2",
      "greeting": "今日もよろしくお願いします！アンジーです。",
      "farewell": "今日もお疲れ様でした！"
    },
    "alma": {
      "name": "アルマちゃん",
      "voice_id": "c97966b1-d80c-04f5-aba5-d30a92843b59", 
      "greeting": "今日はアルマが担当します。よろしくお願いしますね。",
      "farewell": "今日はお疲れ様でした。また明日もよろしくお願いします。"
    },
    "akane": {
      "name": "朱花",
      "voice_id": "d1143ac1-c486-4273-92ef-a30938d01b91",
      "greeting": "本日のオペレータを担当いたします、朱花です。効率的に作業を進めてまいります。",
      "farewell": "本日の作業はこれで終了です。お疲れ様でした。"
    },
    "dia": {
      "name": "ディアちゃん",
      "voice_id": "b28bb401-bc43-c9c7-77e4-77a2bbb4b283",
      "greeting": "ディアです。今日も一緒に頑張りましょうね。",
      "farewell": "今日も一日お疲れ様でした。ゆっくり休んでくださいね。"
    },
    "kana": {
      "name": "KANA",
      "voice_id": "297a5b91-f88a-6951-5841-f1e648b2e594",
      "greeting": "KANA、オペレータ業務を開始します。",
      "farewell": "オペレータ業務を終了します。"
    },
    "kanae": {
      "name": "金苗",
      "voice_id": "d41bcbd9-f4a9-4e10-b000-7a431568dd01",
      "greeting": "本日のオペレータを務めさせていただきます、金苗でございます。",
      "farewell": "本日はありがとうございました。また明日もよろしくお願いいたします。"
    },
    "rilin": {
      "name": "リリンちゃん",
      "voice_id": "cb11bdbd-78fc-4f16-b528-a400bae1782d",
      "greeting": "今日も元気いっぱい！リリンが担当します！",
      "farewell": "今日も一日お疲れ様でした！また明日も頑張りましょう！"
    },
    "mana": {
      "name": "MANA",
      "voice_id": "292ea286-3d5f-f1cc-157c-66462a6a9d08",
      "greeting": "MANAです。今日もゆっくり一緒に作業しましょうね。",
      "farewell": "今日もお疲れ様でした。ゆっくり休んでくださいね。"
    }
  }
}
```

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
- **OPERATOR_SYSTEM.md** - オペレータシステムの詳細仕様
- **挨拶時の自動オペレータアサイン** - ユーザの挨拶に応じてランダムにオペレータを選択
- **作業完了時の音声通知** - 長時間作業時に完了を音声でお知らせ
- **入力待ち通知** - Claude Code入力待ち状態で音声通知（hooks設定）

### 注意事項
- COEIROINKが起動していない場合、音声出力は無効化されます
- オペレータシステムは複数セッション間での重複を自動回避します
- 設定ファイルは`~/.claude/`ディレクトリに配置してください