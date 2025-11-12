#!/usr/bin/env node
/**
 * Speaker/スタイル毎の話速（モーラ/秒）を測定するスクリプト
 *
 * 使用方法:
 *   npx tsx packages/cli/scripts/measure-speech-rate.ts
 *   npx tsx packages/cli/scripts/measure-speech-rate.ts --output ./speech-rates.json
 */

import { getSpeakerProvider, logger } from '@coeiro-operator/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parseArgs } from 'util';

// WAVファイルヘッダーから再生時間を取得
function getWavDuration(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);

  // WAVファイルのヘッダー構造を解析
  // サンプリングレートの位置: 24-27バイト
  const sampleRate = view.getUint32(24, true);

  // データチャンクサイズの位置を探す
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
      // データチャンクが見つかった
      // チャンネル数の取得 (22-23バイト)
      const channels = view.getUint16(22, true);
      // ビット深度の取得 (34-35バイト)
      const bitsPerSample = view.getUint16(34, true);

      // 再生時間 = データサイズ / (サンプリングレート * チャンネル数 * (ビット深度/8))
      const duration = chunkSize / (sampleRate * channels * (bitsPerSample / 8));
      return duration;
    }

    pos += 8 + chunkSize;
    // 必要に応じてパディング調整
    if (chunkSize % 2 !== 0) pos++;
  }

  throw new Error('WAVファイルのdataチャンクが見つかりません');
}

// 日本語テキストのモーラ数をカウント
function countMoras(text: string): number {
  // ひらがな・カタカナに変換して処理（簡易版）
  // より正確な実装には形態素解析が必要ですが、測定用途では十分
  let moraCount = 0;

  // 句読点を除去
  const cleanText = text.replace(/[。、！？\s]/g, '');

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    // 小文字（ゃゅょャュョ等）は前の文字と合わせて1モーラ
    if (nextChar && 'ゃゅょャュョぁぃぅぇぉァィゥェォ'.includes(nextChar)) {
      moraCount++;
      i++; // 次の文字をスキップ
    }
    // 長音符（ー）は1モーラ
    else if (char === 'ー') {
      moraCount++;
    }
    // 撥音（ん・ン）は1モーラ
    else if ('んン'.includes(char)) {
      moraCount++;
    }
    // 促音（っ・ッ）は1モーラ
    else if ('っッ'.includes(char)) {
      moraCount++;
    }
    // その他の文字は1モーラ
    else {
      moraCount++;
    }
  }

  return moraCount;
}

// テスト用の文章（モーラ数が正確に計算できる文章）
// 正確なモーラ数の事前カウント済み
const TEST_TEXTS = [
  {
    text: 'こんにちは今日はとてもいい天気ですね',
    // こ-ん-に-ち-は(5) + きょ-う-は(3) + と-て-も(3) + い-い(2) + て-ん-き(3) + で-す-ね(3) = 19
    expectedMoras: 19,
  },
  {
    text: 'おはようございます今日も一日頑張りましょう',
    // お-は-よ-う(4) + ご-ざ-い-ま-す(5) + きょ-う-も(3) + い-ち-に-ち(4) + が-ん-ば-り-ま-しょ-う(7) = 23
    expectedMoras: 23,
  },
  {
    text: '日本の技術は世界でもトップクラスです',
    // に-っ-ぽ-ん-の(5) + ぎ-じゅ-つ-は(4) + せ-か-い-で-も(5) + と-っ-ぷ-く-ら-す-で-す(8) = 22
    expectedMoras: 22,
  },
  {
    text: 'ありがとうございましたまたよろしくお願いします',
    // あ-り-が-と-う(5) + ご-ざ-い-ま-し-た(6) + ま-た(2) + よ-ろ-し-く(4) + お-ね-が-い-し-ま-す(7) = 24
    expectedMoras: 24,
  },
];

interface MeasurementResult {
  speakerId: string;
  speakerName: string;
  styleId: number;
  styleName: string;
  morasPerSecond: number;
  measurements: {
    textIndex: number;
    duration: number;
    moraCount: number;
    morasPerSecond: number;
  }[];
}

