#!/usr/bin/env node

/**
 * test-mcp-styles.js: MCPサーバーのスタイル機能テスト
 */

import { OperatorManager } from './src/operator/index.js';

async function testMCPStyles() {
    console.log('🚀 MCPサーバースタイル機能テスト開始');
    
    const manager = new OperatorManager();
    await manager.initialize();
    
    try {
        // 1. アルマちゃんをアサイン
        console.log('\n=== アルマちゃんアサインテスト ===');
        const assignResult = await manager.assignSpecificOperator('alma');
        console.log('✅ アサイン成功:', {
            character: assignResult.characterName,
            operatorId: assignResult.operatorId,
            currentStyle: assignResult.currentStyle.styleName,
            greeting: assignResult.greeting
        });
        
        // 2. キャラクター情報を取得してスタイル情報を確認
        console.log('\n=== スタイル情報確認 ===');
        const character = await manager.getCharacterInfo('alma');
        const availableStyles = Object.entries(character.available_styles || {})
            .filter(([_, style]) => style.enabled)
            .map(([styleId, style]) => ({
                id: styleId,
                name: style.name,
                personality: style.personality,
                speakingStyle: style.speaking_style
            }));
        
        console.log(`✅ 利用可能スタイル (${availableStyles.length}種類):`);
        availableStyles.forEach(style => {
            const isDefault = style.id === character.default_style;
            const marker = isDefault ? '★ ' : '  ';
            console.log(`${marker}${style.id}: ${style.name}`);
            console.log(`    性格: ${style.personality}`);
            console.log(`    話し方: ${style.speakingStyle}`);
        });
        
        // 3. 結果フォーマット例を表示
        console.log('\n=== MCPレスポンス形式例 ===');
        
        let resultText = `${assignResult.characterName} (${assignResult.operatorId}) をアサインしました。\n\n`;
        
        // 現在のスタイル情報
        if (assignResult.currentStyle) {
            resultText += `📍 現在のスタイル: ${assignResult.currentStyle.styleName}\n`;
            resultText += `   性格: ${assignResult.currentStyle.personality}\n`;
            resultText += `   話し方: ${assignResult.currentStyle.speakingStyle}\n\n`;
        }
        
        // 利用可能なスタイル一覧
        if (availableStyles.length > 1) {
            resultText += `🎭 利用可能なスタイル（切り替え可能）:\n`;
            availableStyles.forEach(style => {
                const isCurrent = style.id === assignResult.currentStyle?.styleId;
                const marker = isCurrent ? '→ ' : '  ';
                resultText += `${marker}${style.id}: ${style.name}\n`;
                resultText += `    性格: ${style.personality}\n`;
                resultText += `    話し方: ${style.speakingStyle}\n`;
            });
        } else {
            resultText += `ℹ️  このキャラクターは1つのスタイルのみ利用可能です。\n`;
        }
        
        // 挨拶
        if (assignResult.greeting) {
            resultText += `\n💬 "${assignResult.greeting}"\n`;
        }
        
        console.log(resultText);
        
        // 4. MANAでランダムスタイルテスト
        console.log('\n=== MANAランダムスタイルテスト ===');
        const manaResult = await manager.assignSpecificOperator('mana');
        console.log('✅ MANA アサイン結果:', {
            character: manaResult.characterName,
            currentStyle: manaResult.currentStyle.styleName,
            personality: manaResult.currentStyle.personality
        });
        
        console.log('\n✅ すべてのテストが成功しました！');
        
    } catch (error) {
        console.error('❌ テストエラー:', error.message);
    } finally {
        // クリーンアップ
        try {
            await manager.releaseOperator();
        } catch {}
    }
}

testMCPStyles().catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
});