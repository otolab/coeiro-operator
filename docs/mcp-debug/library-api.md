# mcp-debug ライブラリAPI仕様書

## 概要

`@coeiro-operator/mcp-debug`は、MCPサーバーのE2Eテストを支援するJavaScriptライブラリとして使用できます。

## インストール

```bash
npm install --save-dev @coeiro-operator/mcp-debug
# または
pnpm add -D @coeiro-operator/mcp-debug
```

## 基本的な使い方

### ESM形式

```javascript
import { MCPDebugClient } from '@coeiro-operator/mcp-debug';

const client = new MCPDebugClient({
  serverPath: 'dist/mcp/server.js',
  timeout: 30000,
});

await client.start();
const response = await client.request({
  method: 'tools/call',
  params: { name: 'echo', arguments: { message: 'test' } }
});
await client.stop();
```

### CommonJS形式

```javascript
const { MCPDebugClient } = require('@coeiro-operator/mcp-debug');
```

## APIリファレンス

### MCPDebugClient

MCPサーバーとの通信を管理するクライアントクラス。

#### コンストラクタ

```typescript
new MCPDebugClient(options: MCPDebugClientOptions)
```

##### MCPDebugClientOptions

| プロパティ | 型 | 必須 | デフォルト | 説明 |
|-----------|------|------|------------|------|
| `serverPath` | string | ○ | - | MCPサーバーのファイルパス |
| `timeout` | number | - | 30000 | サーバー起動タイムアウト（ミリ秒） |
| `requestTimeout` | number | - | 10000 | リクエストタイムアウト（ミリ秒） |
| `serverArgs` | string[] | - | [] | サーバーに渡す追加引数 |
| `env` | Record<string, string> | - | {} | サーバープロセスの環境変数 |
| `debug` | boolean | - | false | デバッグログの出力 |

#### メソッド

##### start()

MCPサーバーを起動し、接続を確立します。

```typescript
await client.start(): Promise<void>
```

**例：**
```javascript
await client.start();
// サーバーが起動し、初期化完了
```

##### stop()

MCPサーバーを停止し、リソースをクリーンアップします。

```typescript
await client.stop(): Promise<void>
```

**例：**
```javascript
await client.stop();
// サーバーが正常に終了
```

##### request()

MCPサーバーにJSON-RPCリクエストを送信します。

```typescript
await client.request(request: JSONRPCRequest): Promise<JSONRPCResponse>
```

**パラメータ：**
- `request`: JSON-RPCリクエストオブジェクト
  - `method`: string - 呼び出すメソッド
  - `params`: any - メソッドのパラメータ
  - `id`: string | number - リクエストID（省略可）

**戻り値：**
- JSON-RPCレスポンスオブジェクト

**例：**
```javascript
const response = await client.request({
  method: 'tools/call',
  params: {
    name: 'echo',
    arguments: { message: 'Hello, World!' }
  }
});

console.log(response.result);
```

##### getServerStatus()

サーバーの現在の状態を取得します。

```typescript
client.getServerStatus(): ServerStatus
```

**戻り値：**
```typescript
type ServerStatus = 'stopped' | 'starting' | 'ready' | 'stopping';
```

##### getServerInfo()

サーバーの情報を取得します。

```typescript
await client.getServerInfo(): Promise<ServerInfo>
```

**戻り値：**
```typescript
interface ServerInfo {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}
```

## E2Eテストでの使用例

### Jest/Vitestでの統合

```javascript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { MCPDebugClient } from '@coeiro-operator/mcp-debug';

describe('MCP Server E2E Tests', () => {
  let client;

  beforeAll(async () => {
    client = new MCPDebugClient({
      serverPath: 'dist/mcp/server.js',
      timeout: 30000,
      debug: process.env.DEBUG === 'true',
    });
    await client.start();
  });

  afterAll(async () => {
    if (client) {
      await client.stop();
    }
  });

  test('should list available tools', async () => {
    const response = await client.request({
      method: 'tools/list',
      params: {}
    });

    expect(response.result).toBeDefined();
    expect(Array.isArray(response.result.tools)).toBe(true);
  });

  test('should execute echo tool', async () => {
    const message = 'Test message';
    const response = await client.request({
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message }
      }
    });

    expect(response.result.content).toContain(message);
  });

  test('should handle errors gracefully', async () => {
    const response = await client.request({
      method: 'tools/call',
      params: {
        name: 'non-existent-tool',
        arguments: {}
      }
    });

    expect(response.error).toBeDefined();
    expect(response.error.message).toContain('not found');
  });
});
```

