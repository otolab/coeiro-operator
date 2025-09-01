# 📚 COEIRO Operator ドキュメント

COEIRO Operatorの包括的なドキュメント集です。目的別に整理されているので、必要な情報を素早く見つけることができます。

## 🚀 はじめに

### クイックスタート
- **[installation.md](installation.md)** - インストール・セットアップガイド
- **[configuration-guide.md](configuration-guide.md)** - 基本設定・カスタマイズガイド

### キャラクター・オペレータ
- **[CHARACTERS.md](CHARACTERS.md)** - 全オペレータキャラクター詳細
- **[SETTINGS_SYNC_GUIDE.md](SETTINGS_SYNC_GUIDE.md)** - 設定同期ガイド

## 🎵 音声・オーディオシステム

### 基本機能
- **[audio-system.md](audio-system.md)** - 音声システム詳細仕様
- **[speech-queue-system.md](speech-queue-system.md)** - SpeechQueue統一実装システム
- **[audio-streaming-guide.md](audio-streaming-guide.md)** - 音声ストリーミング機能ガイド
- **[parallel-generation-system.md](parallel-generation-system.md)** - 並行チャンク生成システム

### 高度な機能
- **[voice-provider-system.md](voice-provider-system.md)** - VoiceProviderシステム詳細

## ⚙️ 設定・カスタマイズ

### 設定ガイド
- **[configuration-guide.md](configuration-guide.md)** - 設定・カスタマイズ完全ガイド
- **[configuration-options.md](configuration-options.md)** - 設定オプション詳細リファレンス

### 設定サンプル
- **[config-samples/](config-samples/)** - 用途別設定ファイルサンプル
  - [ultra-low-latency.json](config-samples/ultra-low-latency.json) - 超低レイテンシ設定
  - [balanced.json](config-samples/balanced.json) - バランス重視設定
  - [high-quality.json](config-samples/high-quality.json) - 高品質重視設定

## 🛠️ 開発・テスト

### 開発環境
- **[development-tips.md](development-tips.md)** - 開発テクニック・Tips集
- **[debugging-guide.md](debugging-guide.md)** - COEIRO Operatorデバッグガイド
- **[mcp-debug-guide.md](mcp-debug-guide.md)** - MCPデバッグツール基本ガイド
- **[mcp-debug/](mcp-debug/)** - MCPデバッグ詳細ドキュメント
  - [MCPプロトコル仕様](mcp-debug/mcp-protocol-specification.md)
  - [テスト機能](mcp-debug/testing-features.md)
  - [アーキテクチャ設計](mcp-debug/architecture.md)

### テスト・品質管理
- **[testing-guide.md](testing-guide.md)** - テスト環境とmcp-debug統合
- **[test-quality-guidelines.md](test-quality-guidelines.md)** - テスト品質の基本原則
- **[memory-leak-detection-guide.md](memory-leak-detection-guide.md)** - メモリリーク検出・精密測定ガイド
- **[logging-guidelines.md](logging-guidelines.md)** - ログ出力ガイドライン

## 📖 リファレンス

### アーキテクチャ・設計
- **[operator-assignment-specification.md](operator-assignment-specification.md)** - オペレータ割り当て仕様
- **[generic-file-operation-manager.md](generic-file-operation-manager.md)** - 汎用FileOperationManager<T>仕様

### トラブルシューティング・サポート
- **[troubleshooting.md](troubleshooting.md)** - 問題解決ガイド

## 📋 プロジェクト情報

### 変更履歴・リリース
- **[../CHANGELOG.md](../CHANGELOG.md)** - 変更履歴・リリースノート

## 🎯 用途別ガイド

### 🏃 すぐに使いたい
1. [installation.md](installation.md) でインストール
2. [configuration-guide.md](configuration-guide.md) で基本設定
3. [CHARACTERS.md](CHARACTERS.md) でキャラクター選択

### 🔧 カスタマイズしたい
1. [configuration-options.md](configuration-options.md) で設定詳細確認
2. [config-samples/](config-samples/) で設定例参照
3. [audio-system.md](audio-system.md) で音声システム理解

### 🚀 開発に参加したい
1. [development-tips.md](development-tips.md) で開発環境構築
2. [testing-guide.md](testing-guide.md) でテスト方法確認
3. [test-quality-guidelines.md](test-quality-guidelines.md) で品質基準確認

### 🆘 問題が発生した
1. [troubleshooting.md](troubleshooting.md) で解決方法検索
2. [debugging-guide.md](debugging-guide.md) でデバッグ手順確認
3. [mcp-debug-guide.md](mcp-debug-guide.md) でMCPツール使用
4. [logging-guidelines.md](logging-guidelines.md) でログ確認方法確認

---

📝 **ドキュメントが見つからない場合は、[GitHub Issues](https://github.com/otolab/coeiro-operator/issues)でお知らせください！**