#!/bin/bash

# MCPサーバーをバックグラウンドで起動
node dist/mcp/server.js --debug &
SERVER_PID=$!

# サーバーの起動を少し待つ
sleep 2

# 1. Initialize
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}' >&${SERVER_PID}
sleep 2

# 2. Initialized
echo '{"jsonrpc":"2.0","method":"initialized","params":{}}' >&${SERVER_PID}
sleep 2

# 3. Say tool call
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":2}' >&${SERVER_PID}
sleep 10

# サーバーを終了
kill $SERVER_PID