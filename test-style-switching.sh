#!/bin/bash

# スタイル切り替えテストスクリプト

echo "==================="
echo "スタイル切り替えテスト"
echo "==================="

# 色設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}1. オペレータをアサイン（つくよみちゃん）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi

echo -e "\n${BLUE}2. 現在のステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "\n${BLUE}3. スタイル一覧表示${NC}"
node dist/cli/operator-manager.js styles tsukuyomi

echo -e "\n${YELLOW}4. デフォルトスタイルで発声${NC}"
node dist/cli/say-coeiroink.js "デフォルトスタイルのテストです"

echo -e "\n${YELLOW}5. 裏スタイルで発声（MCP経由をシミュレート）${NC}"
# MCPのsayツールを直接実行
echo '{"message": "裏スタイルのテストです", "style": "裏"}' | node dist/mcp-debug/cli.js --interactive dist/mcp/server.js --timeout 5000 << EOF
call say {"message": "裏スタイルのテストです", "style": "裏"}
EOF

echo -e "\n${YELLOW}6. 通常スタイルに戻して発声${NC}"
echo '{"message": "通常スタイルに戻りました", "style": "通常"}' | node dist/mcp-debug/cli.js --interactive dist/mcp/server.js --timeout 5000 << EOF
call say {"message": "通常スタイルに戻りました", "style": "通常"}
EOF

echo -e "\n${BLUE}7. オペレータ解放${NC}"
node dist/cli/operator-manager.js release

echo -e "\n${GREEN}✓ テスト完了${NC}"