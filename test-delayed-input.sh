#!/bin/bash

# 各JSONメッセージを2秒間隔で送信
(
  echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}'
  sleep 2
  echo '{"jsonrpc":"2.0","method":"initialized","params":{}}'
  sleep 2
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":2}'
  sleep 10
) | node dist/mcp/server.js --debug