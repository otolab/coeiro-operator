#!/bin/bash

echo "=== スタイル指定エラーハンドリングテスト ==="
echo

# 1. MCPサーバー初期化
echo "1. MCPサーバー初期化..."
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' | node dist/mcp/server.js 2>/dev/null | jq -r '.result' > /dev/null
echo '{"jsonrpc":"2.0","method":"initialized","params":{}}' | node dist/mcp/server.js 2>/dev/null
echo

# 2. アルマちゃんを割り当て（表と裏のスタイルがある）
echo "2. アルマちゃんを割り当て..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{"operator":"alma"}},"id":2}' | node dist/mcp/server.js 2>/dev/null | jq -r '.result.content[0].text' | head -5
echo

# 3. 正しいスタイル指定（成功するはず）
echo "3. 正しいスタイル指定 ('裏')..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"裏スタイルで話します","style":"裏"}},"id":3}' | node dist/mcp/server.js 2>/dev/null | jq -r '.result.content[0].text // .error.message'
echo

# 4. 存在しないスタイル指定（エラーになるはず）
echo "4. 存在しないスタイル指定 ('存在しない')..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"テスト","style":"存在しない"}},"id":4}' | node dist/mcp/server.js 2>/dev/null | jq -r '.error.message // .result.content[0].text'
echo

# 5. 英語スタイル名（エラーになるはず）
echo "5. 英語スタイル名 ('whisper')..."
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"whisperで話します","style":"whisper"}},"id":5}' | node dist/mcp/server.js 2>/dev/null | jq -r '.error.message // .result.content[0].text'
echo

echo "=== テスト完了 ==="