#!/usr/bin/env node

/**
 * COEIROINKのダウンロード可能なスピーカー情報を取得
 */

async function getDownloadableSpeakers() {
    try {
        const response = await fetch('http://localhost:50032/v1/downloadable_speakers');
        const speakers = await response.json();
        
        console.log('// ダウンロード可能なスピーカー一覧');
        console.log('export const DOWNLOADABLE_SPEAKERS = {');
        
        for (const speaker of speakers) {
            console.log(`    // ${speaker.speakerName}`);
            console.log(`    '${speaker.speakerUuid}': {`);
            console.log(`        name: '${speaker.speakerName}',`);
            console.log(`        speakerId: '${speaker.speakerUuid}'`);
            console.log(`    },`);
        }
        
        console.log('};');
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

getDownloadableSpeakers();