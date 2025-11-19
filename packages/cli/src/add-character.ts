#!/usr/bin/env node --no-deprecation

/**
 * add-character CLI: COEIROINKキャラクターをCoeiro-operatorに追加
 */

import { Command } from 'commander';
import { getSpeakerProvider, logger, ConfigManager, getConfigDir } from '@coeiro-operator/core';
import { join } from 'path';

// WAVファイルヘッダーから再生時間を取得
function getWavDuration(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  const sampleRate = view.getUint32(24, true);

  let pos = 12;
  while (pos < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(pos),
      view.getUint8(pos + 1),
      view.getUint8(pos + 2),
      view.getUint8(pos + 3)
    );
    const chunkSize = view.getUint32(pos + 4, true);

    if (chunkId === 'data') {
      const channels = view.getUint16(22, true);
      const bitsPerSample = view.getUint16(34, true);
      const duration = chunkSize / (sampleRate * channels * (bitsPerSample / 8));
      return duration;
    }

    pos += 8 + chunkSize;
    if (chunkSize % 2 !== 0) pos++;
  }

  throw new Error('WAVファイルのdataチャンクが見つかりませんでした');
}

// テスト文章（モーラ数が既知のもの）
const TEST_SENTENCES = [
  { text: 'こんにちは、今日はいい天気ですね。', moras: 19 },
  { text: 'ありがとうございます。', moras: 11 },
  { text: 'おはようございます。よろしくお願いします。', moras: 22 },
  { text: 'それでは、始めましょう。', moras: 12 },
];

// スタイルの話速を測定
async function measureStyleSpeechRate(
  speakerId: string,
  styleId: number
): Promise<number> {
  const results: number[] = [];

  for (const sentence of TEST_SENTENCES) {
    try {
      // COEIROINK APIを直接呼び出し
      const synthesisParams = {
        text: sentence.text,
        speakerUuid: speakerId,
        styleId: styleId,
        speedScale: 1.0,
        volumeScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
      };

      const url = 'http://localhost:50032/v1/synthesis';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(synthesisParams),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const duration = getWavDuration(audioBuffer);
      const morasPerSecond = sentence.moras / duration;
      results.push(morasPerSecond);
    } catch (error) {
      logger.warn(`測定エラー (styleId=${styleId}): ${error}`);
    }
  }

  if (results.length === 0) {
    throw new Error('話速測定に失敗しました');
  }

  return results.reduce((sum, val) => sum + val, 0) / results.length;
}

// キャラクター一覧を表示
async function listCharacters() {
  const speakerProvider = getSpeakerProvider();
  const configDir = await getConfigDir();
  const configManager = new ConfigManager(configDir);

  const speakers = await speakerProvider.getSpeakers();
  const config = await configManager.loadConfig();
  const registeredSpeakerIds = new Set(
    Object.values(config.characters || {}).map((char: any) => char.speakerId)
  );

  logger.info('Available COEIROINK Characters:\n');

  for (const speaker of speakers) {
    const isRegistered = registeredSpeakerIds.has(speaker.speakerUuid);
    const mark = isRegistered ? '✓' : ' ';
    const status = isRegistered ? '- 登録済み' : '';

    logger.info(`  ${mark} ${speaker.speakerName} (${speaker.speakerUuid}) ${status}`);

    if (speaker.styles && speaker.styles.length > 0) {
      for (const style of speaker.styles) {
        logger.info(`      - ${style.styleName} (ID: ${style.styleId})`);
      }
    }
    logger.info('');
  }

  logger.info('Usage: add-character <speakerId>');
}

// キャラクターを追加
async function addCharacter(speakerId: string) {
  const speakerProvider = getSpeakerProvider();
  const configDir = await getConfigDir();
  const configManager = new ConfigManager(configDir);

  logger.info(`キャラクター追加: ${speakerId}\n`);

  // 1. COEIROINK APIからキャラクター情報を取得
  logger.info('1. キャラクター情報を取得中...');
  const speakers = await speakerProvider.getSpeakers();
  const speaker = speakers.find(s => s.speakerUuid === speakerId);

  if (!speaker) {
    logger.error(`エラー: speakerId "${speakerId}" が見つかりません`);
    logger.info('\n利用可能なキャラクター一覧を表示するには、引数なしで実行してください。');
    process.exit(1);
  }

  logger.info(`  キャラクター名: ${speaker.speakerName}`);
  logger.info(`  スタイル数: ${speaker.styles?.length || 0}`);

  // 2. 話速を測定
  logger.info('\n2. 各スタイルの話速を測定中...');
  const styles: Record<string, { styleName: string; morasPerSecond: number }> = {};

  if (speaker.styles && speaker.styles.length > 0) {
    for (const style of speaker.styles) {
      logger.info(`  測定中: ${style.styleName} (ID: ${style.styleId})...`);
      const morasPerSecond = await measureStyleSpeechRate(speakerId, style.styleId);
      logger.info(`    -> ${morasPerSecond.toFixed(2)} モーラ/秒`);

      styles[style.styleId.toString()] = {
        styleName: style.styleName,
        morasPerSecond: parseFloat(morasPerSecond.toFixed(2)),
      };
    }
  }

  // 3. characterIdを生成
  let characterId = speaker.speakerName
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .substring(0, 20);

  // 日本語名などで空になった場合はspeakerIdの最初の8文字を使用
  if (!characterId) {
    characterId = speakerId.substring(0, 8);
    logger.info(`\n  日本語名のためspeakerIdから生成: ${characterId}`);
  } else {
    logger.info(`\n  生成されたcharacterId: ${characterId}`);
  }

  // 4. config.jsonに追加
  logger.info('\n3. config.jsonに追加中...');

  const config = await configManager.loadConfig();

  if (!config.characters) {
    config.characters = {};
  }

  if (config.characters[characterId]) {
    logger.info(`  警告: characterId "${characterId}" は既に存在します。上書きします。`);
  }

  const defaultStyleId = speaker.styles?.[0]?.styleId || 0;

  config.characters[characterId] = {
    speakerId: speaker.speakerUuid,
    name: speaker.speakerName,
    personality: '',
    speakingStyle: '',
    greeting: '',
    farewell: '',
    defaultStyleId,
    styles,
  };

  // config.jsonに書き込み
  const configFile = join(configDir, 'config.json');
  await configManager.writeJsonFile(configFile, config);

  logger.info(`  ✓ config.jsonに追加しました\n`);

  // 5. 完了メッセージ
  logger.info('✓ キャラクター追加が完了しました！\n');
  logger.info('次のステップ:');
  logger.info(`  1. ~/.coeiro-operator/config.json を開く`);
  logger.info(`  2. characters.${characterId} セクションに以下を追加:`);
  logger.info('     - personality: キャラクターの性格');
  logger.info('     - speakingStyle: 話し方の特徴');
  logger.info('     - greeting: アサイン時の挨拶');
  logger.info('     - farewell: 解放時のお別れメッセージ\n');
  logger.info(`  3. 動作確認:`);
  logger.info(`     operator-manager available`);
  logger.info(`     operator-manager assign ${characterId}`);
}

// CLI設定
const program = new Command();

program
  .name('add-character')
  .description('COEIROINKキャラクターをCoeiro-operatorに追加')
  .version('1.0.0', '-V, --version')
  .argument('[speakerId]', 'Speaker UUID to add (omit to list available characters)')
  .action(async (speakerId?: string) => {
    try {
      if (!speakerId) {
        await listCharacters();
      } else {
        await addCharacter(speakerId);
      }
    } catch (error) {
      logger.error('エラー:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);
