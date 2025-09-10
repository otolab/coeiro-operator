# coeiro-operator ドキュメント

このディレクトリには、coeiro-operatorプロジェクトの技術文書が整理されています。

## 📁 ドキュメント構成

### 🚀 [Getting Started](getting-started/)
プロジェクトを始めるための基本情報
- [インストールガイド](getting-started/installation.md) - セットアップ手順
- [設定ガイド](getting-started/configuration-guide.md) - 設定方法
- [トラブルシューティング](getting-started/troubleshooting.md) - 問題解決

### 📖 [ユーザーガイド](user-guide/)
日常的な使用方法とカスタマイズ
- [キャラクター一覧](user-guide/CHARACTERS.md) - 利用可能なキャラクター
- [設定オプション一覧](user-guide/configuration-options.md) - 詳細設定
- [ユーザー辞書ガイド](user-guide/user-dictionary-guide.md) - 読み方カスタマイズ
- [デバッグガイド](user-guide/debugging-guide.md) - デバッグ方法

### 🏗️ [アーキテクチャ](architecture/)
システム設計と内部構造
- [音声アーキテクチャ](architecture/voice-architecture.md) - 音声合成システム設計
- [音声システム](architecture/audio-system.md) - 音声処理の仕組み
- [音声キューシステム](architecture/speech-queue-system.md) - 非同期処理
- [音声プロバイダーシステム](architecture/voice-provider-system.md) - 音声エンジン抽象化
- [オペレータ割り当て仕様](architecture/operator-assignment-specification.md) - オペレータ管理
- [汎用ファイル操作マネージャー](architecture/generic-file-operation-manager.md) - ファイル管理

### ⚡ [機能ガイド](features/)
特定機能の詳細説明
- [音声ストリーミングガイド](features/audio-streaming-guide.md) - リアルタイム音声
- [並行生成システム](features/parallel-generation-system.md) - 高速化機能
- [MCP非同期動作仕様](features/mcp-async-say-behavior.md) - MCP音声合成
- [設定同期ガイド](features/SETTINGS_SYNC_GUIDE.md) - 設定の同期

### 👩‍💻 [開発者向け](development/)
開発とテストのガイドライン
- [開発のヒント](development/development-tips.md) - 開発効率化
- [テストガイド](development/testing-guide.md) - テストの書き方
- [テスト戦略ガイド](development/test-strategy-guide.md) - テスト設計
- [テスト品質ガイドライン](development/test-quality-guidelines.md) - 品質基準
- [ロギングガイドライン](development/logging-guidelines.md) - ログ出力
- [メモリリーク検出ガイド](development/memory-leak-detection-guide.md) - メモリ管理

### 🔧 [MCP Debug](mcp-debug/)
MCPデバッグツール関連
- [README](mcp-debug/README.md) - 概要
- [アーキテクチャ](mcp-debug/architecture.md) - 設計
- [MCPデバッグガイド](mcp-debug/mcp-debug-guide.md) - 使用方法
- [テスト機能](mcp-debug/testing-features.md) - テスト

### 📝 [設定サンプル](config-samples/)
用途別の設定ファイル例
- [README](config-samples/README.md) - サンプルの説明
- 各種設定ファイル（.json）

## 🔍 クイックアクセス

**初めての方**: [インストール](getting-started/installation.md) → [設定](getting-started/configuration-guide.md)  
**開発者**: [開発のヒント](development/development-tips.md) → [テスト](development/testing-guide.md)  
**問題解決**: [デバッグ](user-guide/debugging-guide.md) → [トラブルシューティング](getting-started/troubleshooting.md)

---

📝 **ドキュメントが見つからない場合は、[GitHub Issues](https://github.com/otolab/coeiro-operator/issues)でお知らせください！**