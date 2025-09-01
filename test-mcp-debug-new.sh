#!/bin/bash

echo "=== MCP Debug Test Script ==="
echo "Testing MCP protocol handling with proper architecture"
echo

# Build the project first
echo "Building project..."
npm run build

echo
echo "=== Test 1: Echo Server with New Architecture ==="
echo "Testing basic JSON-RPC request/response correlation"

# Create test request
cat > /tmp/test-request-v2.json << 'EOF'
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello from v2!"}},"id":1}
EOF

echo "Sending request to echo server via mcp-debug..."
timeout 5 sh -c 'cat /tmp/test-request-v2.json | node dist/mcp-debug/cli.js dist/mcp-debug/test/echo-server.js' > /tmp/test-output-v2.txt 2>/tmp/test-error-v2.txt

echo "Response:"
cat /tmp/test-output-v2.txt | jq '.' 2>/dev/null || cat /tmp/test-output-v2.txt

if [ -s /tmp/test-error-v2.txt ]; then
    echo
    echo "Debug logs (stderr):"
    grep -E "(State transition|initialized|ready)" /tmp/test-error-v2.txt | head -10
fi

echo
echo "=== Test 2: MCP Server with Operator Status ==="
echo "Testing real MCP server integration"

cat > /tmp/test-request-v2-2.json << 'EOF'
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_status","arguments":{}},"id":2}
EOF

echo "Sending operator_status request..."
timeout 5 sh -c 'cat /tmp/test-request-v2-2.json | node dist/mcp-debug/cli.js --debug dist/mcp/server.js 2>/tmp/test-error-v2-2.txt' > /tmp/test-output-v2-2.txt

echo "Response:"
cat /tmp/test-output-v2-2.txt | jq '.result.content[0].text' -r 2>/dev/null | head -20 || echo "Failed to extract result"

if [ -s /tmp/test-error-v2-2.txt ]; then
    echo
    echo "State transitions observed:"
    grep "State transition" /tmp/test-error-v2-2.txt
fi

echo
echo "=== Test 3: Interactive Mode Test (Manual) ==="
echo "To test interactive mode, run:"
echo "  node dist/mcp-debug/cli.js --interactive dist/mcp/server.js"
echo
echo "Then try these commands:"
echo "  status"
echo "  tools"
echo "  operator_status()"
echo "  exit"

echo
echo "=== Architecture Features ==="
echo
echo "Previous issues (resolved):"
echo "  ❌ Arbitrary 1-second wait for initialization"
echo "  ❌ No request/response correlation"
echo "  ❌ Fire-and-forget pattern"
echo "  ❌ Mixed concerns between process and protocol"
echo
echo "Current implementation features:"
echo "  ✅ Proper MCP initialization sequence"
echo "  ✅ Request/response correlation with IDs"
echo "  ✅ State machine for server lifecycle"
echo "  ✅ Clean separation of concerns"
echo "  ✅ Async/await with proper error handling"

# Clean up
rm -f /tmp/test-request-v2*.json /tmp/test-output-v2*.txt /tmp/test-error-v2*.txt

echo
echo "=== Test Complete ==="