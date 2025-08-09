# 開発テクニック・メモ

## MCP サーバー開発

### MCPサーバーの再起動方法

開発中にMCPサーバーの変更を反映させるには、Claude Codeで以下のコマンドを使用：

```bash
# 現在のMCPサーバーを削除
claude mcp remove coeiro-operator

# 再度MCPサーバーを追加（最新のコードで起動）
claude mcp add coeiro-operator
```

**利点：**
- プロセスの完全な再起動により、コード変更が確実に反映される
- キャッシュされた設定やモジュールがクリアされる
- 開発中のデバッグに有効

**使用タイミング：**
- TypeScriptファイルを変更した後
- 設定ファイル（.mcp.json等）を変更した後
- MCPツールの動作に問題がある場合
- モジュールの依存関係を変更した後

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

### 開発フロー例

```bash
# 1. コード修正
npm run build

# 2. Jest E2Eテスト（推奨）
npm run test:e2e

# 3. シェルベースのテスト（オプション）
./scripts/test-mcp-debug.sh

# 4. MCPサーバー再起動
claude mcp remove coeiro-operator
claude mcp add coeiro-operator

# 5. 動作確認
# Claude Codeでoperator_assignやsayツールをテスト
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