### 並列テストの実行

```javascript
describe('Parallel Tests', () => {
  let clients;

  beforeAll(async () => {
    // 複数のクライアントインスタンスを作成
    clients = await Promise.all([
      createAndStartClient('dist/server1.js'),
      createAndStartClient('dist/server2.js'),
      createAndStartClient('dist/server3.js'),
    ]);
  });

  afterAll(async () => {
    await Promise.all(clients.map(c => c.stop()));
  });

  test('should handle concurrent requests', async () => {
    const results = await Promise.all(
      clients.map((client, index) =>
        client.request({
          method: 'tools/call',
          params: {
            name: 'echo',
            arguments: { message: `Client ${index}` }
          }
        })
      )
    );

    results.forEach((result, index) => {
      expect(result.result.content).toContain(`Client ${index}`);
    });
  });
});

async function createAndStartClient(serverPath) {
  const client = new MCPDebugClient({ serverPath });
  await client.start();
  return client;
}
```

### カスタムアサーション

```javascript
// test-helpers.js
export function expectValidMCPResponse(response) {
  expect(response).toBeDefined();
  expect(response.jsonrpc).toBe('2.0');

  if (response.error) {
    expect(response.error).toHaveProperty('code');
    expect(response.error).toHaveProperty('message');
  } else {
    expect(response.result).toBeDefined();
  }

  return response;
}

// test.js
import { expectValidMCPResponse } from './test-helpers';

test('should return valid MCP response', async () => {
  const response = await client.request({
    method: 'tools/list',
    params: {}
  });

  expectValidMCPResponse(response);
  expect(response.result.tools).toBeInstanceOf(Array);
});
```

## エラーハンドリング

### タイムアウトエラー

```javascript
try {
  const client = new MCPDebugClient({
    serverPath: 'dist/slow-server.js',
    timeout: 5000, // 5秒でタイムアウト
  });
  await client.start();
} catch (error) {
  if (error.message.includes('timeout')) {
    console.error('Server startup timeout');
  }
}
```

### リクエストエラー

```javascript
try {
  const response = await client.request({
    method: 'invalid/method',
    params: {}
  });
} catch (error) {
  console.error('Request failed:', error.message);
}

// またはレスポンスのエラーフィールドをチェック
const response = await client.request({
  method: 'tools/call',
  params: { name: 'invalid-tool' }
});

if (response.error) {
  console.error('Tool error:', response.error.message);
}
```

## ベストプラクティス

### 1. 適切なタイムアウト設定

```javascript
const client = new MCPDebugClient({
  serverPath: 'dist/mcp/server.js',
  timeout: process.env.CI ? 60000 : 30000, // CI環境では長めに設定
  requestTimeout: 15000,
});
```

### 2. リソースのクリーンアップ

```javascript
let client;

try {
  client = new MCPDebugClient({ serverPath });
  await client.start();
  // テスト実行
} finally {
  if (client) {
    await client.stop(); // 必ずクリーンアップ
  }
}
```

### 3. デバッグ情報の活用

```javascript
const client = new MCPDebugClient({
  serverPath: 'dist/mcp/server.js',
  debug: process.env.DEBUG === 'true',
  env: {
    LOG_LEVEL: 'debug',
    NODE_ENV: 'test',
  }
});
```

### 4. テストの独立性確保

```javascript
describe('Independent Tests', () => {
  // 各テストで新しいクライアントを作成
  test('test 1', async () => {
    const client = new MCPDebugClient({ serverPath });
    await client.start();
    try {
      // テスト実行
    } finally {
      await client.stop();
    }
  });

  test('test 2', async () => {
    const client = new MCPDebugClient({ serverPath });
    await client.start();
    try {
      // テスト実行
    } finally {
      await client.stop();
    }
  });
});
```

## トラブルシューティング

### サーバーが起動しない

```javascript
const client = new MCPDebugClient({
  serverPath: 'dist/mcp/server.js',
  debug: true, // デバッグログを有効化
});

client.on('stderr', (data) => {
  console.error('Server error:', data);
});

await client.start();
```

### メモリリーク対策

```javascript
// グローバルスコープでクライアントを保持しない
let globalClient; // ❌ 避ける

// テストごとにクライアントを作成・破棄
describe('Tests', () => {
  let client; // ✅ テストスコープ内で管理

  beforeEach(async () => {
    client = new MCPDebugClient({ serverPath });
    await client.start();
  });

  afterEach(async () => {
    await client.stop();
    client = null; // 参照をクリア
  });
});
```