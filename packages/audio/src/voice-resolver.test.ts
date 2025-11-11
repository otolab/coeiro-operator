/**
 * voice-resolver.test.ts: VoiceResolverのテスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VoiceResolver } from './voice-resolver.js';
import { OperatorManager, ConfigManager } from '@coeiro-operator/core';
import { AudioSynthesizer } from './audio-synthesizer.js';
import type { Character, Speaker } from '@coeiro-operator/core';
import type { VoiceConfig } from './types.js';

describe('VoiceResolver', () => {
  let voiceResolver: VoiceResolver;
  let mockConfigManager: ConfigManager;
  let mockOperatorManager: OperatorManager;
  let mockAudioSynthesizer: AudioSynthesizer;

  const mockCharacter: Character = {
    characterId: 'test-character',
    speakerId: 'test-speaker-uuid',
    speakerName: 'テストスピーカー',
    defaultStyleId: 0,
    greeting: 'こんにちは',
    farewell: 'さようなら',
    personality: 'フレンドリー',
    speakingStyle: '丁寧',
    styles: {
      0: { styleId: 0, styleName: 'ノーマル' },
      1: { styleId: 1, styleName: 'ハッピー' },
    },
  };

  const mockSpeakers = [
    {
      speakerUuid: 'test-speaker-uuid',
      speakerName: 'テストスピーカー',
      styles: [
        { styleId: 0, styleName: 'ノーマル' },
        { styleId: 1, styleName: 'ハッピー' },
      ],
    },
    {
      speakerUuid: 'tsukuyomi-uuid',
      speakerName: 'つくよみちゃん',
      styles: [
        { styleId: 0, styleName: 'れいせい' },
        { styleId: 1, styleName: 'おしとやか' },
      ],
    },
  ];

  beforeEach(() => {
    // ConfigManagerのモック
    mockConfigManager = {
      getCharacterConfig: vi.fn().mockImplementation((characterId: string) => {
        if (characterId === 'test-character') {
          return Promise.resolve({
            characterId: 'test-character',
            speakerId: 'test-speaker-uuid',
            defaultStyleId: 0,
            styles: {
              0: { styleName: 'ノーマル', morasPerSecond: 7.5 },
              1: { styleName: 'ハッピー', morasPerSecond: 8.0 },
            },
          });
        }
        if (characterId === 'tsukuyomi') {
          return Promise.resolve({
            characterId: 'tsukuyomi',
            speakerId: 'tsukuyomi-uuid',
            defaultStyleId: 0,
            styles: {
              0: { styleName: 'れいせい', morasPerSecond: 7.5 },
            },
          });
        }
        return Promise.resolve(null);
      }),
    } as any;

    // OperatorManagerのモック
    mockOperatorManager = {
      showCurrentOperator: vi.fn().mockResolvedValue({
        characterId: 'test-character',
      }),
      getCharacterInfo: vi.fn().mockResolvedValue(mockCharacter),
      getCurrentOperatorSession: vi.fn().mockResolvedValue({
        characterId: 'test-character',
        styleId: 0,
      }),
      selectStyle: vi.fn().mockImplementation((character: Character, styleName: string | null) => {
        if (styleName) {
          const style = Object.values(character.styles).find(s => s.styleName === styleName);
          return style || Object.values(character.styles)[0];
        }
        return Object.values(character.styles)[0];
      }),
    } as any;

    // AudioSynthesizerのモック
    mockAudioSynthesizer = {
      getSpeakers: vi.fn().mockResolvedValue(mockSpeakers),
    } as any;

    voiceResolver = new VoiceResolver(
      mockConfigManager,
      mockOperatorManager,
      mockAudioSynthesizer
    );
  });

  describe('getCurrentVoiceConfig', () => {
    it('現在のオペレータの音声設定を取得できる', async () => {
      const result = await voiceResolver.getCurrentVoiceConfig();

      expect(result).toBeDefined();
      expect(result?.speakerId).toBe('test-speaker-uuid');
      expect(result?.selectedStyleId).toBe(0);
    });

    it('スタイル名を指定して音声設定を取得できる', async () => {
      const result = await voiceResolver.getCurrentVoiceConfig('ハッピー');

      expect(result).toBeDefined();
      expect(result?.selectedStyleId).toBe(1);
    });

    it('オペレータが割り当てられていない場合はnullを返す', async () => {
      mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
        characterId: null,
      });

      const result = await voiceResolver.getCurrentVoiceConfig();

      expect(result).toBeNull();
    });

    it('セッションに保存されたスタイルIDを使用する', async () => {
      mockOperatorManager.getCurrentOperatorSession = vi.fn().mockResolvedValue({
        characterId: 'test-character',
        styleId: 1,
      });

      const result = await voiceResolver.getCurrentVoiceConfig();

      expect(result?.selectedStyleId).toBe(1);
    });
  });

  describe('resolveCharacterToConfig', () => {
    it('CharacterIdからVoiceConfigを生成できる', async () => {
      const result = await voiceResolver.resolveCharacterToConfig('test-character');

      expect(result).toBeDefined();
      expect(result.speaker.speakerId).toBe('test-speaker-uuid');
      expect(result.selectedStyleId).toBe(0);
    });

    it('スタイル名を指定してVoiceConfigを生成できる', async () => {
      const result = await voiceResolver.resolveCharacterToConfig('test-character', 'ハッピー');

      expect(result.selectedStyleId).toBe(1);
    });

    it('存在しないキャラクターの場合はエラーを投げる', async () => {
      await expect(
        voiceResolver.resolveCharacterToConfig('unknown-character')
      ).rejects.toThrow('Character not found: unknown-character');
    });

    it('Speakerが見つからない場合はエラーを投げる', async () => {
      mockConfigManager.getCharacterConfig = vi.fn().mockResolvedValue({
        characterId: 'test-character',
        speakerId: 'unknown-speaker',
        defaultStyle: 'ノーマル',
      });

      await expect(
        voiceResolver.resolveCharacterToConfig('test-character')
      ).rejects.toThrow("Speaker 'unknown-speaker' not found");
    });
  });

  describe('resolveVoiceConfig', () => {
    it('オペレータの音声設定を使用する', async () => {
      const result = await voiceResolver.resolveVoiceConfig(null, undefined, true);

      expect(result.speakerId).toBe('test-speaker-uuid');
      expect(result.selectedStyleId).toBe(0);
    });

    it('文字列（CharacterId）から音声設定を解決する', async () => {
      const result = await voiceResolver.resolveVoiceConfig('test-character', undefined, true);

      expect(result.speakerId).toBe('test-speaker-uuid');
    });

    it('VoiceConfigオブジェクトをそのまま返す', async () => {
      const voiceConfig: VoiceConfig = {
        speaker: {
          speakerId: 'direct-speaker',
          speakerName: '直接指定',
          styles: [{ styleId: 10, styleName: 'カスタム' }],
        },
        selectedStyleId: 10,
      };

      const result = await voiceResolver.resolveVoiceConfig(voiceConfig, undefined, true);

      expect(result).toBe(voiceConfig);
      expect(result.speaker.speakerId).toBe('direct-speaker');
    });

    it('オペレータ未割り当てでフォールバックが有効な場合はデフォルトキャラクターを使用', async () => {
      mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
        characterId: null,
      });

      const result = await voiceResolver.resolveVoiceConfig(null, undefined, true);

      expect(result.speaker.speakerId).toBe('tsukuyomi-uuid');
    });

    it('オペレータ未割り当てでフォールバック無効の場合はエラーを投げる', async () => {
      mockOperatorManager.showCurrentOperator = vi.fn().mockResolvedValue({
        characterId: null,
      });

      await expect(
        voiceResolver.resolveVoiceConfig(null, undefined, false)
      ).rejects.toThrow('オペレータが割り当てられていません');
    });
  });
});