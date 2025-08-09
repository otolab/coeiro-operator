/**
 * Test Setup for MCP Debug Environment
 * MCPデバッグ環境のテストセットアップ
 */

// グローバルテスト設定
beforeAll(() => {
  // テスト環境の設定
  process.env.NODE_ENV = 'test';
  process.env.MCP_DEBUG_TEST_MODE = 'true';
  
  // より長いタイムアウトを設定（統合テストのため）
  jest.setTimeout(20000);
});

afterAll(() => {
  // テスト環境のクリーンアップ
  delete process.env.MCP_DEBUG_TEST_MODE;
});

// 非同期操作のためのヘルパー
(global as any).waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// テスト用ポート範囲（他のテストとの競合を避ける）
(global as any).getTestPort = () => Math.floor(Math.random() * 1000) + 9000;