#!/bin/bash

# MCP Debug Environment Test Script
# MCPデバッグ環境のテストスクリプト

set -e

echo "🧪 MCP Debug Environment Test Suite"
echo "===================================="

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

# ビルド
echo "📦 Building project..."
npm run build

# echoサーバーが実行可能か確認
echo ""
echo "🔍 Checking echo server..."
if [ -f "dist/mcp-debug/test/echo-server.js" ]; then
    echo "✅ Echo server found"
else
    echo "❌ Echo server not found"
    exit 1
fi

# 統合テストが実行可能か確認
if [ -f "dist/mcp-debug/test/integration.test.js" ]; then
    echo "✅ Integration test found"
else
    echo "❌ Integration test not found"
    exit 1
fi

echo ""
echo "🚀 Running integration tests..."
echo "--------------------------------"

# 統合テストを実行
node dist/mcp-debug/test/integration.test.js

echo ""
echo "📋 Manual test commands you can try:"
echo ""
echo "# Start echo server manually:"
echo "node dist/mcp-debug/test/echo-server.js --debug"
echo ""
echo "# Test control commands:"
echo "echo 'CTRL:status' | node dist/mcp-debug/test/echo-server.js"
echo "echo 'CTRL:health' | node dist/mcp-debug/test/echo-server.js"
echo ""
echo "# Test MCP tools:"
echo 'echo '"'"'{"jsonrpc":"2.0","method":"tools/list","id":1}'"'"' | node dist/mcp-debug/test/echo-server.js'
echo ""
echo "# Interactive test client:"
echo "node dist/mcp-debug/test/client.js --interactive"

echo ""
echo "✨ Test suite completed!"