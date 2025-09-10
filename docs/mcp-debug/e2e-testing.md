# MCP E2Eテストモード

MCPサーバーをプログラマティックにテストするためのシンプルなライブラリです。

## 概要

E2Eテストモードは、MCPサーバーをJest、Mocha、Vitestなどのテストフレームワークから制御するためのツールです。

## 基本的な使い方

```typescript
import { createMCPTester } from 'coeiro-operator/mcp-debug';

// テスターを作成して起動
const tester = await createMCPTester({
  serverPath: 'dist/mcp/server.js',
  debug: false,
  timeout: 30000
});

// ツールを呼び出し
const result = await tester.callTool('operator_status', {});
console.log(result);

// 必ずクリーンアップ
await tester.cleanup();
```

## テストフレームワークとの統合

### Jest/Vitest

```typescript
import { createMCPTester, MCPServiceE2ETester } from 'coeiro-operator/mcp-debug';

describe('MCP Server', () => {
  let tester: MCPServiceE2ETester;
  
  beforeEach(async () => {
    tester = await createMCPTester({
      serverPath: 'dist/mcp/server.js'
    });
  });
  
  afterEach(async () => {
    await tester.cleanup();
  });
  
  it('should call tool successfully', async () => {
    const result = await tester.callTool('operator_status', {});
    expect(result.success).toBe(true);
  });
});
```

### Mocha

```typescript
import { createMCPTester } from 'coeiro-operator/mcp-debug';
import { expect } from 'chai';

describe('MCP Server', () => {
  let tester;
  
  beforeEach(async () => {
    tester = await createMCPTester({
      serverPath: 'dist/mcp/server.js'
    });
  });
  
  afterEach(async () => {
    await tester.cleanup();
  });
  
  it('should call tool successfully', async () => {
    const result = await tester.callTool('operator_status', {});
    expect(result.success).to.be.true;
  });
});
```

## API リファレンス

### createMCPTester(options)

MCPテスターを作成して起動します。

**パラメータ:**
- `options.serverPath`: MCPサーバーのパス
- `options.debug`: デバッグログを出力（デフォルト: false）
- `options.timeout`: サーバー起動タイムアウト（デフォルト: 30000ms）
- `options.requestTimeout`: リクエストタイムアウト（デフォルト: 10000ms）

**戻り値:** `Promise<MCPServiceE2ETester>`

### MCPServiceE2ETester

#### メソッド

##### `callTool(name, args?): Promise<ToolCallResult>`
ツールを呼び出します。

##### `callToolsSequentially(calls): Promise<ToolCallResult[]>`
複数のツールを順次呼び出します。

##### `callToolsConcurrently(calls): Promise<ToolCallResult[]>`
複数のツールを並行して呼び出します。

##### `getStatus(): ServerStatus`
サーバーの状態を取得します。

##### `getAvailableTools(): string[]`
利用可能なツール一覧を取得します。

##### `waitUntilReady(timeout?): Promise<void>`
サーバーが準備完了するまで待機します。

##### `waitForState(state, timeout?): Promise<void>`
特定の状態になるまで待機します。

##### `restart(): Promise<void>`
サーバーを再起動します。

##### `stop(): Promise<void>`
サーバーを停止します。

##### `cleanup(): Promise<void>`
リソースをクリーンアップします。

##### `getLogs(filter?): Array<LogEntry>`
サーバーのログを取得します。

**フィルターオプション:**
- `level`: 'stdout' | 'stderr' - ログレベルでフィルター
- `since`: Date - 指定日時以降のログのみ
- `limit`: number - 取得する最大ログ数

##### `clearLogs(): void`
保存されているログをクリアします。

### 型定義

```typescript
interface ToolCallResult {
  success: boolean;
  result?: any;
  error?: Error;
  duration?: number;
}

interface ServerStatus {
  state: MCPServerState;
  isReady: boolean;
  pendingRequests: number;
  capabilities?: any;
}

interface LogEntry {
  timestamp: Date;
  level: 'stdout' | 'stderr';
  message: string;
}
```

## 実践的な例

### パフォーマンステスト

```typescript
const tester = await createMCPTester({ serverPath: 'dist/mcp/server.js' });

try {
  const calls = Array.from({ length: 100 }, () => ({
    name: 'operator_status',
    args: {}
  }));
  
  const start = Date.now();
  const results = await tester.callToolsConcurrently(calls);
  const duration = Date.now() - start;
  
  console.log(`100 calls in ${duration}ms`);
  console.log(`Average: ${duration / 100}ms per call`);
} finally {
  await tester.cleanup();
}
```

### エラーハンドリング

```typescript
const tester = await createMCPTester({ serverPath: 'dist/mcp/server.js' });

try {
  const result = await tester.callTool('invalid_tool', {});
  
  if (!result.success) {
    console.error('Tool call failed:', result.error);
  }
} finally {
  await tester.cleanup();
}
```

### ログの取得と分析

```typescript
const tester = await createMCPTester({ 
  serverPath: 'dist/mcp/server.js',
  debug: false  // debugがfalseでもログは収集される
});

try {
  // いくつかの操作を実行
  await tester.callTool('operator_status', {});
  
  // 全ログを取得
  const allLogs = tester.getLogs();
  console.log(`Total logs: ${allLogs.length}`);
  
  // stderrログのみ取得
  const errorLogs = tester.getLogs({ level: 'stderr' });
  console.log(`Error logs: ${errorLogs.length}`);
  
  // 最新10件のログ
  const recentLogs = tester.getLogs({ limit: 10 });
  recentLogs.forEach(log => {
    console.log(`[${log.level}] ${log.message}`);
  });
  
  // 特定時刻以降のログ
  const since = new Date(Date.now() - 5000); // 5秒前
  const recentErrorLogs = tester.getLogs({ 
    level: 'stderr', 
    since,
    limit: 100 
  });
  
} finally {
  await tester.cleanup();
}
```

## トラブルシューティング

### タイムアウトエラー

```typescript
// タイムアウトを長めに設定
const tester = await createMCPTester({
  serverPath: 'dist/mcp/server.js',
  timeout: 60000,  // 60秒
  requestTimeout: 30000  // 30秒
});
```

### デバッグモード

```typescript
// 詳細なログを出力
const tester = await createMCPTester({
  serverPath: 'dist/mcp/server.js',
  debug: true
});
```

## 関連ドキュメント

- [MCPプロトコル仕様](./mcp-protocol-specification.md)
- [MCPデバッグガイド](./mcp-debug-guide.md)