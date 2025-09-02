#!/bin/bash

echo "=== 直接MCPサーバーでスタイルテスト ==="

# MCPサーバーをバックグラウンドで起動
echo "MCPサーバー起動中..."
node dist/mcp/server.js --debug > mcp-server.log 2>&1 &
MCP_PID=$!

sleep 2

# オペレータアサイン
echo "1. オペレータアサイン (angie)..."
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{"operator":"angie"}},"id":2}' | nc -w 1 localhost 50032

sleep 1

# 通常スタイル
echo ""
echo "2. 通常スタイル（のーまる）..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"通常のスタイルで話してるよ","style":"のーまる"}},"id":3}' | nc -w 1 localhost 50032

sleep 3

# セクシースタイル
echo ""
echo "3. セクシースタイル..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"セクシーボイスになったかな","style":"セクシー"}},"id":4}' | nc -w 1 localhost 50032

sleep 3

# クリーンアップ
kill $MCP_PID
echo ""
echo "=== テスト完了 ==="
echo "ログ: mcp-server.log"