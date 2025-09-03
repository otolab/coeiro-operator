#!/usr/bin/env node

/**
 * COEIROINKのスピーカー情報を取得してコード生成用データを出力
 */

async function getSpeakers() {
    try {
        const response = await fetch('http://localhost:50032/v1/speakers');
        const speakers = await response.json();
        
        console.log('// 利用可能なスピーカー一覧（自動生成用）');
        console.log('export const AVAILABLE_SPEAKERS = {');
        
        for (const speaker of speakers) {
            const safeName = speaker.speakerName
                .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_');
            console.log(`    // ${speaker.speakerName}`);
            console.log(`    '${speaker.speakerUuid}': {`);
            console.log(`        name: '${speaker.speakerName}',`);
            console.log(`        speakerId: '${speaker.speakerUuid}',`);
            console.log(`        styles: [`);
            for (const style of speaker.styles) {
                console.log(`            { id: ${style.styleId}, name: '${style.styleName}' },`);
            }
            console.log(`        ]`);
            console.log(`    },`);
        }
        
        console.log('};');
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

getSpeakers();