#!/bin/bash

echo "=== MCPスタイル切り替えテスト (mcp-debug使用) ==="

# 1. オペレータアサイン
echo "1. オペレータアサイン (angie)..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{"operator":"angie"}},"id":1}' | \
  node dist/mcp-debug/cli.js --timeout 3000 dist/mcp/server.js

sleep 1

# 2. 通常スタイルでテスト
echo ""
echo "2. 通常スタイル（のーまる）でテスト..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"通常のスタイルで話してるよ","style":"のーまる"}},"id":2}' | \
  node dist/mcp-debug/cli.js --timeout 5000 dist/mcp/server.js

sleep 3

# 3. セクシースタイルでテスト
echo ""
echo "3. セクシースタイルでテスト..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"セクシーボイスになったかな","style":"セクシー"}},"id":3}' | \
  node dist/mcp-debug/cli.js --timeout 5000 dist/mcp/server.js

sleep 3

# 4. スタイルを戻してテスト
echo ""
echo "4. 通常スタイルに戻してテスト..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"また通常のスタイルに戻ったよ","style":"のーまる"}},"id":4}' | \
  node dist/mcp-debug/cli.js --timeout 5000 dist/mcp/server.js

echo ""
echo "=== テスト完了 ==="