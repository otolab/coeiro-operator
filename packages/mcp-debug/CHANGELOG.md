# @coeiro-operator/mcp-debug

## 1.3.0

### Minor Changes

- f69e29d: MCP TypeScript SDK v2 へ移行し、Node.js の最低要件を 20 以上に引き上げます。`tools/list` では v1 が明示していた `execution.taskSupport: "forbidden"` が省略されます。MCP 2025-11-25 の既定値も forbidden のため、通常の `tools/call` に機能差はありません。アプリ内の音声キュー task と `wait_for_task_completion` も引き続き利用できます。field の存在に依存する独自 client は、省略時を task 非対応として扱ってください。未登録 tool の応答形式と公開 JSON Schema は現行仕様を維持します。

### Patch Changes

- 716fe6a: CLI の tool 一覧表示が、サーバーの `tools/list` 応答を使うよう修正

  ### 詳細
  - interactive shortcut はページネーションを含む tool 一覧を表示
  - JSON-RPC `tools/list` は要求されたページの応答を返す

- 3a4cc16: mcp-debug package単独でのテスト実行時に共有setupを読み込めるようにします。

## 1.2.1

### Patch Changes

- 30f5690: MCPサーバーとmcp-debugで利用するMCP SDKを1.32.2へ更新しました。

## 1.2.0

### Minor Changes

- 704c583: リソース取得テストインターフェースの追加（listResources/readResource）

## 1.1.0

### Minor Changes

- ba44e15: MCP初期化プロトコルの改善とベストプラクティスガイド追加

  ### 新機能
  - tools/listリクエストのサポート追加
    - MCPProtocolHandler.listTools()メソッド追加
    - MCPDebugClient.getTools()メソッド追加
  - 通知ハンドラー機能の追加
    - notifications/tools/list_changed対応

  ### Breaking Changes
  - MCPServiceE2ETester.getAvailableTools()を非同期メソッドに変更
    - 旧: getAvailableTools(): string[]
    - 新: async getAvailableTools(): Promise<string[]>

  ### 改善
  - capabilities と tools/list の違いを正しく実装
  - listChanged が機能宣言であることを明確化
  - 型安全性の向上（MCPToolsListResponse使用）

  ### ドキュメント
  - MCP Protocol Best Practices Guide 新規作成
  - 初期化プロトコルの正しい理解を解説
  - よくある誤解と解決方法を網羅

### Patch Changes

- aad04a8: 型安全性を大幅に改善
  - sendRequest/callToolメソッドをジェネリクス対応に変更
  - MCPプロトコルの標準型定義を追加・エクスポート
  - ToolCallResultをジェネリクス対応に変更
  - 型安全な使用例ドキュメントを追加

  これにより、テストコードでany型を使う必要がなくなり、型安全にMCPサーバーのテストが記述できるようになりました。

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
