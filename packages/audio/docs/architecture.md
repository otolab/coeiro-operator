# アーキテクチャ概要

## 重要な発見：TaskQueueは実はOrchestrator

「TaskQueue」という名前から単純なキューだと思い込んでいたが、実際の責務は：
- 処理フローの制御（processQueue）
- 処理の委譲と調整（processCallback）
- 全体の同期管理（waitForAllTasks）
- エラーの集約（errors配列）
- タスクのライフサイクル管理（abort/retry）

**これは完全にOrchestratorパターン**である。設計として適切で、関心の分離ができており、依存性の逆転で柔軟性を確保、テスタブルである。

## アーキテクチャの改善状況

### ✅ 修正済み：SynthesisProcessorのフラット化

以前は`playStreamingAudio(synthesizeStream(...))`のようにネストした呼び出しだったが、現在は音声合成と音声再生を同じ階層で順次実行するようフラット化済み。

### 📋 未実施：名前を実態に合わせる

現在：TaskQueue, SpeechQueue, SynthesisProcessor
提案：TaskOrchestrator, SpeechTaskOrchestrator, SpeechProcessor

※ 後方互換性のため、名前の変更は慎重に検討中

## 現在の課題

### ChunkGenerationManagerのPromiseエラーハンドリング
並行チャンク生成でPromiseのエラーハンドリングが不完全。TaskQueueのOpenPromiseパターンを参考に修正が必要。詳細は `chunk-generation-manager-spec.md` 参照。

## 実装ドキュメント

複数ファイルにまたがる処理フロー・パターンの詳細は以下を参照：
- `task-orchestration.md` - TaskQueueのOrchestrationパターン、OpenPromise、エラー伝播、非同期処理
- `chunk-generation-manager-spec.md` - 並行チャンク生成の仕様と実装