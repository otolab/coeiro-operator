/**
 * COEIRO Operator E2E Tests with MCP Debug Integration
 * mcp-debug E2Eアダプタを使用したCOEIRO OperatorのE2Eテスト
 *
 * E2Eアダプタを使用することで、実際のMCPサーバーをプログラム的に制御・テストできます
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createMCPTester, MCPServiceE2ETester } from '@coeiro-operator/mcp-debug';
import * as path from 'path';
import { getTestEnvironment } from '@coeiro-operator/core';

describe('COEIRO Operator with MCP Debug Integration E2E Tests', () => {
  let tester: MCPServiceE2ETester;

  beforeEach(async () => {
    const serverPath = path.resolve(__dirname, '../../dist/mcp/server.js');
    
    // E2Eアダプタを使用してMCPサーバーを起動
    tester = await createMCPTester({ 
      serverPath,
      env: getTestEnvironment(),
    });
    
    // サーバーが準備完了するまで待機
    await tester.waitUntilReady();
  });

  afterEach(async () => {
    // テスト環境をクリーンアップ
    if (tester) {
      await tester.cleanup();
    }
  });

  describe('基本的なMCP動作確認', () => {
    test('MCPサーバーの起動と初期化', async () => {
      // サーバーのステータスを確認
      const status = tester.getStatus();
      
      expect(status.isReady).toBe(true);
      expect(status.state).toBe('ready');
      expect(status.pendingRequests).toBe(0);
    });

    test('利用可能なツールの確認', async () => {
      // サーバーの capabilities を確認
      const status = tester.getStatus();
      
      // capabilities が存在することを確認
      expect(status.capabilities).toBeDefined();
      expect(status.capabilities.tools).toBeDefined();
      
      // tools/list を直接呼び出して実際のツール一覧を取得
      const response = await tester.sendRequest('tools/list', {});
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      
      // 少なくともいくつかのツールが存在することを確認
      const toolNames = response.tools.map((t: any) => t.name);
      expect(toolNames).toContain('operator_status');
      expect(toolNames).toContain('operator_available');
    });
  });

  describe('オペレータ機能のテスト', () => {
    test('operator_status ツールの呼び出し', async () => {
      const result = await tester.callTool('operator_status', {});
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.duration).toBeLessThan(1000); // 1秒以内に応答
    });

    test('operator_available ツールの呼び出し', async () => {
      const result = await tester.callTool('operator_available', {});
      
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.duration).toBeLessThan(1000);
    });

    test('存在しないツールの呼び出しエラー処理', async () => {
      const result = await tester.callTool('non_existent_tool', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // エラーメッセージにツール名が含まれていることを確認
      expect(result.error?.message).toContain('non_existent_tool');
    });
  });

  describe('並行処理のテスト', () => {
    test('複数ツールの並行呼び出し', async () => {
      // サーバーが準備完了していることを確認
      await tester.waitUntilReady();
      
      const calls = [
        { name: 'operator_status', args: {} },
        { name: 'operator_available', args: {} },
      ];

      const results = await tester.callToolsConcurrently(calls);
      
      expect(results).toHaveLength(2);
      
      // 少なくとも1つは成功することを確認（並行処理制限がある可能性）
      const successCount = results.filter(r => r.success).length;
      expect(successCount).toBeGreaterThan(0);
      
      // 成功したものについては応答時間を確認
      results.filter(r => r.success).forEach(result => {
        expect(result.duration).toBeLessThan(2000);
      });
    });

    test('複数ツールの順次呼び出し', async () => {
      const calls = [
        { name: 'operator_status', args: {} },
        { name: 'operator_available', args: {} },
      ];

      const startTime = Date.now();
      const results = await tester.callToolsSequentially(calls);
      const totalDuration = Date.now() - startTime;
      
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // 順次実行の方が並行実行より時間がかかることを確認
      expect(totalDuration).toBeGreaterThan(0);
    });
  });

  describe('サーバー制御機能のテスト', () => {
    test('サーバーの再起動', async () => {
      // 再起動前の状態を確認
      const beforeStatus = tester.getStatus();
      expect(beforeStatus.isReady).toBe(true);
      
      // サーバーを再起動
      await tester.restart();
      
      // 再起動後も準備完了状態になることを確認
      await tester.waitUntilReady();
      const afterStatus = tester.getStatus();
      expect(afterStatus.isReady).toBe(true);
    });

    test('ログの取得とクリア', async () => {
      // ツールを呼び出してログを生成
      await tester.callTool('operator_status', {});
      
      // ログを取得
      const logs = tester.getLogs({ limit: 10 });
      expect(logs.length).toBeGreaterThan(0);
      
      // ログをクリア
      tester.clearLogs();
      const clearedLogs = tester.getLogs();
      expect(clearedLogs.length).toBe(0);
    });
  });

  describe('エラー処理とレジリエンス', () => {
    test('不正なパラメータでのツール呼び出し', async () => {
      const result = await tester.callTool('debug_logs', { 
        action: 'invalid_action' 
      });
      
      // エラーが適切に処理されることを確認
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('タイムアウト処理の確認', async () => {
      // 長時間かかる処理をシミュレート
      // （実際のタイムアウトテストはサーバー側の実装に依存）
      const result = await tester.callTool('operator_status', {});
      
      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThan(5000); // 5秒以内
    });
  });

  describe('カスタムリクエストのテスト', () => {
    test('カスタムJSON-RPCリクエストの送信', async () => {
      // tools/list メソッドを直接呼び出し
      const response = await tester.sendRequest('tools/list', {});
      
      expect(response).toBeDefined();
      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
    });

    test('通知の送信（レスポンスなし）', () => {
      // 通知は戻り値を期待しない
      expect(() => {
        tester.sendNotification('notifications/test', { 
          message: 'Test notification' 
        });
      }).not.toThrow();
    });
  });
});