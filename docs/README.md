# coeiro-operator ドキュメント

このディレクトリには、coeiro-operatorプロジェクトの技術文書が整理されています。

## 📁 ドキュメント構成

### 📖 [ユーザーガイド](user-guide/)
セットアップから日常使用まで
- [インストールガイド](user-guide/installation.md) - セットアップ手順
- [設定ガイド](user-guide/configuration-guide.md) - 設定方法
- [キャラクター一覧](user-guide/CHARACTERS.md) - 利用可能なキャラクター
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

### 👩‍💻 [開発者向け](development/)
開発とテストのガイドライン
- [開発のヒント](development/development-tips.md) - 開発効率化
- [テストガイド](development/testing-guide.md) - テストの書き方
- [テスト戦略ガイド](development/test-strategy-guide.md) - テスト設計
- [テスト品質ガイドライン](development/test-quality-guidelines.md) - 品質基準
- [ロギングガイドライン](development/logging-guidelines.md) - ログ出力
- [メモリリーク検出ガイド](development/memory-leak-detection-guide.md) - メモリ管理

### 📊 [調査レポート](reports/)
技術調査と実装提案
- [Speakerライフサイクル調査](reports/deep-research.speaker-lifecycle.v1.md) - インスタンス管理
- [再生停止機能提案](reports/research-report.playback-stop.v1.md) - 実装設計
- [Issue #135 Phase 2調査](reports/research-report.issue135-phase2.v1.md) - キューキャンセル
- [音声キューコントロール調査](reports/research.audio-queue-control.v1.md) - キュー管理

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

**初めての方**: [インストール](user-guide/installation.md) → [設定](user-guide/configuration-guide.md)
**開発者**: [開発のヒント](development/development-tips.md) → [テスト](development/testing-guide.md)  
**問題解決**: [デバッグ](user-guide/debugging-guide.md)

---

📝 **ドキュメントが見つからない場合は、[GitHub Issues](https://github.com/otolab/coeiro-operator/issues)でお知らせください！**