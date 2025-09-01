#!/bin/bash

# スタイル切り替えテスト（正しいスタイル名）

echo "==================="
echo "スタイル切り替えテスト（正しいスタイル名）"  
echo "==================="

# 色設定
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}==== テスト1: れいせいスタイル ====${NC}"
echo -e "${BLUE}アサイン（れいせいスタイル）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi --style=れいせい

echo -e "${BLUE}ステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "${YELLOW}発声テスト${NC}"
node dist/cli/say-coeiroink.js "れいせいスタイルの音声です。冷静で落ち着いた話し方になります。"

echo -e "${BLUE}解放${NC}"
node dist/cli/operator-manager.js release

sleep 1

echo -e "\n${BLUE}==== テスト2: おしとやかスタイル ====${NC}"
echo -e "${BLUE}アサイン（おしとやかスタイル）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi --style=おしとやか

echo -e "${BLUE}ステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "${YELLOW}発声テスト${NC}"
node dist/cli/say-coeiroink.js "おしとやかスタイルの音声です。上品で優しい話し方になります。"

echo -e "${BLUE}解放${NC}"
node dist/cli/operator-manager.js release

sleep 1

echo -e "\n${BLUE}==== テスト3: げんきスタイル ====${NC}"
echo -e "${BLUE}アサイン（げんきスタイル）${NC}"
node dist/cli/operator-manager.js assign tsukuyomi --style=げんき

echo -e "${BLUE}ステータス確認${NC}"
node dist/cli/operator-manager.js status

echo -e "${YELLOW}発声テスト${NC}"
node dist/cli/say-coeiroink.js "げんきスタイルの音声です。明るく元気な話し方になります。"

echo -e "${BLUE}解放${NC}"
node dist/cli/operator-manager.js release

echo -e "\n${GREEN}✓ 全スタイルのテスト完了${NC}"