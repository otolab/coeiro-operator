# 開発テクニック・メモ

## 🔗 関連ドキュメント

- [`docs/testing-guide.md`](./testing-guide.md) - テスト実行環境とmcp-debug統合
- [`docs/test-quality-guidelines.md`](./test-quality-guidelines.md) - テスト品質の基本原則

## 🛠️ 開発環境構築

### 事前要件

- **Node.js 18以上**
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **ビルドツール** - ネイティブモジュール構築用
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools  
  - Linux: build-essential + ALSA/PulseAudio開発ライブラリ

### ソースからのインストール

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
npm install
npm run build
npm link
```

### 基本開発コマンド

```bash
# ビルド・型チェック
npm run build
npm run type-check

# テスト実行
npm test                        # 単体テスト
npm run test:e2e               # E2Eテスト  
./scripts/test-mcp-debug.sh    # MCPデバッグテスト
```

### プロジェクト構成

```
src/
├── cli/                    # CLIツール
├── core/                   # コア機能
│   ├── operator/           # オペレータ管理 (統合アーキテクチャ)
│   │   ├── index.ts        # 🔄 OperatorManager (統合管理クラス)
│   │   ├── file-operation-manager.ts # 🔄 汎用期限付きKVストレージ<T>
│   │   ├── character-info-service.ts # 🔄 キャラクター情報管理 (旧VoiceSelectionService)
│   │   ├── config-manager.ts # 設定管理
│   │   └── character-defaults.ts # キャラクターデフォルト設定
│   ├── say/               # 音声合成システム (Queue統一実装)
│   │   ├── speech-queue.ts # 🆕 統一音声タスクキュー
│   │   ├── index.ts        # SayCoeiroink (CLI/MCP実行モード別)
│   │   └── ...             # 音声処理コンポーネント
│   └── environment/       # 環境情報管理
├── mcp/                   # MCPサーバー
├── mcp-debug/             # MCPデバッグ環境
└── utils/                 # ユーティリティ
```

### 統合アーキテクチャ (2025年8月更新)

#### OperatorManager統合構造
```
OperatorManager (統合管理クラス)
├── FileOperationManager<string> (内部状態管理)
├── CharacterInfoService (キャラクター情報)
└── ConfigManager (設定管理)
```

#### 主要コンポーネント

- **OperatorManager** (`src/core/operator/index.ts`): オペレータ統合管理
  - 状態管理、キャラクター情報、設定管理を統合
  - 外部公開API：予約、解放、状態確認、設定更新
  - 内部で FileOperationManager<string> を使用

- **FileOperationManager<T>** (`src/core/operator/file-operation-manager.ts`): 汎用期限付きKVストレージ
  - ジェネリクス対応: 任意のデータ型T
  - タイムアウト管理: 自動期限切れ処理
  - API: `store(data: T)`, `restore(): T | null`, `refresh(): boolean`

- **CharacterInfoService** (`src/core/operator/character-info-service.ts`): キャラクター情報専門
  - 旧VoiceSelectionServiceから名前変更・機能整理
  - キャラクター情報取得、スタイル選択、音声設定更新

#### 旧構造からの変更点
- **OperatorStateManager**: OperatorManagerに統合
- **VoiceSelectionService**: CharacterInfoServiceに名前変更
- **FileOperationManager**: 汎用的な期限付きKVストレージに再設計

### Queue統一実装の主要コンポーネント

- **SpeechQueue** (`src/core/say/speech-queue.ts`): 音声タスクの統一管理
  - タスクタイプ: `speech`, `warmup`, `completion_wait`
  - CLI/MCP実行モード対応
  - 同期/非同期処理の抽象化

- **実行モード別API**:
  - `synthesizeText()`: CLI用同期処理（ウォームアップ→音声→完了待機）
  - `synthesizeTextAsync()`: MCP用非同期キューイング（即座にレスポンス）

## MCP サーバー開発

### ⚠️ 重要：開発中のコードテストについて

**Claude Code起動中のMCPツール（sayツール等）は開発テストに使用できません**

- Claude Code起動時からMCPサーバーインスタンスが起動したままのため
- コードの更新（npm run build後）が反映されない
- 開発中の新機能や修正は確認できない

**正しい開発テスト方法：**
1. **mcp-testユーティリティの使用**（推奨）
2. **Jest E2Eテスト**の実行
3. **Echo Back MCPサーバー**での動作確認
4. **手動でのMCPサーバー起動・テスト**

### 開発中のコード変更反映

**⚠️ 重要：** Claude Code起動中のMCPツールでは、編集したコードの変更が反映されません。

開発・テスト時は以下の方法を使用してください：

### MCPデバッグ環境の活用

プロジェクトには包括的なMCPデバッグ環境が実装されています：

#### デバッグテストの実行
```bash
# MCPデバッグ機能の統合テスト
./scripts/test-mcp-debug.sh

