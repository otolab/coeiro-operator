# COEIRO Operator - AI Agent開発ガイド

AI Agent（Claude Code等）向けのプロジェクト開発リファレンス・インデックス

以下のファイルを読み込んでください:
* @prompts/README.md
  - 作業内容が確定したら必要なガイドを読み込んでください
* @docs/README.md
* @prompts/docs-code-sync.md - ドキュメントとコードの同期に関する重要な指針

## 📋 基本情報

**プロジェクト詳細**: `README.md` を参照

## 🛠️ MCPサーバー開発

### MCPサーバーとは
**MCP (Model Context Protocol)** は生成AIエージェントの拡張プラグインのデファクトスタンダード規格です。

**重要な概念理解:**
- **MCPサーバー**: 生成AIエージェント（クライアント）からの依頼を受けて応答を返すプログラム
- **動作形態**: エージェントが起動する**子プロセス**として管理される
- **通信方式**: stdio/stdoutを用いた**JSON-RPC**による通信
- **注意点**: 「MCPサーバー」という名前だが、ネットワークサービスにおけるクライアント・サーバモデルとは異なる

このプロジェクトのMCPサーバー (`packages/mcp/src/server.ts`) は:
- 端末内で動くAIエージェントから起動される
- エージェントが音声再生を行うことを支援する機能を提供
- ターミナル背景画像の制御など、端末環境と連携した機能も持つ

### 開発テスト方法
**⚠️ 重要：** Claude Code起動中のMCPツールでは編集したコードの変更が反映されません。

この問題を解決するため、`packages/mcp-debug` にデバッグ用CLIツールを提供しています。

**詳細**: `docs/mcp-debug/mcp-debug-guide.md` を参照

開発・テスト時の例（非インタラクティブモード）：
```bash
# MCPツールをテスト
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト"}},"id":1}' | \
  node dist/mcp-debug/cli.js dist/mcp/server.js
```

## 📖 ドキュメントインデックス

### 📑 メインインデックス
- `prompts/README.md` - プロンプト・ガイドインデックス
- `docs/README.md` - ドキュメント完全インデックス

### 📖 ユーザーガイド (`docs/user-guide/`)
- `installation.md` - インストールガイド
- `configuration-guide.md` - 設定・カスタマイズガイド
- `CHARACTERS.md` - オペレータキャラクター詳細
- `user-dictionary-guide.md` - ユーザー辞書ガイド
- `debugging-guide.md` - デバッグガイド

### 🏗️ アーキテクチャ (`docs/architecture/`)
- `voice-architecture.md` - 音声アーキテクチャ仕様書
- `audio-system.md` - 音声システム設計
- `speech-queue-system.md` - 音声キューシステム
- `voice-provider-system.md` - VoiceProviderシステム
- `operator-assignment-specification.md` - オペレータ割当仕様
- `generic-file-operation-manager.md` - 汎用ファイル操作管理

### ⚡ 機能ガイド (`docs/features/`)
- `audio-streaming-guide.md` - 音声ストリーミング機能
- `parallel-generation-system.md` - 並行チャンク生成システム
- `mcp-async-say-behavior.md` - MCP非同期音声出力

### 👩‍💻 開発者向け (`docs/development/`)
- `development-tips.md` - 開発テクニック・Tips集
- `testing-guide.md` - テストガイド
- `test-strategy-guide.md` - テスト戦略ガイド
- `test-quality-guidelines.md` - テスト品質ガイドライン
- `logging-guidelines.md` - ロギングガイドライン
- `memory-leak-detection-guide.md` - メモリリーク検出ガイド
- `synthesis-methods-analysis.md` - 音声合成手法分析

### 🔧 MCP Debug (`docs/mcp-debug/`)
- `README.md` - MCP Debug概要
- `mcp-debug-guide.md` - MCPデバッグガイド
- `architecture.md` - MCP Debugアーキテクチャ
- `testing-features.md` - テスト機能
- `mcp-debug-testing.md` - MCPデバッグテスト
- `e2e-testing.md` - E2Eテスト
- `mcp-protocol-specification.md` - MCPプロトコル仕様

### 📋 プロンプト・レシピ (`prompts/`)
- `MCP_TOOLS_USAGE_GUIDE.md` - MCPツール使用ガイド
- `OPERATOR_SYSTEM.md` - オペレータシステム仕様
- `UPDATE_CHARACTER_SETTINGS.md` - キャラクター設定更新ガイド
- `recipes/operator-mode.md` - オペレータモード動作仕様
- `PR_CREATION_GUIDE.md` - PR作成ガイド
- `docs-code-sync.md` - ドキュメントコード同期
- `TERMINOLOGY.md` - 用語集