async function measureSpeechRate(): Promise<MeasurementResult[]> {
  const speakerProvider = getSpeakerProvider();

  // 接続設定（デフォルト値を使用）
  speakerProvider.updateConnection({
    host: 'localhost',
    port: '50032',
  });

  // 利用可能なSpeakerとスタイルを取得
  const availableSpeakers = await speakerProvider.getSpeakers();
  const results: MeasurementResult[] = [];

  logger.info('話速測定を開始します...');
  logger.info(`テスト文章数: ${TEST_TEXTS.length}`);
  logger.info(`Speaker数: ${availableSpeakers.length}`);

  for (const speaker of availableSpeakers) {
    logger.info(`\nSpeaker: ${speaker.speakerName} (${speaker.speakerUuid})`);

    for (const style of speaker.styles) {
      logger.info(`  スタイル: ${style.styleName} (ID: ${style.styleId})`);

      const measurements = [];
      let totalMoras = 0;
      let totalDuration = 0;

      // 各テスト文章で測定
      for (let i = 0; i < TEST_TEXTS.length; i++) {
        const testText = TEST_TEXTS[i];
        // 事前カウントされたモーラ数を使用（自動カウントは検証用）
        const moraCount = testText.expectedMoras;
        const autoCount = countMoras(testText.text);

        if (Math.abs(moraCount - autoCount) > 1) {
          logger.warn(`モーラ数の不一致: 期待値=${moraCount}, 自動計算=${autoCount}, テキスト="${testText.text}"`);
        }

        try {
          // 音声合成（speedScale=1.0固定）
          // COEIROINK APIを直接呼び出し
          const synthesisParams = {
            text: testText.text,
            speakerUuid: speaker.speakerUuid,
            styleId: style.styleId,
            speedScale: 1.0,
            volumeScale: 1.0,
            pitchScale: 0.0,
            intonationScale: 1.0,
            prePhonemeLength: 0.1,
            postPhonemeLength: 0.1,
            outputSamplingRate: 24000,
          };

          const url = `http://localhost:50032/v1/synthesis`;
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

          // WAVファイルから再生時間を取得
          const duration = getWavDuration(audioBuffer);
          const morasPerSecond = moraCount / duration;

          measurements.push({
            textIndex: i,
            duration,
            moraCount,
            morasPerSecond,
          });

          totalMoras += moraCount;
          totalDuration += duration;

          logger.info(`    文章${i + 1}: ${morasPerSecond.toFixed(2)} モーラ/秒 (${duration.toFixed(2)}秒, ${moraCount}モーラ)`);
        } catch (error) {
          logger.error(`    文章${i + 1}: 測定失敗 - ${error}`);
        }
      }

      if (measurements.length > 0) {
        // 平均値を計算
        const averageMorasPerSecond = totalMoras / totalDuration;

        results.push({
          speakerId: speaker.speakerUuid,
          speakerName: speaker.speakerName,
          styleId: style.styleId,
          styleName: style.styleName,
          morasPerSecond: averageMorasPerSecond,
          measurements,
        });

        logger.info(`    平均: ${averageMorasPerSecond.toFixed(2)} モーラ/秒`);
      }
    }
  }

  return results;
}

// config.json形式に変換
function formatForConfig(results: MeasurementResult[]): Record<string, any> {
  const config: Record<string, any> = {};

  // Speaker毎にグループ化
  const speakerMap = new Map<string, MeasurementResult[]>();
  for (const result of results) {
    if (!speakerMap.has(result.speakerId)) {
      speakerMap.set(result.speakerId, []);
    }
    speakerMap.get(result.speakerId)!.push(result);
  }

  // 各Speakerのデフォルトスタイル（ID:0または最初のスタイル）の値を設定
  for (const [speakerId, speakerResults] of Array.from(speakerMap.entries())) {
    const defaultStyle = speakerResults.find(r => r.styleId === 0) || speakerResults[0];
    if (defaultStyle) {
      // スピーカー名をキーとして使用（config.jsonの形式に合わせる）
      const speakerKey = defaultStyle.speakerName.toLowerCase().replace(/\s+/g, '_');

      config[speakerKey] = {
        baseMorasPerSecond: parseFloat(defaultStyle.morasPerSecond.toFixed(2)),
        // スタイル毎の詳細も保存（オプション）
        styles: Object.fromEntries(
          speakerResults.map(r => [
            r.styleName,
            parseFloat(r.morasPerSecond.toFixed(2))
          ])
        ),
      };
    }
  }

  return config;
}