# COEIRO Operator統合テスト  
./test-coeiro-mcp-debug.sh
```

#### Echo Back MCPサーバーによるテスト
```bash
# Echo Backサーバーの起動（デバッグモード）
node dist/mcp-debug/test/echo-server.js --debug

# 制御コマンドのテスト
echo "CTRL:status" | node dist/mcp-debug/test/echo-server.js

# JSON-RPCツールのテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"test"}},"id":1}' | node dist/mcp-debug/test/echo-server.js
```

#### MCP-Debug環境を使った高度なテスト

mcp-debug環境は、MCPサーバーの包括的なデバッグ・テスト機能を提供します。

##### mcp-debug CLIの使用方法

本来の設計では、以下のようにターゲットサーバーを指定してデバッグします：

```bash
# 理想的な使用方法（設計通り）
node dist/mcp-debug/cli.js <target-server-file> [options]

# 例：COEIRO OperatorのMCPサーバーをデバッグ
node dist/mcp-debug/cli.js dist/mcp/server.js --debug --auto-reload
node dist/mcp-debug/cli.js dist/mcp/server.js --interactive

# 利用可能なオプション
--debug, -d              # デバッグモード（詳細ログ）
--auto-reload, -r        # ファイル変更時自動リロード
--watch-path <path>      # 監視するパス
--interactive, -i        # インタラクティブモード
```

**インタラクティブモードでの制御コマンド：**
- `status` → `CTRL:target:status` - ターゲットサーバー状態確認
- `restart` → `CTRL:target:restart` - ターゲットサーバー再起動
- `help` → `CTRL:help` - コマンドヘルプ表示
- `exit/quit/q` - CLI終了

##### 現在利用可能な代替手法

mcp-debug環境では、以下の方法でテスト用設定ファイルを使用して特定の動作を検証できます：

##### 設定ファイルを使った動作テスト
```bash
# 句読点分割モードの明示的テスト
node dist/mcp/server.js --config test-configs/punctuation-test-config.json --debug

# splitMode未指定時のデフォルト動作テスト
node dist/mcp/server.js --config test-configs/default-split-mode-config.json --debug
```

**利用可能なテスト設定:**
- `test-configs/punctuation-test-config.json` - 句読点分割モード明示指定
- `test-configs/default-split-mode-config.json` - splitMode未指定（自動punctuation適用確認）

##### Jest統合テストの実行
```bash
# 句読点分割モード専用テスト
npm run test:punctuation

# MCPデバッグ環境統合テスト
npm run test:mcp-debug

# COEIRO Operator E2Eテスト
npm run test:coeiro-e2e
```

##### デバッグログによる動作検証
```bash
# 詳細ログ付きでMCPサーバーを起動
COEIRO_DEBUG=true node dist/mcp/server.js --debug

# 分割モード動作の確認（ログで "Using punctuation-based splitting" を確認）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。"}},"id":1}' | COEIRO_DEBUG=true node dist/mcp/server.js --debug
```

#### 音声合成テストコマンド例

##### 基本的な音声合成テスト
```bash
# 1. MCPサーバー初期化
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' | node dist/mcp/server.js

# 2. サーバー初期化完了通知
echo '{"jsonrpc":"2.0","method":"initialized","params":{}}' | node dist/mcp/server.js

# 3. オペレータ割り当て
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{}},"id":2}' | node dist/mcp/server.js

# 4. 音声合成テスト（句読点分割モード確認）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":3}' | node dist/mcp/server.js
```

##### パフォーマンステスト
```bash
# 並行生成システムの性能テスト（長文）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"リファクタリング後のテスト音声です。チャンク生成管理システムが正常に動作していることを確認します。並行生成機能により、複数のチャンクが同時に処理され、レイテンシが大幅に改善されています。"}},"id":4}' | node dist/mcp/server.js

# 話速調整テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"話速テストです。","rate":150}},"id":5}' | node dist/mcp/server.js
```

##### 設定変更テスト
```bash
# 並行生成設定の変更
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"parallel_generation_control","arguments":{"maxConcurrency":3}},"id":6}' | node dist/mcp/server.js

# ログレベル変更（デバッグモード）
COEIRO_DEBUG=true node dist/mcp/server.js

# 設定状況確認
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"debug_logs","arguments":{"action":"stats"}},"id":7}' | node dist/mcp/server.js
```

#### ログシステムの活用
```bash
# ログ蓄積状況の確認
node --input-type=module -e "
import { logger, LoggerPresets } from './dist/utils/logger.js';
LoggerPresets.debug();
logger.enableAccumulation();
logger.info('テストログ');
console.log('蓄積数:', logger.getLogStats().totalEntries);
"
```

### Jest E2Eテストの実行

プロジェクトにはJestベースのE2Eテストが実装されています：

```bash
# MCPデバッグ環境のE2Eテスト
npm run test:mcp-debug

