#!/bin/bash

echo "=== MCPスタイル切り替えテスト ==="

# オペレータアサイン確認
echo "1. オペレータ状態確認..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":1}' | \
  node dist/mcp-debug/cli.js --timeout 2000 dist/mcp/server.js --debug 2>&1 | grep -A 5 "text"

# 通常スタイルでテスト
echo ""
echo "2. 通常スタイル（のーまる）でテスト..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"通常のスタイルで話してるよ","style":"のーまる"}},"id":2}' | \
  node dist/mcp-debug/cli.js --timeout 3000 dist/mcp/server.js --debug 2>&1 | grep -A 2 "text"

sleep 2

# セクシースタイルでテスト
echo ""
echo "3. セクシースタイルでテスト..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"セクシーボイスになったかな","style":"セクシー"}},"id":3}' | \
  node dist/mcp-debug/cli.js --timeout 3000 dist/mcp/server.js --debug 2>&1 | grep -A 2 "text"

echo ""
echo "=== テスト完了 ==="