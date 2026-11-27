# 開発テクニック・メモ

## 🔗 関連ドキュメント

- [`docs/testing-guide.md`](./testing-guide.md) - テスト実行環境とmcp-debug統合
- [`docs/test-quality-guidelines.md`](./test-quality-guidelines.md) - テスト品質の基本原則

## 🛠️ 開発環境構築

### 事前要件

- **Node.js 18以上**
- **pnpm 9以上** - 推奨パッケージマネージャー
- **COEIROINK** - 音声合成エンジン（localhost:50032で動作）
- **ビルドツール** - ネイティブモジュール構築用
  - Windows: Visual Studio Build Tools
  - macOS: Xcode Command Line Tools
  - Linux: build-essential + ALSA/PulseAudio開発ライブラリ

### ソースからのインストール

```bash
git clone https://github.com/otolab/coeiro-operator.git
cd coeiro-operator
pnpm install
pnpm build
pnpm link --global
```

### 基本開発コマンド

```bash
# ビルド・型チェック
pnpm build
pnpm type-check

# テスト実行
pnpm test                        # 単体テスト（サイレントモード）
TEST_VERBOSE=true pnpm test      # 単体テスト（詳細出力）
pnpm test:e2e                   # E2Eテスト
./scripts/test-mcp-debug.sh    # MCPデバッグテスト
```

### プロジェクト構成

```
packages/
├── audio/                 # 音声処理システム
├── cli/                   # CLIツール
├── common/                # 共通ユーティリティ
├── core/                  # コア機能
│   ├── src/
│   │   ├── operator/     # オペレータ管理
│   │   │   ├── index.ts  # OperatorManager
│   │   │   ├── config-manager.ts # 設定管理
│   │   │   ├── file-operation-manager.ts # 期限付きKVストレージ
│   │   │   └── character-info-service.ts # キャラクター情報
│   │   ├── dictionary/   # 辞書管理
│   │   ├── environment/  # 環境情報
│   │   └── terminal-background/ # ターミナル背景画像
├── mcp/                   # MCPサーバー
├── mcp-debug/             # MCPデバッグ環境
└── term-bg/               # iTerm2背景画像制御
```

### 統合アーキテクチャ

#### OperatorManager統合構造
```
OperatorManager (統合管理クラス)
├── FileOperationManager<string> (内部状態管理)
├── CharacterInfoService (キャラクター情報)
└── ConfigManager (設定管理)
```

#### 主要コンポーネント

- **OperatorManager** (`packages/core/src/operator/index.ts`): オペレータ統合管理
  - 状態管理、キャラクター情報、設定管理を統合
  - 外部公開API：予約、解放、状態確認、設定更新
  - 内部で FileOperationManager<CharacterSession> を使用

- **FileOperationManager<T>** (`packages/core/src/operator/file-operation-manager.ts`): 汎用期限付きKVストレージ
  - ジェネリクス対応: 任意のデータ型T
  - タイムアウト管理: 自動期限切れ処理
  - API: `store(data: T)`, `restore(): T | null`, `refresh(): boolean`

- **CharacterInfoService** (`packages/core/src/operator/character-info-service.ts`): キャラクター情報専門
  - キャラクター情報取得、スタイル選択、音声設定更新


### Queue統一実装の主要コンポーネント

- **SpeechQueue** (`packages/audio/src/speech-queue.ts`): 音声タスクの統一管理
  - タスクタイプ: `speech`, `warmup`, `completion_wait`
  - CLI/MCP実行モード対応
  - 同期/非同期処理の抽象化

- **SayCoeiroink** (`packages/audio/src/index.ts`): 音声合成システム
  - CLI用: `synthesizeText()` 同期処理（ウォームアップ→音声→完了待機）
  - MCP用: `synthesize()` 非同期キューイング（即座にレスポンス）

## MCP サーバー開発

### ⚠️ 重要：開発中のコードテストについて

**Claude Code起動中のMCPツール（sayツール等）は開発テストに使用できません**

- Claude Code起動時からMCPサーバーインスタンスが起動したままのため
- コードの更新（pnpm build後）が反映されない
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
node dist/mcp/server.js --debug

# 分割モード動作の確認（ログで "Using punctuation-based splitting" を確認）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"これは最初の文です。これは二番目の文です。"}},"id":1}' | node dist/mcp/server.js --debug
```

#### 音声合成テストコマンド例

##### 基本的な音声合成テスト
```bash
# 1. MCPサーバー初期化
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' | node dist/mcp/server.js

# 2. サーバー初期化完了通知
echo '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' | node dist/mcp/server.js

# 3. オペレータ割り当て
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{}},"id":2}' | node dist/mcp/server.js

# 4. 音声合成テスト（句読点分割モード確認）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":3}' | node dist/mcp/server.js
```

##### パフォーマンステスト
```bash
# 並行生成システムの性能テスト（長文）
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"リファクタリング後のテスト音声です。チャンク生成管理システムが正常に動作していることを確認します。並行生成機能により、複数のチャンクが同時に処理され、レイテンシが大幅に改善されています。"}},"id":4}' | node dist/mcp/server.js

# 話速調整テスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"話速テストです。","rate":150}},"id":5}' | node dist/mcp/server.js
```

##### 設定変更テスト
```bash
# 並行生成設定の変更
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"parallel_generation_control","arguments":{"maxConcurrency":3}},"id":6}' | node dist/mcp/server.js

# ログレベル変更（デバッグモード）
node dist/mcp/server.js --debug

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
- **統合テスト**: システム全体の動作確認
- **エラーハンドリング**: 異常系処理の確認

### 推奨開発フロー

#### 🚀 開発・テストフロー（推奨）

```bash
# 1. コード修正
pnpm build

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
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"テスト音声です。"}},"id":1}' | \
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
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"speechText":"リファクタリング後のテスト音声です。チャンク生成管理システムが正常に動作していることを確認します。"}},"id":2}' | node dist/mcp/server.js --debug

# 3. ログで分割処理や並行生成の動作を確認
# デバッグログで"SYNTHESIZE_STREAM DEBUG"や"ChunkGenerationManager"の出力を確認
```

Jest E2Eテストにより、開発効率が大幅に向上し、自動化されたテストで品質を保証できます。

## ユーティリティスクリプト

### scripts/ディレクトリのツール

```bash
# COEIROINKから利用可能なスピーカー情報を取得
node scripts/get-speakers.js

# ダウンロード可能なスピーカー一覧を取得
node scripts/get-downloadable-speakers.js

# ユーザー辞書に単語を登録（読み方・アクセント設定）
node scripts/register-words.js
```

これらのスクリプトはCOEIROINK APIから情報を取得して、キャラクター設定の開発に役立ちます。

## その他の開発テクニック

### ビルドとテストの自動化
```bash
# 変更検出とビルド
pnpm build && pnpm type-check && pnpm test
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

**動作仕様：**
- 存在しないスタイルを指定した場合、エラーで停止せずに処理を続行
- 警告メッセージで問題を通知し、デフォルトスタイルが自動選択される
- CLIスクリプトでの堅牢性が確保される

### 音声合成 (say-coeiroink)

#### COEIROINKサーバー接続エラー

**対処方法：**
1. COEIROINKサーバーが起動していることを確認
2. 設定ファイル `~/.coeiro-operator/config.json` でサーバー情報を確認
3. ネットワーク接続を確認