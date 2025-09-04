/**
 * MCP E2Eテストモードの使用例
 * 
 * 使い方:
 * npm run build
 * node dist/examples/mcp-e2e-test.js
 */

import { createMCPTester, MCPServiceE2ETester } from '../mcp-debug/e2e/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, '../mcp/server.js');

async function main() {
  console.log('🚀 MCP E2Eテストモード使用例\n');
  
  // テスターを作成
  const tester = await createMCPTester({
    serverPath,
    debug: false,
    timeout: 15000
  });
  
  try {
    // サーバー状態を確認
    console.log('📝 サーバー状態:');
    const status = tester.getStatus();
    console.log('  状態:', status.state);
    console.log('  準備完了:', status.isReady);
    
    // 利用可能なツール一覧
    const tools = tester.getAvailableTools();
    console.log('  利用可能なツール数:', tools.length);
    console.log('  ツール例:', tools.slice(0, 3).join(', '));
    
    // ツール呼び出し
    console.log('\n📞 ツール呼び出し:');
    const statusResult = await tester.callTool('operator_status', {});
    console.log('  operator_status:', statusResult.success ? '✅成功' : '❌失敗');
    if (statusResult.success) {
      console.log('  結果:', statusResult.result);
    }
    
    // 並行実行のパフォーマンス測定
    console.log('\n📊 パフォーマンス測定:');
    const numCalls = 10;
    const calls = Array.from({ length: numCalls }, () => ({
      name: 'operator_status',
      args: {}
    }));
    
    // 順次実行
    const sequentialStart = Date.now();
    await tester.callToolsSequentially(calls);
    const sequentialTime = Date.now() - sequentialStart;
    
    // 並行実行
    const concurrentStart = Date.now();
    await tester.callToolsConcurrently(calls);
    const concurrentTime = Date.now() - concurrentStart;
    
    console.log(`  ${numCalls}回の呼び出し:`);
    console.log(`    順次実行: ${sequentialTime}ms (平均: ${(sequentialTime / numCalls).toFixed(1)}ms/call)`);
    console.log(`    並行実行: ${concurrentTime}ms (平均: ${(concurrentTime / numCalls).toFixed(1)}ms/call)`);
    console.log(`    高速化: ${((sequentialTime / concurrentTime - 1) * 100).toFixed(0)}%`);
    
    // ログの取得
    console.log('\n📜 ログ情報:');
    const allLogs = tester.getLogs();
    console.log(`  総ログ数: ${allLogs.length}`);
    
    const stderrLogs = tester.getLogs({ level: 'stderr', limit: 5 });
    console.log(`  stderr ログ数: ${tester.getLogs({ level: 'stderr' }).length}`);
    if (stderrLogs.length > 0) {
      console.log('  最新のstderrログ (最大5件):');
      stderrLogs.forEach(log => {
        console.log(`    [${log.timestamp.toISOString()}] ${log.message.trim().substring(0, 100)}`);
      });
    }
    
    const recentLogs = tester.getLogs({ 
      since: new Date(Date.now() - 1000), // 過去1秒間
      limit: 3 
    });
    console.log(`  過去1秒間のログ数: ${recentLogs.length}`);
    
  } finally {
    // 必ずクリーンアップ
    await tester.cleanup();
  }
  
  console.log('\n✅ テスト完了');
}

// 実行
main().catch(console.error);