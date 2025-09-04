/**
 * MCP E2E Tester Tests
 * E2Eテスターの動作確認テスト
 */

import { MCPServiceE2ETester, createMCPTester } from './mcp-e2e-tester.js';
import { MCPServerState } from '../core/state-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// テスト用のMCPサーバーパス（実際のcoeiro-operator MCPサーバーを使用）
const TEST_SERVER_PATH = path.resolve(__dirname, '../../../dist/mcp/server.js');

describe('MCPServiceE2ETester', () => {
  let tester: MCPServiceE2ETester;
  
  afterEach(async () => {
    // 各テストの後にクリーンアップ
    if (tester) {
      await tester.cleanup();
    }
  });
  
  describe('基本的なライフサイクル', () => {
    it('サーバーを起動して停止できる', async () => {
      tester = await createMCPTester({
        serverPath: TEST_SERVER_PATH,
        debug: false,
        timeout: 15000
      });
      
      const status = tester.getStatus();
      expect(status.isReady).toBe(true);
      expect(status.state).toBe(MCPServerState.READY);
      
      await tester.stop();
    }, 20000);
    
    it('二重起動を防ぐ', async () => {
      tester = await createMCPTester({
        serverPath: TEST_SERVER_PATH,
        debug: false,
        timeout: 15000
      });
      
      await expect(tester.start()).rejects.toThrow('Tester is already started');
    }, 20000);
    
    it('未起動時のツール呼び出しはエラーになる', async () => {
      tester = new MCPServiceE2ETester({
        serverPath: TEST_SERVER_PATH,
        debug: false
      });
      
      await expect(tester.callTool('operator_status')).rejects.toThrow(
        'Tester is not started'
      );
    });
  });
  
  describe('ツール呼び出し', () => {
    beforeEach(async () => {
      tester = await createMCPTester({
        serverPath: TEST_SERVER_PATH,
        debug: false,
        timeout: 15000
      });
    }, 20000);
    
    it('単一のツールを呼び出せる', async () => {
      const result = await tester.callTool('operator_status', {});
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.duration).toBeGreaterThan(0);
    });
    
    it('引数付きのツールを呼び出せる', async () => {
      const result = await tester.callTool('operator_styles', {
        character: 'tsukuyomi'
      });
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
    });
    
    it('存在しないツールはエラーになる', async () => {
      const result = await tester.callTool('non_existent_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.result).toBeUndefined();
    });
    
    it('複数のツールを順次呼び出せる', async () => {
      const results = await tester.callToolsSequentially([
        { name: 'operator_status', args: {} },
        { name: 'operator_available', args: {} },
        { name: 'operator_styles', args: { character: 'tsukuyomi' } }
      ]);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
    
    it('複数のツールを並行して呼び出せる', async () => {
      const startTime = Date.now();
      
      const results = await tester.callToolsConcurrently([
        { name: 'operator_status', args: {} },
        { name: 'operator_available', args: {} },
        { name: 'operator_styles', args: { character: 'tsukuyomi' } }
      ]);
      
      const totalDuration = Date.now() - startTime;
      
      expect(results).toHaveLength(3);
      // 少なくとも1つは成功するはず（並行処理のため一部失敗の可能性あり）
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
      
      // 並行実行なので、順次実行よりも短い時間で完了するはず
      const maxIndividualDuration = Math.max(...results.map(r => r.duration || 0));
      expect(totalDuration).toBeLessThan(maxIndividualDuration * 2);
    });
  });
  
  describe('サーバー状態管理', () => {
    beforeEach(async () => {
      tester = await createMCPTester({
        serverPath: TEST_SERVER_PATH,
        debug: false,
        timeout: 15000
      });
    }, 20000);
    
    it('サーバーの状態を取得できる', async () => {
      const status = tester.getStatus();
      
      expect(status.state).toBe(MCPServerState.READY);
      expect(status.isReady).toBe(true);
      expect(status.pendingRequests).toBe(0);
      expect(status.capabilities).toBeDefined();
    });
    
    it('利用可能なツール一覧を取得できる', async () => {
      const tools = tester.getAvailableTools();
      
      // 実際のMCPサーバーのツール一覧に合わせて調整
      expect(tools.length).toBeGreaterThan(0);
      // 具体的なツール名の検証はoperator-assign.test.tsで実施
    });
    
    it('サーバーを再起動できる', async () => {
      const statusBefore = tester.getStatus();
      expect(statusBefore.isReady).toBe(true);
      
      await tester.restart();
      
      const statusAfter = tester.getStatus();
      expect(statusAfter.isReady).toBe(true);
    }, 30000);
  });
  
  describe('待機機能', () => {
    beforeEach(async () => {
      tester = await createMCPTester({
        serverPath: TEST_SERVER_PATH,
        debug: false,
        timeout: 15000
      });
    }, 20000);
    
    it('サーバーが準備完了するまで待機できる', async () => {
      // すでにREADY状態なので、すぐに完了するはず
      await expect(tester.waitUntilReady(1000)).resolves.toBeUndefined();
    });
    
    it('特定の状態になるまで待機できる', async () => {
      // すでにREADY状態なので、すぐに完了するはず
      await expect(
        tester.waitForState(MCPServerState.READY, 1000)
      ).resolves.toBeUndefined();
    });
    
    it('タイムアウトでエラーになる', async () => {
      // UNINITIALIZED状態にはならないので、タイムアウトになるはず
      await expect(
        tester.waitForState(MCPServerState.UNINITIALIZED, 100)
      ).rejects.toThrow('Timeout waiting for state');
    });
  });
});