#!/bin/bash

# スタイル切り替え直接テスト

echo "==================="
echo "スタイル切り替えテスト（直接実行）"
echo "==================="

# 色設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}1. オペレータ利用可能一覧${NC}"
node dist/cli/operator-manager.js available

echo -e "\n${BLUE}2. つくよみちゃんをアサイン（通常スタイル指定）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi --style=通常

echo -e "\n${BLUE}3. ステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "\n${YELLOW}4. 通常スタイルで発声${NC}"
node dist/cli/say-coeiroink.js "通常スタイルの音声です"

echo -e "\n${BLUE}5. オペレータ解放${NC}"
node dist/cli/operator-manager.js release

echo -e "\n${BLUE}6. つくよみちゃんを再アサイン（裏スタイル指定）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi --style=裏

echo -e "\n${BLUE}7. ステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "\n${YELLOW}8. 裏スタイルで発声${NC}"
node dist/cli/say-coeiroink.js "裏スタイルの音声です"

echo -e "\n${BLUE}9. オペレータ解放${NC}"
node dist/cli/operator-manager.js release

echo -e "\n${GREEN}✓ テスト完了${NC}"