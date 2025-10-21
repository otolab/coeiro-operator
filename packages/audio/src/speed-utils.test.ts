/**
 * speed-utils.test.ts: 速度指定システムのテスト
 */

import { describe, it, expect } from 'vitest';
import {
  convertToSpeed,
  validateSpeedParameters,
  type SpeedSpecification,
} from './speed-utils.js';
import type { VoiceConfig } from './types.js';

// モックのVoiceConfig
const createMockVoiceConfig = (styleMorasPerSecond?: Record<number, number>): VoiceConfig => ({
  speaker: {
    speakerId: 'test-speaker',
    speakerName: 'Test Speaker',
    styles: [
      { styleId: 0, styleName: 'normal' },
      { styleId: 1, styleName: 'happy' },
    ],
  },
  selectedStyleId: 0,
  styleMorasPerSecond,
});

describe('convertToSpeed', () => {
  describe('速度未指定', () => {
    it('speed=1.0を返す', () => {
      const spec: SpeedSpecification = {};
      const voiceConfig = createMockVoiceConfig();
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(1.0);
    });
  });

  describe('相対速度（factor）指定', () => {
    it('指定された倍率をそのままspeedとして返す', () => {
      const spec: SpeedSpecification = { factor: 1.5 };
      const voiceConfig = createMockVoiceConfig();
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(1.5);
    });

    it('最小値0.5に制限される', () => {
      const spec: SpeedSpecification = { factor: 0.3 };
      const voiceConfig = createMockVoiceConfig();
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(0.5);
    });

    it('最大値2.0に制限される', () => {
      const spec: SpeedSpecification = { factor: 2.5 };
      const voiceConfig = createMockVoiceConfig();
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(2.0);
    });
  });

  describe('絶対速度（rate）指定', () => {
    it('標準話速200WPMでspeed=1.0を返す', () => {
      const spec: SpeedSpecification = { rate: 200 };
      const voiceConfig = createMockVoiceConfig({ 0: 7.5 });
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(1.0);
    });

    it('話者固有速度を考慮して変換する', () => {
      const spec: SpeedSpecification = { rate: 200 };
      // 話者の実測速度が15mora/s（標準の2倍速い）
      const voiceConfig = createMockVoiceConfig({ 0: 15 });
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(0.5); // 半分の速度で標準速度を実現
    });

    it('スタイル別の話速を考慮する', () => {
      const spec: SpeedSpecification = { rate: 200 };
      const voiceConfig = createMockVoiceConfig({ 0: 10, 1: 5 });
      voiceConfig.selectedStyleId = 1; // happy style
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(1.5); // 5mora/s → 7.5mora/sにするには1.5倍速
    });
  });

  describe('優先順位', () => {
    it('factorが指定されていればrateより優先される', () => {
      const spec: SpeedSpecification = { rate: 300, factor: 1.2 };
      const voiceConfig = createMockVoiceConfig();
      const speed = convertToSpeed(spec, voiceConfig);
      expect(speed).toBe(1.2); // factorが優先
    });
  });
});

describe('validateSpeedParameters', () => {
  it('rateとfactorが両方undefinedの場合はエラーを投げない', () => {
    expect(() => validateSpeedParameters({})).not.toThrow();
  });

  it('rateのみ指定の場合はエラーを投げない', () => {
    expect(() => validateSpeedParameters({ rate: 200 })).not.toThrow();
  });

  it('factorのみ指定の場合はエラーを投げない', () => {
    expect(() => validateSpeedParameters({ factor: 1.5 })).not.toThrow();
  });

  it('rateとfactor両方指定の場合はエラーを投げる', () => {
    expect(() => validateSpeedParameters({ rate: 200, factor: 1.5 })).toThrow(
      'rateとfactorは同時に指定できません。どちらか一方を指定してください。'
    );
  });
});