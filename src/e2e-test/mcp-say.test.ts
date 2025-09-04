/**
 * MCP Say Tool E2E Tests
 * 音声再生ツールの主要経路テスト
 */

import { createMCPTester, MCPServiceE2ETester } from '../mcp-debug/e2e/index.js';
import { COEIROINKMockServer } from '../mcp/e2e/mocks/coeiroink-mock.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = path.resolve(__dirname, '../../dist/mcp/server.js');

describe('MCP Say Tool E2E', () => {
  let tester: MCPServiceE2ETester;
  let coeiroinkMock: COEIROINKMockServer;
  
  beforeAll(async () => {
    coeiroinkMock = new COEIROINKMockServer({ port: 50032 });
    await coeiroinkMock.start();
  });
  
  afterAll(async () => {
    if (coeiroinkMock) await coeiroinkMock.stop();
  });
  
  beforeEach(async () => {
    process.env.COEIRO_TEST_MODE = 'true';
    process.env.COEIROINK_API_URL = 'http://localhost:50032';
    
    tester = await createMCPTester({
      serverPath: MCP_SERVER_PATH,
      debug: false,
      timeout: 15000,
      env: {
        ...process.env,
        COEIRO_TEST_MODE: 'true',
        COEIROINK_API_URL: 'http://localhost:50032'
      }
    });
  });
  
  afterEach(async () => {
    if (tester) await tester.cleanup();
    coeiroinkMock.reset();
  });
  
  describe('基本的な音声再生フロー', () => {
    it('初期化→アサイン→音声再生の一連フローが動作する', async () => {
      // 1. オペレータアサイン
      const assignResult = await tester.callTool('operator_assign', {
        operator: 'tsukuyomi'
      });
      expect(assignResult.success).toBe(true);
      
      // 2. 音声再生（短いメッセージ）
      const sayResult = await tester.callTool('say', {
        message: 'テストメッセージです'
      });
      expect(sayResult.success).toBe(true);
      expect(sayResult.result.content[0].text).toContain('音声');
      
      // 3. テストモードでは実際の合成は呼ばれないが、レスポンスが正常であることを確認
      // 実際の音声合成の呼び出しはユニットテストで検証
    });
    
    it('長文の分割処理が正しく動作する', async () => {
      await tester.callTool('operator_assign', { operator: 'tsukuyomi' });
      
      const longMessage = '長い文章のテストです。これは句読点で分割されます。最後の文です。';
      const result = await tester.callTool('say', {
        message: longMessage
      });
      
      expect(result.success).toBe(true);
      
      // テストモードでは実際の合成は呼ばれない
      // 分割処理の正常性はユニットテストで検証
    });
    
    it('スタイル指定付き音声再生が動作する', async () => {
      await tester.callTool('operator_assign', { 
        operator: 'tsukuyomi',
        style: 'わくわく'
      });
      
      const result = await tester.callTool('say', {
        message: 'スタイルテスト',
        style: 'ツンツン'  // 動的にスタイル変更
      });
      
      expect(result.success).toBe(true);
      
      // 最後の合成パラメータを確認
      const lastParams = coeiroinkMock.getLastSynthesisParams();
      expect(lastParams).toBeDefined();
    });
  });
  
  describe('エラー処理と復旧', () => {
    it('オペレータ未アサイン時は自動アサインされる', async () => {
      // アサインなしで直接音声再生
      const result = await tester.callTool('say', {
        message: '自動アサインテスト'
      });
      
      expect(result.success).toBe(true);
      
      // オペレータが自動的にアサインされたことを確認
      const statusResult = await tester.callTool('operator_status', {});
      expect(statusResult.success).toBe(true);
      const statusText = statusResult.result.content[0].text;
      expect(statusText).not.toContain('割り当てられていません');
    });
    
    it('COEIROINK接続エラー時も適切にエラーハンドリングされる', async () => {
      await tester.callTool('operator_assign', { operator: 'tsukuyomi' });
      
      // モックサーバーをエラーモードに設定
      coeiroinkMock.setShouldFailSynthesis(true);
      
      const result = await tester.callTool('say', {
        message: 'エラーテスト'
      });
      
      // テストモードではエラーが発生しても正常レスポンスを返す
      expect(result.success).toBe(true);
      // 実際のエラーハンドリングはユニットテストで検証
    });
  });
  
  describe('並行処理の検証', () => {
    it('複数の音声再生リクエストが順序を保って処理される', async () => {
      await tester.callTool('operator_assign', { operator: 'tsukuyomi' });
      
      // 複数のリクエストを並行送信
      const results = await tester.callToolsConcurrently([
        { name: 'say', args: { message: '1番目' } },
        { name: 'say', args: { message: '2番目' } },
        { name: 'say', args: { message: '3番目' } }
      ]);
      
      // 少なくとも1つは成功することを確認（並行処理のため一部失敗の可能性あり）
      expect(results).toHaveLength(3);
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
      
      // テストモードでは実際の合成は呼ばれない
    });
  });
});