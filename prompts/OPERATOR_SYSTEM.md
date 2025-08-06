# オペレータシステム仕様

## 概要
COEIRO OperatorにおけるMCP音声オペレータシステム。複数のキャラクタが音声通知とコミュニケーションを担当する非同期音声システム。

## 音声出力システム

### 基本仕様
- **MCPサーバ**: `coeiro-operator`
- **前提**: COEIROINKサーバー起動中（localhost:50032）
- **実行**: 現在アサインされたオペレータキャラクタで非同期音声合成・再生
- **設定管理**: ユーザーホームディレクトリの`~/.coeiro-operator/`フォルダ

### 音声処理方式
- **非同期キュー処理**: 音声要求を即座にキューに追加し、バックグラウンドで順次処理
- **低レイテンシストリーミング**: 長文は自動的にチャンク分割してストリーミング再生
- **並列音声合成**: バッファサイズ3での並列処理で高速化

### MCPツール
Claude Desktop統合環境で利用可能：
- **`operator_assign`**: オペレータ割り当て（ランダムまたは指定）
- **`operator_release`**: オペレータ解放
- **`operator_status`**: オペレータ状況確認
- **`operator_available`**: 利用可能オペレータ一覧
- **`say`**: 音声出力（非同期キュー処理で即座に戻る）

## セッション管理

### オペレータ割り当て
- **セッション識別**: ITERM_SESSION_ID → TERM_SESSION_ID → PPID の優先順位
- **重複防止**: 複数セッション間でのオペレータ重複を自動回避
- **ユーザー設定ベース**: ユーザー個人の設定を全プロジェクトで共有
- **チーム設定なし**: 個人設定のみでチーム設定は行わない

### 設定ファイル管理
- **設定場所**: `~/.coeiro-operator/`（ユーザーホームディレクトリ）
- **セッション情報**: `/tmp/coeiroink-mcp-session-{SESSION_ID}/`
- **自動作成**: 必要なディレクトリとファイルを自動生成

## 音声合成処理

### キュー処理システム
- **即座応答**: MCPツール呼び出しは音声キューに追加後即座に戻る
- **バックグラウンド処理**: 実際の音声合成・再生は別プロセスで順次実行
- **エラーハンドリング**: 音声合成失敗時もシステム継続

### 音声選択優先順位
1. **引数指定**: ツール呼び出し時の音声ID指定
2. **現在オペレータ**: operator-managerからの現在オペレータ音声
3. **設定ファイル**: coeiroink-config.jsonのdefault設定
4. **システムデフォルト**: 内蔵デフォルト設定

## オペレータキャラクタ

利用可能なオペレータキャラクターの詳細については、以下を参照してください：

**@../docs/CHARACTERS.md**

9種類のオペレータキャラクター（つくよみちゃん、アンジーさん、アルマちゃん、朱花、ディアちゃん、KANA、金苗、リリンちゃん、MANA）が利用可能で、それぞれ異なる性格と音声特性を持ちます。

## コマンドライン互換性

### say-coeiroink
macOS `say`コマンド互換の音声合成CLI
- **基本使用**: `say-coeiroink "テキスト"`
- **音声指定**: `say-coeiroink -v voice_id "テキスト"`
- **話速指定**: `say-coeiroink -r 200 "テキスト"`
- **ファイル出力**: `say-coeiroink -o output.wav "テキスト"`

### operator-manager
オペレータ管理専用CLI
- **割り当て**: `operator-manager assign [operator_id]`
- **状況確認**: `operator-manager status`
- **解放**: `operator-manager release`
- **利用可能一覧**: `operator-manager available`

---
**作成日**: 2025年8月5日  
**更新日**: 2025年8月5日 (ドキュメント再構成)
**関連ファイル**: 
- **[CHARACTERS.md](../docs/CHARACTERS.md)** - オペレータキャラクター詳細
- **[UPDATE_CHARACTER_SETTINGS.md](UPDATE_CHARACTER_SETTINGS.md)** - キャラクター設定更新手順
- **[../INSTALLATION.md](../INSTALLATION.md)** - インストールガイド
- **[../README.md](../README.md)** - プロジェクト概要
- `~/.coeiro-operator/operator-config.json` - オペレータ設定
- `~/.coeiro-operator/coeiroink-config.json` - 音声合成設定