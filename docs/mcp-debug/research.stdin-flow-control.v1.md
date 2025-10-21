# mcp-debug 標準入力の流量制御問題 調査レポート

**調査日**: 2025-10-21
**対象**: packages/mcp-debug

## 問題の概要

非インタラクティブモードで複数のJSON-RPCリクエストを連続投入すると、以下のエラーが発生する：

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32603,
    "message": "Server not ready. Current state: processing"
  },
  "id": 2
}
```

## 根本原因

### 1. cli.ts の問題 (src/cli.ts:163-192)

`startNonInteractiveMode()` の実装：

```typescript
readline.on('line', (line: string) => {
  inputBuffer += line + '\n';

  try {
    const message = JSON.parse(inputBuffer);
    inputBuffer = '';

    // JSON-RPCリクエストを処理（Promiseを保持）
    currentRequestPromise = this.handleNonInteractiveInput(message).then(() => {
      // ...
    });
  } catch (error) {
    // ...
  }
});
```

**問題点**:
- `readline.on('line', ...)` イベントハンドラは、前のリクエストの完了を待たずに新しい行を処理する
- `currentRequestPromise` を保持しているが、**新しいリクエストが来たときにそれを待たない**
- 複数の行が連続して来ると、それらが**並列に処理される**

### 2. MCPの状態管理の設計

#### state-manager.ts (src/core/state-manager.ts:93-95)

```typescript
canAcceptRequest(): boolean {
  return this._currentState === MCPServerState.READY;
}
```

- `READY` 状態の時だけ新しいリクエストを受け付ける
- `PROCESSING` 状態の時は受け付けない

#### mcp-protocol-handler.ts (src/core/mcp-protocol-handler.ts:112-121)

```typescript
// tools/call の場合は処理中状態に遷移
if (method === 'tools/call') {
  this.stateManager.transitionTo(MCPServerState.PROCESSING);

  // レスポンス後にREADY状態に戻す
  responsePromise.then(
    () => this.stateManager.transitionTo(MCPServerState.READY),
    () => this.stateManager.transitionTo(MCPServerState.READY)
  );
}
```

- `tools/call` リクエストを送信すると `PROCESSING` 状態に遷移
- レスポンスを受け取ると `READY` 状態に戻る

#### mcp-debug-client.ts (src/core/mcp-debug-client.ts:208-210)

```typescript
if (!this.stateManager.canAcceptRequest()) {
  throw new Error(`Server not ready. Current state: ${this.stateManager.currentState}`);
}
```

- `callTool()` は `canAcceptRequest()` をチェック
- `READY` 状態でないとエラーを投げる

### 3. 問題の発生フロー

1. 標準入力から3つのリクエストが連続して到着
2. `readline.on('line', ...)` が各行を受け取るたびに `handleNonInteractiveInput()` を呼び出す
3. 3つのリクエストが**並列に**処理される
4. 最初のリクエストが `PROCESSING` 状態に遷移
5. 2番目と3番目のリクエストは `PROCESSING` 状態で `callTool()` を呼び出す
6. エラー: "Server not ready. Current state: processing"

## 実装方針の検討

### 選択肢1: cli.ts でキューイング（直列処理）

**アプローチ**:
- cli.ts の `startNonInteractiveMode()` で、リクエストをキューに入れる
- 前のリクエストが完了してから次のリクエストを処理する

**メリット**:
- 問題が発生している場所を直接修正
- 非インタラクティブモードの動作が明確

**デメリット**:
- cli.ts だけの解決策
- プログラマティックにクライアントを使う場合は同じ問題が発生する可能性

### 選択肢2: mcp-debug-client.ts で自動的に待機

**アプローチ**:
- `callTool()` と `sendRequest()` で、`PROCESSING` 状態の場合は `READY` 状態になるまで待つ
- `stateManager.waitForState(MCPServerState.READY)` を使用

**メリット**:
- クライアントライブラリが自動的に処理
- どこから呼び出しても安全
- 汎用的な解決策

**デメリット**:
- 意図しない待機が発生する可能性
- デッドロックのリスク（複雑な使い方をした場合）

### 選択肢3: 両方の組み合わせ

**アプローチ**:
- cli.ts で直列処理を実装（確実性）
- mcp-debug-client.ts でも待機機能を追加（安全性）

**メリット**:
- 最も安全で確実
- フェイルセーフ

**デメリット**:
- 実装が複雑
- 過剰な対策かもしれない

## 採用した解決策

**選択肢1: cli.ts でキューイング（直列処理）** ✅ 実装済み

### 選定理由

1. **ユーザー要件に直接対応**: 非インタラクティブモードの「順番に実行される」という要件そのもの
2. **使いやすさ**: AIアシスタントからの動作確認やテストを想定し、リトライなしのシンプルな実装
3. **MCPサーバーの動作観察**: リトライ機能を入れると、サーバーの特性を直接観察できなくなる
4. **設計との整合性**: RequestTrackerの並行処理対応設計を活かせる（将来的な拡張の余地）
5. **リスク最小**: デッドロックや意図しない動作のリスクが低い

### 実装の詳細

#### cli.ts の修正 (src/cli.ts:154-228)

```typescript
private async startNonInteractiveMode(): Promise<void> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let inputBuffer = '';
  const requestQueue: JsonRpcMessage[] = [];
  let isProcessing = false;

  // キューから次のリクエストを処理
  const processNext = async () => {
    if (requestQueue.length === 0) {
      isProcessing = false;
      return;
    }

    isProcessing = true;
    const message = requestQueue.shift()!;

    try {
      await this.handleNonInteractiveInput(message);
    } catch (error) {
      console.error('Error handling request:', error);
    }

    // 次のリクエストを処理
    await processNext();
  };

  readline.on('line', (line: string) => {
    inputBuffer += line + '\n';

    try {
      const message = JSON.parse(inputBuffer);
      inputBuffer = '';

      // リクエストをキューに追加
      requestQueue.push(message);

      // 処理中でなければ次のリクエストを処理開始
      if (!isProcessing) {
        processNext();
      }
    } catch (error) {
      // JSONが不完全な場合は次の行を待つ
      if (!(error instanceof SyntaxError)) {
        console.error('Error parsing input:', error);
        inputBuffer = '';
      }
    }
  });

  readline.on('close', async () => {
    // キュー内の全リクエスト処理完了を待機
    if (isProcessing) {
      while (isProcessing || requestQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // 非インタラクティブモードでは、全リクエスト完了後に終了
    if (!process.stdout.isTTY) {
      setTimeout(() => {
        this.shutdown();
      }, 10);
    } else {
      this.shutdown();
    }
  });
}
```

### テストケースの追加

複数リクエストの順次処理を検証するテストを追加 (src/test/non-interactive-mode.test.ts):

```typescript
it('should handle multiple requests sequentially without errors', async () => {
  // 3つのリクエストを連続送信してエラーなく処理されることを確認
  // 全てのレスポンスが正常に返ることを検証
});
```

### 検証結果

✅ **手動テスト**: 3つのリクエストを連続投入し、全て正常に処理
✅ **既存テスト**: 全てパス（2件）
✅ **新規テスト**: 複数リクエストの順次処理テストをパス（1件追加）

### 却下した選択肢

**選択肢2: mcp-debug-client.ts で自動的に待機**
- RequestTrackerの並行処理対応設計を無効化してしまう
- デッドロックリスクあり
- ユーザーの「投げ直す」という示唆とは異なるアプローチ

**選択肢3: リトライ機能の追加**
- MCPサーバーの動作を直接観察できなくなる
- 意図しない操作になる可能性がある
- 今回の要件（使いやすさ）には不要

## 関連ファイル

- `src/cli.ts:154-205` - startNonInteractiveMode()
- `src/core/mcp-debug-client.ts:203-226` - callTool()
- `src/core/state-manager.ts:93-95` - canAcceptRequest()
- `src/core/mcp-protocol-handler.ts:112-121` - tools/call の状態遷移
- `src/test/non-interactive-mode.test.ts` - 既存テスト（単一リクエストのみ）
