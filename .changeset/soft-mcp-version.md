---
"@coeiro-operator/mcp": patch
---

MCP initialize応答で package の version を返すように修正

`serverInfo.version` を MCP package 自身の `package.json` から読み込みます。
