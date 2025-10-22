# @coeiro-operator/mcp-debug

## 1.0.1

### Patch Changes

- 91c4359: mcp-debug: 非インタラクティブモードの流量制御を改善

  ### 修正内容
  - 複数のJSON-RPCリクエストを連続投入した際に発生する「Server not ready」エラーを修正
  - キューイングシステムを実装し、リクエストを順次処理するように改善
  - 全リクエスト完了待機処理を追加し、非TTY環境でのクリーンなシャットダウンを実現

  ### テスト追加
  - 複数リクエストの順次処理を検証するテストケースを追加
  - エラーハンドリングのテストを強化

- d484e61: docs: mcp-debugパッケージにREADMEとライブラリAPIドキュメントを追加

  ### 変更内容
  - packages/mcp-debug/README.md: 使い方とAPIリファレンスを追加
    - npx経由での実行方法を追加
    - E2Eテストでのライブラリ使用例を追加
    - MCPサーバープロセスの説明を正確に修正
  - docs/mcp-debug/library-api.md: ライブラリAPIの詳細ドキュメントを追加
