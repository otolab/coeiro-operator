#!/bin/bash

echo "Testing Dia-chan styles with mcp-debug..."

# Create temporary file for request
cat > /tmp/test-request.json << 'EOF'
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"operator_styles","arguments":{"character":"dia"}},"id":1}
EOF

echo "Sending request to MCP server..."

# Send request and capture output
timeout 3 sh -c 'cat /tmp/test-request.json | node dist/mcp-debug/cli.js dist/mcp/server.js' > /tmp/test-output.txt 2>&1

echo "Raw output:"
cat /tmp/test-output.txt

echo -e "\n--- Extracting result ---"
# Extract the JSON response (looking for the line with "result")
grep -o '{"jsonrpc".*"result".*}' /tmp/test-output.txt | jq '.result.content[0].text' -r 2>/dev/null || echo "Failed to extract result"

# Alternative: Direct test with MCP server
echo -e "\n--- Direct test with MCP server ---"
cat /tmp/test-request.json | timeout 2 node dist/mcp/server.js 2>/dev/null | jq '.result.content[0].text' -r 2>/dev/null | head -20 || echo "Direct test failed"

# Clean up
rm -f /tmp/test-request.json /tmp/test-output.txt