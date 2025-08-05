#!/usr/bin/env node

/**
 * simplify-config.js: operator-config.jsonの構造を簡素化
 */

import { readFile, writeFile } from 'fs/promises';

async function simplifyConfig() {
    const configPath = '.coeiroink/operator-config.json';
    
    try {
        // 現在の設定を読み込み
        const content = await readFile(configPath, 'utf8');
        const config = JSON.parse(content);
        
        // charactersセクションの各キャラクターにenabledフラグを追加
        for (const [charId, character] of Object.entries(config.characters)) {
            // operatorsセクションからenabledフラグを取得
            const operatorEnabled = config.operators?.[charId]?.enabled ?? true;
            character.enabled = operatorEnabled;
        }
        
        // operatorsセクションを削除
        delete config.operators;
        
        // 新しい設定を書き込み
        await writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log('✅ operator-config.json を簡素化しました');
        console.log('   - charactersに enabled フラグを追加');
        console.log('   - operators セクションを削除');
        
        // 結果を表示
        const enabledCount = Object.values(config.characters).filter(c => c.enabled).length;
        const totalCount = Object.keys(config.characters).length;
        console.log(`   - 有効キャラクター: ${enabledCount}/${totalCount}`);
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
        process.exit(1);
    }
}

simplifyConfig();