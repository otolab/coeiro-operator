---
"@coeiro-operator/mcp": patch
---

MCPサーバーのコード構造をリファクタリング

- server.tsを196行に削減（86%削減、1,354行→196行）
- tools/ディレクトリに機能別ファイルを分割
  - operator.ts, speech.ts, playback.ts, dictionary.ts, debug.ts
- 共通型定義をtypes.tsに集約
- 共通関数をutils.tsに集約
- 包括的なユニットテストを追加（96テスト）
- ツール説明を簡潔化してトークン消費を削減
- parallel_generation_controlツールを一時的に無効化
