# COEIRO Operator プロジェクト用設定

## MCP Tools ガイド

code-bugs MCPツールの詳細な使用方法については、以下のファイルを参照してください：

- [MCP Tools 使用ガイド](./prompts/MCP_TOOLS_USAGE_GUIDE.md)
  - @prompts/MCP_TOOLS_USAGE_GUIDE.md

このファイルには以下の情報が含まれています：
- 利用可能なMCPサーバーの概要
- 各ツールの詳細な引数と使用例
- 解析タイプの説明
- 典型的なワークフローとベストプラクティス

## コマンド実行環境

### テスト実行
```bash
npm test
```

### 型チェック
```bash
npm run type-check
```

### ビルド
```bash
npm run build
```

## プロジェクト構成

- `src/core/operator/`: オペレータ管理機能
- `src/core/say/`: 音声出力機能  
- `src/core/environment/`: 環境情報管理（VoiceProvider等）
- `src/cli/`: コマンドラインツール
- `src/mcp/`: MCPサーバー
- `src/utils/`: ユーティリティ（ロガーシステム等）
- `src/mcp-debug/`: MCPデバッグ環境
  - `test/echo-server.ts`: Echo Back MCPサーバー
  - `test/integration.test.ts`: 統合テストシステム
  - `logger/`: 拡張ロガーシステム
  - `control/`: 制御コマンドハンドラー
  - `output/`: 出力管理システム
- `prompts/`: システムプロンプトとガイド
- `docs/`: プロジェクトドキュメント
  - `development-tips.md`: 開発テクニック・Tips集
  - `audio-streaming-guide.md`: 音声ストリーミング再生システムガイド
  - `voice-provider-system.md`: VoiceProviderシステムガイド
  - `mcp-debug-guide.md`: MCPデバッグ環境ガイド

## 音声設定

### 設定ファイル

音声システムの設定は `~/.coeiro-operator/coeiroink-config.json` で管理されます。

#### 主要設定項目

- `splitMode`: テキスト分割モード (`'punctuation'`, `'none'`, `'small'`, `'medium'`, `'large'`, `'auto'`)
- `bufferSize`: スピーカーバッファサイズ（256-8192バイト）
- `chunkSizeSmall/Medium/Large`: 各モードでの分割サイズ（文字数）
- `overlapRatio`: オーバーラップ比率（0.0-1.0）

詳細は [`docs/audio-streaming-guide.md`](./docs/audio-streaming-guide.md) を参照してください。

## 開発時の重要なテクニック

### MCPサーバーの再起動
コード変更後にMCPサーバーを再起動するには：
```bash
claude mcp remove coeiro-operator -s local
claude mcp add coeiro-operator ./dist/mcp/server.js
```
この方法により変更が確実に反映されます。詳細は`docs/development-tips.md`を参照。

### MCPサーバーのデバッグモード

MCPサーバーは2つのモードで動作します：

#### 通常モード（デフォルト）
```bash
node dist/mcp/server.js
```
- 非同期音声再生（`synthesizeTextAsync()`使用）
- 簡潔なログ出力
- MCPサーバーとしての標準動作

#### デバッグモード
```bash
node dist/mcp/server.js --debug
# または
node dist/mcp/server.js -d
```
- 同期音声再生（`synthesizeTextInternal()`使用）
- 詳細なデバッグログ出力
- 設定情報とパラメータの詳細表示
- 開発・テスト用途

### MCPデバッグ環境

プロジェクトには包括的なMCPデバッグ環境が実装されています：

#### 主要機能
- **Echo Back MCPサーバー**: テスト用MCPサーバー（`src/mcp-debug/test/echo-server.ts`）
- **統合テストシステム**: 自動化されたMCP機能テスト（100%成功率）
- **制御コマンドシステム**: CTRL:プレフィックスによる制御機能
- **拡張ロガーシステム**: 高性能ログ蓄積機能（0.01ms/ログ）
- **出力チャネル分離**: MCP/Control/Debug/Error出力の分離

#### テスト実行
```bash
# MCPデバッグ統合テスト
./scripts/test-mcp-debug.sh

# COEIRO Operator統合テスト
./test-coeiro-mcp-debug.sh
```

#### 既存システムとの統合
- 既存`src/utils/logger.ts`との完全互換性
- LoggerPresetsを通じた設定管理
- MCPサーバーモードでの自動最適化

詳細は [`docs/mcp-debug-guide.md`](./docs/mcp-debug-guide.md) を参照してください。

### 開発フロー
1. コード修正
2. `npm run build` でビルド
3. MCPサーバー再起動（上記コマンド）
4. Claude Codeでツール動作確認

これにより開発効率が大幅に向上します。
