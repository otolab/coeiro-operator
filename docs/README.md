# coeiro-operator ドキュメント

このディレクトリには、ユーザー向けガイドと開発・設計資料をまとめています。

## ユーザーガイド

- [インストールガイド](user-guide/installation.md) - セットアップ手順
- [設定ガイド](user-guide/configuration-guide.md) - 設定方法
- [キャラクター一覧](user-guide/CHARACTERS.md) - 利用できるキャラクター
- [ユーザー辞書ガイド](user-guide/user-dictionary-guide.md) - 読み方のカスタマイズ
- [デバッグガイド](user-guide/debugging-guide.md) - トラブルシューティング

## アーキテクチャ

- [音声アーキテクチャ](architecture/voice-architecture.md) - 音声合成システム
- [音声システム](architecture/audio-system.md) - 音声処理の構成
- [音声再生パイプライン](architecture/audio-playback.md) - 合成から再生までの流れ
- [音声キューシステム](architecture/speech-queue-system.md) - 非同期キュー処理
- [音声プロバイダーシステム](architecture/voice-provider-system.md) - 音声エンジンの抽象化
- [オペレータ割り当て仕様](architecture/operator-assignment-specification.md) - セッションと予約管理
- [汎用ファイル操作マネージャー](architecture/generic-file-operation-manager.md) - ファイル操作の管理
- [ADR-0001: MCP TypeScript SDK v2への移行](architecture/adr/0001-mcp-typescript-sdk-v2.md)

## 機能ガイド

- [音声ストリーミングガイド](features/audio-streaming-guide.md)
- [並行生成システム](features/parallel-generation-system.md)
- [MCP非同期音声出力](features/mcp-async-say-behavior.md)
- [音声速度仕様](speech-rate-specification.md)

## 開発者向け

- [開発のヒント](development/development-tips.md)
- [テストガイド](development/testing-guide.md)
- [テスト戦略ガイド](development/test-strategy-guide.md)
- [テスト品質ガイドライン](development/test-quality-guidelines.md)
- [ロギングガイドライン](development/logging-guidelines.md)
- [メモリリーク検出ガイド](development/memory-leak-detection-guide.md)
- [音声合成手法の分析](development/synthesis-methods-analysis.md)
- [キャラクター登録の実装計画](development/character-registration-implementation-plan.md)

## 調査資料

- [Speakerライフサイクル調査](reports/deep-research.speaker-lifecycle.v1.md)
- [音声再生単位の分析](reports/playback-units-analysis.md)

## MCP Debug

- [概要](mcp-debug/README.md)
- [アーキテクチャ](mcp-debug/architecture.md)
- [MCPデバッグガイド](mcp-debug/mcp-debug-guide.md)
- [ライブラリAPI](mcp-debug/library-api.md)
- [テスト機能](mcp-debug/testing-features.md)
- [MCPデバッグテスト](mcp-debug/mcp-debug-testing.md)
- [E2Eテスト](mcp-debug/e2e-testing.md)
- [MCPプロトコル仕様](mcp-debug/mcp-protocol-specification.md)
- [MCPプロトコルのベストプラクティス](mcp-debug/mcp-protocol-best-practices.md)
- [stdinフロー制御の調査](mcp-debug/research.stdin-flow-control.v1.md)

## 設定サンプル

- [サンプルの説明](config-samples/README.md)
- [balanced.json](config-samples/balanced.json)
- [default-split-mode-config.json](config-samples/default-split-mode-config.json)
- [high-quality.json](config-samples/high-quality.json)
- [punctuation-test-config.json](config-samples/punctuation-test-config.json)
- [ultra-low-latency.json](config-samples/ultra-low-latency.json)

## MCPで配布する利用スキル

基本 Skill と operator-mode Skill は [`@coeiro-operator/mcp` の README](../packages/mcp/README.md) で案内しています。実体は [`packages/mcp/skills/`](../packages/mcp/skills/) にあります。

## クイックアクセス

**初めての方**: [インストール](user-guide/installation.md) → [設定](user-guide/configuration-guide.md)

**開発者**: [開発のヒント](development/development-tips.md) → [テスト](development/testing-guide.md)

**問題解決**: [デバッグ](user-guide/debugging-guide.md)

---

ドキュメントに不足や誤りがあれば、[GitHub Issues](https://github.com/otolab/coeiro-operator/issues) でお知らせください。