# COEIRO Operator統合E2Eテスト  
npm run test:coeiro-e2e

# 全E2Eテストの実行
npm run test:e2e

# E2Eテストの監視モード
npm run test:e2e:watch

# 全テスト（ユニット + E2E）
npm run test:all
```

#### E2Eテストの特徴
- **Echo Back MCPサーバー**: 制御コマンド、JSON-RPC、出力分離のテスト
- **パフォーマンステスト**: ログシステムの性能検証（500ログ/秒以上）
- **統合テスト**: 既存システムとMCPデバッグ環境の互換性確認
- **エラーハンドリング**: 異常系処理の確認

### 推奨開発フロー

#### 🚀 開発・テストフロー（推奨）

```bash
# 1. コード修正
npm run build

# 2. 開発テスト（以下のいずれかを使用）

# 【推奨】手動テスト - MCPサーバーを直接起動
node dist/mcp/server.js --debug

# 【推奨】Echo Backサーバーでの基本動作確認
node dist/mcp-debug/test/echo-server.js --debug

# 【自動化】Jest E2Eテスト
npm run test:e2e

# 【詳細確認】シェルベースのテスト
./scripts/test-mcp-debug.sh

# 3. mcp-debugでのテスト（推奨）
# 詳細は docs/mcp-debug-guide.md, docs/mcp-debug/ 参照
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト音声です。"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js

# 4. インタラクティブモードでの対話的テスト
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js
```

#### ⚠️ 非推奨：Claude Code起動中のMCPツール

```bash
# ❌ これは開発テストに使用しない
# Claude Code起動中のMCPツール（sayツール等）では最新コードが反映されない
```

#### 🎯 効率的なデバッグ手順

```bash
# 音声再生の問題をデバッグする場合
# 1. デバッグモードで詳細ログを確認
node dist/mcp/server.js --debug

# 2. JSON-RPCで音声合成をテスト
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{"tools":{}}},"id":1}' | node dist/mcp/server.js --debug
echo '{"jsonrpc":"2.0","method":"initialized","params":{}}' | node dist/mcp/server.js --debug  
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"リファクタリング後のテスト音声です。チャンク生成管理システムが正常に動作していることを確認します。"}},"id":2}' | node dist/mcp/server.js --debug

# 3. ログで分割処理や並行生成の動作を確認
# デバッグログで"SYNTHESIZE_STREAM DEBUG"や"ChunkGenerationManager"の出力を確認
```

Jest E2Eテストにより、開発効率が大幅に向上し、自動化されたテストで品質を保証できます。

## その他の開発テクニック

### ビルドとテストの自動化
```bash
# 変更検出とビルド
npm run build && npm run type-check && npm test
```

### デバッグ用ログ出力
MCPサーバーでは標準エラー出力がClaude Codeに表示されるため：
```typescript
console.error('デバッグ情報:', data);
```

### プロセス確認
```bash
# MCPサーバープロセスの確認
ps aux | grep "node dist/mcp/server.js"
```

## コマンド実行時の注意事項

### オペレータ管理 (operator-manager)

#### スタイル指定の注意点

存在しないスタイルを指定した場合、警告メッセージが表示されてデフォルトスタイルが使用されます：

```bash
# 例：存在しないスタイルを指定
node dist/cli/operator-manager.js assign alma --style=存在しないスタイル

# 出力例：
# オペレータ決定: アルマちゃん (alma)
# スタイル: 表-v2 - 優しく穏やか、思いやりがある
# 指定されたスタイル '存在しないスタイル' が見つかりません。デフォルト選択を使用します。
```

**動作仕様：**
- 指定されたスタイルが見つからない場合、エラーで停止せずに処理を続行
- 警告メッセージで問題を通知
- デフォルトスタイルまたは利用可能な最初のスタイルが自動選択される
- この動作により、CLIスクリプトでの堅牢性が確保される

**有効なスタイル名の確認方法：**
```bash
# 利用可能なオペレータとスタイルを確認
node dist/cli/operator-manager.js available
```

### 音声合成 (say-coeiroink)

#### COEIROINKサーバー接続エラー

音声合成サーバーが起動していない場合、以下のエラーが発生します：

```bash
# 例：サーバー未起動時の実行
echo "テキスト" | node dist/cli/say-coeiroink.js -f - -o output.wav

# エラー例：
# Error: チャンク0合成エラー: HTTP 500: Internal Server Error
```

**対処方法：**
1. COEIROINKサーバーが起動していることを確認
2. 設定ファイル `~/.coeiro-operator/coeiroink-config.json` でサーバー情報を確認
3. ネットワーク接続を確認

この情報により、開発時やトラブルシューティング時の効率が向上します。