#!/bin/bash

# MCPサーバーを起動してデバッグログを確認
(
  echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"clientInfo":{"name":"test-client","version":"1.0.0"}},"id":1}'
  sleep 1
  echo '{"jsonrpc":"2.0","method":"initialized","params":{}}'
  sleep 1
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_assign","arguments":{}},"id":2}'
  sleep 3
  echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":3}'
  sleep 10
) | COEIRO_DEBUG=true node dist/mcp/server.js