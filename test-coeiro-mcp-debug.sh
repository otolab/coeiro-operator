#!/bin/bash

# COEIRO Operator MCPサーバーのデバッグ機能テスト
# MCPデバッグ環境の統合テスト

set -e

echo "🧪 COEIRO Operator MCPサーバー デバッグ機能テスト"
echo "=================================================="

# プロジェクトルートに移動
cd "$(dirname "$0")"

# ビルド確認
echo "📦 Building project..."
npm run build

echo ""
echo "🔍 Testing COEIRO Operator MCP Server with debug features..."

# 1. MCPサーバーの基本動作テスト
echo ""
echo "1. 基本MCPプロトコルテスト"
echo "--------------------------"

# JSONRPCのinitializeテスト
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}}},"id":1}' | timeout 5s node dist/mcp/server.js || echo "Initialize test completed"

echo ""
echo "2. ログ蓄積機能テスト"
echo "-------------------"

# 既存のutilsログシステムの蓄積機能をテスト
cat << 'EOF' | node --input-type=module
import { logger, LoggerPresets } from './dist/utils/logger.js';

// デバッグモードでログ蓄積を有効化
LoggerPresets.debug();
logger.enableAccumulation(100);

// テストログを生成
logger.info('Test info message');
logger.warn('Test warning message'); 
logger.error('Test error message');
logger.debug('Test debug message');

// 蓄積されたログを確認
const entries = logger.getLogEntries();
console.log(`✅ ログエントリ数: ${entries.length}`);

const stats = logger.getLogStats();
console.log('📊 ログ統計:');
console.log(`  - 総エントリ数: ${stats.totalEntries}`);
console.log(`  - レベル別:`);
Object.entries(stats.entriesByLevel).forEach(([level, count]) => {
  if (count > 0) console.log(`    ${level}: ${count}`);
});

// エラーログのみ取得
const errorLogs = logger.getLogEntries({ level: 'error' });
console.log(`🔴 エラーログ数: ${errorLogs.length}`);

if (errorLogs.length > 0) {
  console.log('エラーログ詳細:');
  errorLogs.forEach(entry => {
    console.log(`  - ${entry.timestamp}: ${entry.message}`);
  });
}

console.log('\n✅ ログシステムテスト完了');
EOF

echo ""
echo "3. MCPサーバープリセットテスト"
echo "----------------------------"

cat << 'EOF' | node --input-type=module
import { logger, LoggerPresets } from './dist/utils/logger.js';

console.log('🔧 MCPサーバープリセットテスト開始');

// MCPサーバーモード（蓄積あり）をテスト
LoggerPresets.mcpServerWithAccumulation();
logger.info('MCP mode info - should not appear in stdout');
logger.error('MCP mode error - should appear in stderr');
logger.debug('MCP mode debug - should be accumulated only');

// 蓄積状況確認
const stats = logger.getLogStats();
console.log(`📈 蓄積エントリ数: ${stats.totalEntries}`);

if (stats.totalEntries > 0) {
  console.log('✅ MCPモードでログ蓄積が動作中');
} else {
  console.log('❌ MCPモードでログ蓄積が動作していない');
}

console.log('🔧 MCPサーバープリセットテスト完了');
EOF

echo ""
echo "4. パフォーマンステスト"
echo "---------------------"

cat << 'EOF' | node --input-type=module
import { logger, LoggerPresets } from './dist/utils/logger.js';

console.log('⚡ パフォーマンステスト開始');

// デバッグモードで大量ログテスト
LoggerPresets.debug();
logger.enableAccumulation(1000);

const startTime = Date.now();
const logCount = 500;

for (let i = 0; i < logCount; i++) {
  logger.info(`Performance test log ${i + 1}`, { iteration: i, data: 'test-data' });
}

const endTime = Date.now();
const duration = endTime - startTime;

const stats = logger.getLogStats();
console.log(`📊 パフォーマンス結果:`);
console.log(`  - ${logCount}件のログ処理時間: ${duration}ms`);
console.log(`  - 1件あたり: ${(duration / logCount).toFixed(2)}ms`);
console.log(`  - 実際の蓄積数: ${stats.totalEntries}`);

if (stats.totalEntries >= logCount) {
  console.log('✅ 大量ログ処理性能良好');
} else {
  console.log('⚠️ ログ蓄積に問題がある可能性');
}

console.log('⚡ パフォーマンステスト完了');
EOF

echo ""
echo "📋 手動テストコマンド例:"
echo ""
echo "# MCPサーバー起動（デバッグモード）:"
echo "COEIRO_LOG_LEVEL=debug node dist/mcp/server.js"
echo ""
echo "# オペレータ割り当てテスト:"
echo 'echo '"'"'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{"operator":"tsukuyomi"}},"id":1}'"'"' | node dist/mcp/server.js'
echo ""
echo "# 音声合成テスト:"
echo 'echo '"'"'{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"こんにちは"}},"id":2}'"'"' | node dist/mcp/server.js'
echo ""

echo "✨ COEIRO Operator MCPサーバー デバッグ機能テスト完了!"
echo ""
echo "🎯 次のステップ:"
echo "1. Claude Code でMCPサーバーツールとして登録"
echo "2. operator_assign, say ツールの実際の動作確認" 
echo "3. ログ蓄積状況のリアルタイム監視"