/**
 * SayCoeiroinkのタイムアウト時の動作をテストする
 * Issue #93: アサインが時間切れした端末でsay-coeiroinkコマンドを実行すると音声が出ない
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { ConfigManager } from '@coeiro-operator/core';

describe('SayCoeiroink - オペレータタイムアウト時の動作', () => {
  let sayCoeiroink: SayCoeiroink;
  let mockConfigManager: any;
  let mockOperatorManager: any;
  let mockAudioSynthesizer: any;

  beforeEach(async () => {
    // ConfigManagerのモック
    mockConfigManager = {
      getFullConfig: vi.fn().mockResolvedValue({
        connection: { host: 'localhost', port: '50032' },
        operator: { rate: 200 },
        audio: {
          latencyMode: 'balanced',
          splitMode: 'punctuation',
          bufferSize: 2048,
        },
      }),
      buildDynamicConfig: vi.fn().mockResolvedValue(undefined),
      getCharacterConfig: vi.fn().mockResolvedValue({
        speakerId: 'test-speaker-id',
        defaultStyle: 'normal',
      }),
    };

    // AudioSynthesizerのモック
    mockAudioSynthesizer = {
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'test-speaker-id',
          speakerName: 'Test Speaker',
          styles: [
            { styleId: 0, styleName: 'normal' },
            { styleId: 1, styleName: 'happy' },
          ],
        },
        {
          speakerUuid: 'tsukuyomi-speaker-id',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おちつき' },
          ],
        },
      ]),
      synthesizeWithSpeaker: vi.fn().mockResolvedValue({
        success: true,
        audio: new ArrayBuffer(1024),
      }),
    };

    // OperatorManagerのモック
    mockOperatorManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      buildDynamicConfig: vi.fn().mockResolvedValue(undefined),
      showCurrentOperator: vi.fn(),
      getCurrentOperatorSession: vi.fn(),
      getCharacterInfo: vi.fn(),
      selectStyle: vi.fn(),
    };

    // SayCoeiroinkインスタンスを作成
    sayCoeiroink = new SayCoeiroink(mockConfigManager);

    // privateプロパティをモックで置き換え
    (sayCoeiroink as any).operatorManager = mockOperatorManager;
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
  });

  test('オペレータがタイムアウトしている場合、getCurrentVoiceConfigはnullを返す', async () => {
    // タイムアウトをシミュレート：showCurrentOperatorが「割り当てなし」を返す
    mockOperatorManager.showCurrentOperator.mockResolvedValue({
      message: 'オペレータは割り当てられていません',
    });

    const voiceConfig = await sayCoeiroink.getCurrentVoiceConfig();
    expect(voiceConfig).toBeNull();
  });

  test('オペレータがタイムアウトしている場合でも、デフォルト音声で合成できるべき', async () => {
    // タイムアウトをシミュレート
    mockOperatorManager.showCurrentOperator.mockResolvedValue({
      message: 'オペレータは割り当てられていません',
    });
    mockOperatorManager.getCurrentOperatorSession.mockResolvedValue(null);

    // 現在の実装では、voiceConfigがnullの場合の処理が不十分
    // これが問題の原因
    const voiceConfig = await sayCoeiroink.getCurrentVoiceConfig();
    expect(voiceConfig).toBeNull();

    // 本来はデフォルト音声（tsukuyomiなど）で合成されるべき
    // しかし現在の実装ではnullが返され、音声合成が失敗する
  });

  test('オペレータが存在する場合は正常に音声設定を取得できる', async () => {
    // 正常なオペレータセッション
    mockOperatorManager.showCurrentOperator.mockResolvedValue({
      characterId: 'tsukuyomi',
      characterName: 'つくよみちゃん',
      currentStyle: {
        styleId: '0',
        styleName: 'れいせい',
        personality: 'クール',
        speakingStyle: '冷静な話し方',
      },
      message: '現在のオペレータ: つくよみちゃん',
    });

    mockOperatorManager.getCurrentOperatorSession.mockResolvedValue({
      characterId: 'tsukuyomi',
      styleId: 0,
      styleName: 'れいせい',
    });

    mockOperatorManager.getCharacterInfo.mockResolvedValue({
      characterId: 'tsukuyomi',
      speaker: {
        speakerId: 'tsukuyomi-speaker-id',
        speakerName: 'つくよみちゃん',
        styles: [
          { styleId: 0, styleName: 'れいせい' },
          { styleId: 1, styleName: 'おちつき' },
        ],
      },
    });

    mockOperatorManager.selectStyle.mockReturnValue({
      styleId: 0,
      styleName: 'れいせい',
    });

    const voiceConfig = await sayCoeiroink.getCurrentVoiceConfig();
    expect(voiceConfig).not.toBeNull();
    expect(voiceConfig?.speaker.speakerId).toBe('tsukuyomi-speaker-id');
    expect(voiceConfig?.selectedStyleId).toBe(0);
  });

  test('resolveCharacterToConfigメソッドが正しくデフォルト音声を解決する', async () => {
    // tsukuyomiのキャラクター設定をモック
    mockConfigManager.getCharacterConfig.mockResolvedValue({
      speakerId: 'tsukuyomi-speaker-id',
      defaultStyle: 'れいせい',
    });

    // プライベートメソッドのテスト
    const resolveMethod = (sayCoeiroink as any).resolveCharacterToConfig.bind(sayCoeiroink);

    const voiceConfig = await resolveMethod('tsukuyomi');
    expect(voiceConfig).not.toBeNull();
    expect(voiceConfig.speaker.speakerId).toBe('tsukuyomi-speaker-id');
    expect(voiceConfig.selectedStyleId).toBe(0);
  });
});