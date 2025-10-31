# 型安全なMCPテストの書き方

`@coeiro-operator/mcp-debug`パッケージは、ジェネリクスを使った型安全なMCPサーバーのテストをサポートしています。

## 基本的な使い方

### 1. 標準型を使った型安全なリクエスト

`sendRequest()`と`callTool()`メソッドは、ジェネリクスで戻り値の型を指定できます。

```typescript
import {
  createMCPTester,
  MCPToolsListResponse,
  MCPToolCallResponse,
  MCPTextContent
} from '@coeiro-operator/mcp-debug';

describe('MCP Server', () => {
  let tester: MCPServiceE2ETester;

  beforeEach(async () => {
    tester = await createMCPTester({ serverPath: 'dist/mcp/server.js' });
  });

  afterEach(async () => {
    await tester.cleanup();
  });

  it('should list tools with type safety', async () => {
    // 型パラメータを指定することで、responseの型が推論される
    const response = await tester.sendRequest<MCPToolsListResponse>('tools/list', {});

    // 型安全: toolsプロパティにアクセスでき、any不要
    const toolNames = response.tools.map(t => t.name);
    expect(toolNames).toContain('operator_status');
  });

  it('should call tool with type safety', async () => {
    // MCPToolCallResponseを使って型安全にツール結果を扱う
    const result = await tester.callTool<MCPToolCallResponse>('index_status', {});

    // 型安全: contentプロパティにアクセス
    const content = result.content?.[0] as MCPTextContent;
    expect(content.type).toBe('text');
    expect(content.text).toBeTruthy();
  });
});
```

### 2. カスタム型を使った型安全なツール呼び出し

独自のツールレスポンス型を定義して使用することもできます。

```typescript
// カスタムレスポンス型を定義
interface OperatorStatusResponse {
  status: 'active' | 'inactive';
  operator: string | null;
  style: string | null;
}

it('should get operator status with custom type', async () => {
  // カスタム型を指定
  const result = await tester.callTool<OperatorStatusResponse>('operator_status', {});

  // 型安全: OperatorStatusResponseのプロパティにアクセス
  expect(result.status).toBe('active');
  if (result.operator) {
    expect(typeof result.operator).toBe('string');
  }
});
```

### 3. E2Eテスター結果の型安全性

`ToolCallResult`もジェネリクスに対応しています。

```typescript
import { ToolCallResult, MCPToolCallResponse } from '@coeiro-operator/mcp-debug';

it('should return typed result', async () => {
  // ToolCallResult<MCPToolCallResponse>として型推論される
  const result = await tester.callTool<MCPToolCallResponse>('test_tool', {});

  if (result.success) {
    // result.resultはMCPToolCallResponse型
    const content = result.result?.content?.[0];
    // ...
  } else {
    // result.errorはError型
    console.error(result.error?.message);
  }
});
```

## 利用可能な標準型

### ツール関連

- `MCPTool`: ツール定義
- `MCPToolsListResponse`: tools/listレスポンス
- `MCPToolCallResponse`: tools/callレスポンス

### コンテンツ関連

- `MCPContent`: コンテンツのユニオン型
- `MCPTextContent`: テキストコンテンツ
- `MCPImageContent`: 画像コンテンツ
- `MCPResourceContent`: リソースコンテンツ

### リソース関連

- `MCPResource`: リソース定義
- `MCPResourcesListResponse`: resources/listレスポンス
- `MCPResourceReadResponse`: resources/readレスポンス

### プロンプト関連

- `MCPPrompt`: プロンプト定義
- `MCPPromptsListResponse`: prompts/listレスポンス
- `MCPPromptGetResponse`: prompts/getレスポンス

### その他

- `MCPLogLevel`: ログレベル
- `MCPLoggingSetLevelParams`: logging/setLevelパラメータ
- `MCPCompletionCompleteParams`: completion/completeパラメータ
- `MCPCompletionCompleteResponse`: completion/completeレスポンス

## 型定義なしの場合

型パラメータを省略すると、`unknown`型として扱われます。

```typescript
// 型パラメータなし → unknown型
const result = await tester.callTool('some_tool', {});

// 型アサーションが必要
const content = (result as any)?.content?.[0]?.text;
```

## まとめ

- `sendRequest<T>()`と`callTool<T>()`でジェネリクスを使った型安全なテストが可能
- MCPプロトコルの標準型を提供
- カスタム型も自由に定義可能
- 型パラメータ省略時は`unknown`型として扱われる

型安全なテストを書くことで、開発体験が向上し、バグを早期に発見できます。
