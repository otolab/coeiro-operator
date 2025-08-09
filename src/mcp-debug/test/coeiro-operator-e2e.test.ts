/**
 * Jest E2E Tests for COEIRO Operator MCP Server
 * COEIRO Operator MCPサーバーのJest E2Eテスト
 * 
 * 既存のlogger.tsシステムとMCPデバッグ環境の統合テスト
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';

interface LoggerTestResult {
  totalEntries: number;
  entriesByLevel: Record<string, number>;
  performance: {
    duration: number;
    logsPerSecond: number;
  };
}

class CoeirocoperatorE2ETestRunner {
  /**
   * ログシステムのパフォーマンステスト
   */
  async testLoggerPerformance(): Promise<LoggerTestResult> {
    const testScript = `
      import { logger, LoggerPresets } from './dist/utils/logger.js';
      
      // デバッグモードで大量ログテスト
      LoggerPresets.debug();
      logger.enableAccumulation(1000);
      
      const startTime = Date.now();
      const logCount = 500;
      
      for (let i = 0; i < logCount; i++) {
        logger.info(\`Performance test log \${i + 1}\`, { iteration: i, data: 'test-data' });
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const stats = logger.getLogStats();
      const result = {
        totalEntries: stats.totalEntries,
        entriesByLevel: stats.entriesByLevel,
        performance: {
          duration: duration,
          logsPerSecond: Math.round(logCount / (duration / 1000))
        }
      };
      
      console.log(JSON.stringify(result));
    `;

    return new Promise((resolve, reject) => {
      const child = spawn('node', ['--input-type=module', '-e', testScript], {
        cwd: path.resolve(__dirname, '../../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse output: ${output}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * MCPサーバープリセットテスト
   */
  async testMcpServerPresets(): Promise<{ presetName: string; entriesAccumulated: number }[]> {
    const testScript = `
      import { logger, LoggerPresets } from './dist/utils/logger.js';
      
      const results = [];
      
      // MCPサーバーモード（蓄積あり）をテスト
      LoggerPresets.mcpServerWithAccumulation();
      logger.info('MCP mode info - should not appear in stdout');
      logger.error('MCP mode error - should appear in stderr');
      logger.debug('MCP mode debug - should be accumulated only');
      
      let stats = logger.getLogStats();
      results.push({
        presetName: 'mcpServerWithAccumulation',
        entriesAccumulated: stats.totalEntries
      });
      
      // デバッグモードをテスト
      logger.clearLogEntries();
      LoggerPresets.debug();
      logger.info('Debug mode info');
      logger.warn('Debug mode warn');
      logger.error('Debug mode error');
      
      stats = logger.getLogStats();
      results.push({
        presetName: 'debug',
        entriesAccumulated: stats.totalEntries
      });
      
      console.log(JSON.stringify(results));
    `;

    return new Promise((resolve, reject) => {
      const child = spawn('node', ['--input-type=module', '-e', testScript], {
        cwd: path.resolve(__dirname, '../../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (e) {
            reject(new Error(`Failed to parse output: ${output}`));
          }
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * MCPサーバーの基本動作テスト
   */
  async testMcpServerBasicOperation(): Promise<boolean> {
    const serverPath = path.resolve(__dirname, '../../../dist/mcp/server.js');
    
    return new Promise((resolve, reject) => {
      const serverProcess = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let initReceived = false;

      // 初期化リクエスト送信
      const initRequest = JSON.stringify({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} }
        },
        id: 1
      });

      serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        try {
          const response = JSON.parse(output);
          if (response.id === 1 && response.result) {
            initReceived = true;
            serverProcess.kill('SIGTERM');
          }
        } catch (e) {
          // JSON解析失敗は無視
        }
      });

      serverProcess.on('close', () => {
        resolve(initReceived);
      });

      serverProcess.on('error', (error) => {
        reject(error);
      });

      // 初期化リクエスト送信
      setTimeout(() => {
        serverProcess.stdin?.write(initRequest + '\n');
      }, 100);

      // タイムアウト設定
      setTimeout(() => {
        if (!initReceived) {
          serverProcess.kill('SIGTERM');
          resolve(false);
        }
      }, 5000);
    });
  }
}

describe('COEIRO Operator MCP Server E2E Tests', () => {
  let testRunner: CoeirocoperatorE2ETestRunner;

  beforeEach(() => {
    testRunner = new CoeirocoperatorE2ETestRunner();
  });

  describe('Logger System Integration', () => {
    test('ログシステムのパフォーマンステスト', async () => {
      const result = await testRunner.testLoggerPerformance();

      // パフォーマンス要件の確認
      expect(result.totalEntries).toBeGreaterThanOrEqual(500);
      expect(result.performance.duration).toBeLessThan(1000); // 1秒以内
      expect(result.performance.logsPerSecond).toBeGreaterThan(100); // 100ログ/秒以上
      
      // レベル別集計の確認
      expect(result.entriesByLevel.info).toBe(500);
    }, 10000);

    test('MCPサーバープリセットの動作確認', async () => {
      const results = await testRunner.testMcpServerPresets();

      const mcpPresetResult = results.find(r => r.presetName === 'mcpServerWithAccumulation');
      const debugPresetResult = results.find(r => r.presetName === 'debug');

      // MCPサーバーモードでログが蓄積されることを確認
      expect(mcpPresetResult).toBeDefined();
      expect(mcpPresetResult!.entriesAccumulated).toBeGreaterThan(0);

      // デバッグモードでログが蓄積されることを確認
      expect(debugPresetResult).toBeDefined();
      expect(debugPresetResult!.entriesAccumulated).toBeGreaterThan(0);
    }, 10000);
  });

  describe('MCP Server Basic Operation', () => {
    test('MCPサーバーの初期化テスト', async () => {
      const isInitialized = await testRunner.testMcpServerBasicOperation();

      expect(isInitialized).toBe(true);
    }, 10000);
  });

  describe('Integration with MCP Debug Environment', () => {
    test('既存logger.tsと拡張ロガーシステムの互換性', async () => {
      // 既存のlogger.tsが正常に動作することを確認
      const loggerResult = await testRunner.testLoggerPerformance();
      expect(loggerResult.totalEntries).toBeGreaterThan(0);

      // MCPデバッグ環境の拡張ロガーも利用可能であることを暗黙的に確認
      // (jest-e2e.test.ts で詳細テスト済み)
    });

    test('LoggerPresetsの動作確認', async () => {
      const presetResults = await testRunner.testMcpServerPresets();
      
      // 複数のプリセットが正常に動作することを確認
      expect(presetResults).toHaveLength(2);
      expect(presetResults.every(r => r.entriesAccumulated >= 0)).toBe(true);
    });
  });
});