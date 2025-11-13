/**
 * speed-utils.ts: 速度変換ユーティリティ
 */

import { logger } from '@coeiro-operator/common';

/**
 * 速度指定の内部表現（数値のみ）
 */
export interface SpeedSpecification {
  rate?: number;    // 絶対速度（WPM）
  factor?: number;  // 相対速度（倍率）
}

/**
 * 話速情報（速度計算用）
 */
export interface SpeakerRateInfo {
  baseMorasPerSecond?: number;      // キャラクターの基準話速
  styleMorasPerSecond?: number;     // スタイルの基準話速
}

/**
 * WPM基準での標準話速
 */
const BASE_RATE_WPM = 200;
const BASE_MORAS_PER_SECOND = 7.5; // 200 WPM時のモーラ/秒

/**
 * WPMからCOEIROINKのspeed値を計算
 * @param wpm - Words Per Minute
 * @param rateInfo - 話速情報（スタイル別の話速情報を含む）
 * @returns COEIROINKのspeed値
 */
function calculateSpeedFromWPM(wpm: number, rateInfo: SpeakerRateInfo): number {
  const targetMorasPerSecond = BASE_MORAS_PER_SECOND * (wpm / BASE_RATE_WPM);

  // 話者の実測速度を取得
  let speakerMorasPerSecond = BASE_MORAS_PER_SECOND;

  // styleMorasPerSecondが設定されていればそれを使用
  if (rateInfo.styleMorasPerSecond) {
    speakerMorasPerSecond = rateInfo.styleMorasPerSecond;
    logger.debug(`話者固有速度を使用: ${speakerMorasPerSecond} モーラ/秒`);
  }
  // baseMorasPerSecondフォールバック
  else if (rateInfo.baseMorasPerSecond) {
    speakerMorasPerSecond = rateInfo.baseMorasPerSecond;
    logger.debug(`基準速度を使用: ${speakerMorasPerSecond} モーラ/秒`);
  } else {
    logger.debug(`デフォルト速度を使用: ${BASE_MORAS_PER_SECOND} モーラ/秒`);
  }

  const speed = targetMorasPerSecond / speakerMorasPerSecond;
  logger.debug(
    `WPM変換: ${wpm} WPM → ${targetMorasPerSecond.toFixed(2)}モーラ/秒 ÷ ${speakerMorasPerSecond.toFixed(2)}モーラ/秒 → speed=${speed.toFixed(2)}`
  );

  return speed;
}

/**
 * 速度指定をCOEIROINKのspeedScale値に変換
 * @param spec - 速度指定
 * @param rateInfo - 話速情報（スタイル別の話速情報を含む）
 * @returns COEIROINKのspeed値（0.5〜2.0）
 */
export function convertToSpeed(spec: SpeedSpecification, rateInfo: SpeakerRateInfo): number {
  logger.debug(`convertToSpeed入力 - spec: ${JSON.stringify(spec)}`);
  logger.debug(`convertToSpeed入力 - spec.rate type: ${typeof spec.rate}, value: ${spec.rate}`);
  logger.debug(`convertToSpeed入力 - spec.factor type: ${typeof spec.factor}, value: ${spec.factor}`);

  let speed: number;

  // factorが優先
  if (spec.factor !== undefined) {
    speed = spec.factor;
    logger.debug(`相対速度: factor=${spec.factor} → speed=${speed}`);
  }
  // rateをWPMとして処理
  else if (spec.rate !== undefined) {
    speed = calculateSpeedFromWPM(spec.rate, rateInfo);
    logger.debug(`絶対速度: rate=${spec.rate} WPM → speed=${speed.toFixed(2)}`);
  }
  // 未指定
  else {
    speed = 1.0;
    logger.debug('速度未指定: speed=1.0');
  }

  // COEIROINKの制限範囲内に収める
  const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
  if (clampedSpeed !== speed) {
    logger.warn(`速度を範囲内に制限: ${speed.toFixed(2)} → ${clampedSpeed}`);
  }

  return clampedSpeed;
}

/**
 * rateとfactorの両方が指定された場合の検証
 * @param spec - 速度指定
 * @throws 両方が指定されている場合はエラー
 */
export function validateSpeedParameters(spec: SpeedSpecification): void {
  if (spec.rate !== undefined && spec.factor !== undefined) {
    throw new Error('rateとfactorは同時に指定できません。どちらか一方を指定してください。');
  }
}