async function main() {
  try {
    // コマンドライン引数を解析
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        all: {
          type: 'boolean',
          default: false,
        },
        speaker: {
          type: 'string',
          default: undefined,
        },
        style: {
          type: 'string',
          default: undefined,
        },
        output: {
          type: 'string',
          short: 'o',
          default: undefined,
        },
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
      },
    });

    if (values.help) {
      console.log(`
話速測定ツール - Speaker/スタイル毎のモーラ/秒を測定

使用方法:
  npx tsx packages/cli/scripts/measure-speech-rate.ts [オプション]

オプション:
  --all                     全スピーカー・全スタイルを測定
  --speaker <name>          スピーカー名を指定
  --style <name>            スタイル名を指定
  -o, --output <path>       測定結果をJSONファイルに保存
  -h, --help                ヘルプを表示

例:
  # 特定のスピーカー・スタイルを測定
  npx tsx packages/cli/scripts/measure-speech-rate.ts --speaker アルマちゃん --style 泣き声

  # 全スピーカー・全スタイルを測定
  npx tsx packages/cli/scripts/measure-speech-rate.ts --all

説明:
  COEIROINKの各Speaker/スタイルで標準話速（speedScale=1.0）のモーラ/秒を測定します。
  測定結果はconfig.jsonのcharacters設定に追加できる形式で出力されます。
`);
      process.exit(0);
    }

    // COEIROINKサーバーの接続確認
    logger.info('COEIROINKサーバーに接続中...');

    const speakerProvider = getSpeakerProvider();
    speakerProvider.updateConnection({
      host: 'localhost',
      port: '50032',
    });

    const availableSpeakers = await speakerProvider.getSpeakers();

    let results: MeasurementResult[];

    if (values.all) {
      // 全測定モード
      logger.info('全スピーカー・全スタイルを測定します...');
      results = await measureSpeechRate();
    } else if (values.speaker && values.style) {
      // 特定のスピーカー・スタイルを測定
      const selectedSpeaker = availableSpeakers.find(s => s.speakerName === values.speaker);
      if (!selectedSpeaker) {
        console.error(`スピーカー "${values.speaker}" が見つかりません`);
        console.log('\n利用可能なスピーカー:');
        availableSpeakers.forEach(s => console.log(`  - ${s.speakerName}`));
        process.exit(1);
      }

      const selectedStyle = selectedSpeaker.styles.find(s => s.styleName === values.style);
      if (!selectedStyle) {
        console.error(`スタイル "${values.style}" が見つかりません`);
        console.log(`\n${selectedSpeaker.speakerName} の利用可能なスタイル:`);
        selectedSpeaker.styles.forEach(s => console.log(`  - ${s.styleName}`));
        process.exit(1);
      }

      logger.info(`測定: ${selectedSpeaker.speakerName} - ${selectedStyle.styleName}`);
      results = [];

      const measurements = [];
      let totalMoras = 0;
      let totalDuration = 0;

      for (let i = 0; i < TEST_TEXTS.length; i++) {
        const testText = TEST_TEXTS[i];
        const moraCount = testText.expectedMoras;

        try {
          const synthesisParams = {
            text: testText.text,
            speakerUuid: selectedSpeaker.speakerUuid,
            styleId: selectedStyle.styleId,
            speedScale: 1.0,
            volumeScale: 1.0,
            pitchScale: 0.0,
            intonationScale: 1.0,
            prePhonemeLength: 0.1,
            postPhonemeLength: 0.1,
            outputSamplingRate: 24000,
          };

          const url = `http://localhost:50032/v1/synthesis`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(synthesisParams),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const audioBuffer = await response.arrayBuffer();
          const duration = getWavDuration(audioBuffer);
          const morasPerSecond = moraCount / duration;

          measurements.push({
            textIndex: i,
            duration,
            moraCount,
            morasPerSecond,
          });

          totalMoras += moraCount;
          totalDuration += duration;

          logger.info(`文章${i + 1}: ${morasPerSecond.toFixed(2)} モーラ/秒 (${duration.toFixed(2)}秒, ${moraCount}モーラ)`);
        } catch (error) {
          logger.error(`文章${i + 1}: 測定失敗 - ${error}`);
        }
      }

      if (measurements.length > 0) {
        const averageMorasPerSecond = totalMoras / totalDuration;

        results.push({
          speakerId: selectedSpeaker.speakerUuid,
          speakerName: selectedSpeaker.speakerName,
          styleId: selectedStyle.styleId,
          styleName: selectedStyle.styleName,
          morasPerSecond: averageMorasPerSecond,
          measurements,
        });

        logger.info(`平均: ${averageMorasPerSecond.toFixed(2)} モーラ/秒`);
      }
    } else {
      // オプション不足
      console.error('--speaker と --style を両方指定するか、--all を指定してください');
      console.log('詳細は --help を参照してください');
      process.exit(1);
    }

    // 結果の表示
    console.log('\n========== 測定結果 ==========');
    for (const result of results) {
      console.log(`${result.speakerName} - ${result.styleName}: ${result.morasPerSecond.toFixed(2)} モーラ/秒`);
    }

    // ファイルへの保存
    if (values.output) {
      const outputPath = path.resolve(values.output as string);
      await fs.writeFile(
        outputPath,
        JSON.stringify({
          timestamp: new Date().toISOString(),
          results,
        }, null, 2)
      );
      logger.info(`測定結果を保存しました: ${outputPath}`);
    }

    logger.info('\n測定完了！');
  } catch (error) {
    logger.error('測定中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトとして実行された場合
// ESMではimport.meta.urlを使用
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { countMoras, getWavDuration, measureSpeechRate, formatForConfig };