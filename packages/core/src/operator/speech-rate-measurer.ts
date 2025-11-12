/**
 * 話速測定ユーティリティ
 * Speaker/Styleの話速（モーラ/秒）を測定する機能を提供
 */

import { logger } from '@coeiro-operator/common';
import ConfigManager from './config/config-manager.js';

/**
 * 話速測定クラス
 */
export class SpeechRateMeasurer {
  constructor(private configManager: ConfigManager) {}

  /**
   * 指定されたスタイルの話速を測定
   */
  async measureSpeechRateForStyles(
    speakerId: string,
    styles: Array<{ styleId: number; styleName: string }>
  ): Promise<Array<{
    styleId: number;
    styleName: string;
    morasPerSecond: number;
  }>> {
    // テスト用の文章（モーラ数が正確に計算できる文章）
    const TEST_TEXTS = [
      { text: 'こんにちは今日はとてもいい天気ですね', expectedMoras: 19 },
      { text: 'おはようございます今日も一日頑張りましょう', expectedMoras: 23 },
      { text: '日本の技術は世界でもトップクラスです', expectedMoras: 22 },
      { text: 'ありがとうございましたまたよろしくお願いします', expectedMoras: 24 },
    ];

    const results = [];

    for (const style of styles) {
      logger.info(`  スタイル: ${style.styleName} (ID: ${style.styleId})`);

      let totalMoras = 0;
      let totalDuration = 0;

      // 各テスト文章で測定
      for (let i = 0; i < TEST_TEXTS.length; i++) {
        const testText = TEST_TEXTS[i];
        const moraCount = testText.expectedMoras;

        try {
          // 音声合成（speedScale=1.0固定）
          const synthesisParams = {
            text: testText.text,
            speakerUuid: speakerId,
            styleId: style.styleId,
            speedScale: 1.0,
            volumeScale: 1.0,
            pitchScale: 0.0,
            intonationScale: 1.0,
            prePhonemeLength: 0.1,
            postPhonemeLength: 0.1,
            outputSamplingRate: 24000,
          };

          const connectionConfig = await this.configManager.getConnectionConfig();
          const url = `http://${connectionConfig.host}:${connectionConfig.port}/v1/synthesis`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(synthesisParams),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const audioBuffer = await response.arrayBuffer();

          // WAVファイルから再生時間を取得
          const duration = getWavDuration(audioBuffer);
          const morasPerSecond = moraCount / duration;

          totalMoras += moraCount;
          totalDuration += duration;

          logger.info(`    文章${i + 1}: ${morasPerSecond.toFixed(2)} モーラ/秒 (${duration.toFixed(2)}秒, ${moraCount}モーラ)`);
        } catch (error) {
          logger.error(`    文章${i + 1}: 測定失敗 - ${error}`);
        }
      }

      if (totalDuration > 0) {
        // 平均値を計算
        const averageMorasPerSecond = totalMoras / totalDuration;

        results.push({
          styleId: style.styleId,
          styleName: style.styleName,
          morasPerSecond: parseFloat(averageMorasPerSecond.toFixed(2)),
        });

        logger.info(`    平均: ${averageMorasPerSecond.toFixed(2)} モーラ/秒`);
      }
    }

    return results;
  }
}

/**
 * WAVファイルヘッダーから再生時間を取得
 */
export function getWavDuration(buffer: ArrayBuffer): number {
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

/**
 * Speaker名からcharacterIdを生成
 */
export function generateCharacterId(speakerName: string): string {
  // speakerNameから英数字以外を除去して小文字化
  return speakerName.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
}
