/**
 * Utils Unit Tests
 * utils.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { OperatorManager, CharacterInfoService, Character } from '@coeiro-operator/core';
import {
  validateOperatorInput,
  assignOperator,
  extractStyleInfo,
  formatAssignmentResult,
  getTargetCharacter,
  formatStylesResult,
} from './utils.js';
import type { AssignResult, StyleInfo } from './types.js';

describe('Utils', () => {
  let mockOperatorManager: OperatorManager;
  let mockCharacterInfoService: CharacterInfoService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOperatorManager = {
      assignSpecificOperator: vi.fn(),
      assignRandomOperator: vi.fn(),
      showCurrentOperator: vi.fn(),
    } as any;

    mockCharacterInfoService = {
      getCharacterInfo: vi.fn(),
    } as any;
  });

  describe('validateOperatorInput', () => {
    test('英語表記のオペレータ名は許可されること', () => {
      expect(() => validateOperatorInput('tsukuyomi')).not.toThrow();
      expect(() => validateOperatorInput('alma')).not.toThrow();
    });

    test('undefinedは許可されること', () => {
      expect(() => validateOperatorInput(undefined)).not.toThrow();
    });

    test('空文字列は許可されること', () => {
      expect(() => validateOperatorInput('')).not.toThrow();
    });

    test('日本語表記のオペレータ名はエラーになること', () => {
      expect(() => validateOperatorInput('つくよみちゃん')).toThrow(
        'オペレータ名は英語表記で指定してください'
      );
      expect(() => validateOperatorInput('ディアちゃん')).toThrow(
        'オペレータ名は英語表記で指定してください'
      );
    });

    test('漢字を含むオペレータ名はエラーになること', () => {
      expect(() => validateOperatorInput('花子')).toThrow(
        'オペレータ名は英語表記で指定してください'
      );
    });
  });

  describe('assignOperator', () => {
    test('オペレータ割り当てが成功すること', async () => {
      const mockResult: AssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        currentStyle: {
          styleId: '0',
          styleName: 'ノーマル',
          personality: '素直',
          speakingStyle: '丁寧語',
        },
        speakerConfig: {
          speakerId: 'speaker-123',
          styleId: 0,
        },
      };

      vi.mocked(mockOperatorManager.assignSpecificOperator).mockResolvedValue(mockResult as any);

      const result = await assignOperator(mockOperatorManager, 'tsukuyomi', undefined);

      expect(result).toEqual(mockResult);
      expect(mockOperatorManager.assignSpecificOperator).toHaveBeenCalledWith('tsukuyomi', undefined);
    });

    test('スタイル指定付きでオペレータ割り当てが成功すること', async () => {
      const mockResult: AssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        currentStyle: {
          styleId: 'normal',
          styleName: 'ノーマル',
          personality: '素直で優しい',
          speakingStyle: '丁寧語',
        },
        speakerConfig: {
          speakerId: 'speaker-123',
          styleId: 0,
        },
      };

      vi.mocked(mockOperatorManager.assignSpecificOperator).mockResolvedValue(mockResult as any);

      const result = await assignOperator(mockOperatorManager, 'tsukuyomi', 'ノーマル');

      expect(result).toEqual(mockResult);
      expect(mockOperatorManager.assignSpecificOperator).toHaveBeenCalledWith('tsukuyomi', 'ノーマル');
    });

    test('ランダム割り当てが成功すること', async () => {
      const mockResult: AssignResult = {
        characterId: 'alma',
        characterName: 'ALMA',
        currentStyle: {
          styleId: '0',
          styleName: 'のーまる',
          personality: 'クールで知的',
          speakingStyle: '敬語',
        },
        speakerConfig: {
          speakerId: 'speaker-456',
          styleId: 0,
        },
      };

      vi.mocked(mockOperatorManager.assignRandomOperator).mockResolvedValue(mockResult as any);

      const result = await assignOperator(mockOperatorManager, undefined, undefined);

      expect(result).toEqual(mockResult);
      expect(mockOperatorManager.assignRandomOperator).toHaveBeenCalledWith(undefined);
    });
  });

  describe('extractStyleInfo', () => {
    test('スタイル情報が正しく抽出されること', () => {
      const character: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {
          0: {
            styleName: 'ノーマル',
            personality: '素直で優しい',
            speakingStyle: '丁寧語',
            disabled: false,
          },
          1: {
            styleName: 'ハッピー',
            personality: '明るく元気',
            speakingStyle: '関西弁',
            disabled: false,
          },
        },
      };

      const styles = extractStyleInfo(character);

      expect(styles).toHaveLength(2);
      expect(styles[0]).toEqual({
        id: '0',
        name: 'ノーマル',
        personality: '素直で優しい',
        speakingStyle: '丁寧語',
        morasPerSecond: undefined,
      });
      expect(styles[1]).toEqual({
        id: '1',
        name: 'ハッピー',
        personality: '明るく元気',
        speakingStyle: '関西弁',
        morasPerSecond: undefined,
      });
    });

    test('stylesが未定義の場合は空配列を返すこと', () => {
      const character: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
      } as any;

      const styles = extractStyleInfo(character);

      expect(styles).toEqual([]);
    });
  });

  describe('formatAssignmentResult', () => {
    test('スタイル情報なしの場合の整形が正しいこと', () => {
      const assignResult: AssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
      };
      const availableStyles: StyleInfo[] = [];

      const result = formatAssignmentResult(assignResult, availableStyles);

      expect(result).toContain('をアサインしました');
      expect(result).toContain('つくよみちゃん');
      expect(result).toContain('tsukuyomi');
    });

    test('スタイル情報ありの場合の整形が正しいこと', () => {
      const assignResult: AssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        currentStyle: {
          styleId: 'normal',
          styleName: 'ノーマル',
          personality: '素直で優しい',
          speakingStyle: '丁寧語',
        },
      };
      const availableStyles: StyleInfo[] = [
        {
          id: 'normal',
          name: 'ノーマル',
          personality: '素直で優しい',
          speakingStyle: '丁寧語',
        },
        {
          id: 'happy',
          name: 'ハッピー',
          personality: '明るく元気',
          speakingStyle: '関西弁',
        },
      ];

      const result = formatAssignmentResult(assignResult, availableStyles);

      expect(result).toContain('をアサインしました');
      expect(result).toContain('つくよみちゃん');
      expect(result).toContain('ノーマル');
      expect(result).toContain('素直で優しい');
      expect(result).toContain('丁寧語');
      expect(result).toContain('ハッピー');
    });

    test('グリーティングが含まれる場合の整形が正しいこと', () => {
      const assignResult: AssignResult = {
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        greeting: 'こんにちは!',
      };
      const availableStyles: StyleInfo[] = [];

      const result = formatAssignmentResult(assignResult, availableStyles);

      expect(result).toContain('こんにちは!');
    });
  });

  describe('getTargetCharacter', () => {
    test('characterId指定時に指定したキャラクター情報が取得できること', async () => {
      const mockCharacter: Character = {
        characterId: 'alma',
        speakerId: 'speaker-456',
        speakerName: 'ALMA',
        defaultStyleId: 0,
        greeting: 'Hello',
        farewell: 'Goodbye',
        personality: 'Cool',
        speakingStyle: 'Calm',
        styles: {},
      };

      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);

      const result = await getTargetCharacter(
        mockOperatorManager,
        mockCharacterInfoService,
        'alma'
      );

      expect(result.character).toEqual(mockCharacter);
      expect(result.characterId).toBe('alma');
      expect(mockCharacterInfoService.getCharacterInfo).toHaveBeenCalledWith('alma');
    });

    test('characterId未指定時に現在のオペレータ情報が取得できること', async () => {
      const mockCharacter: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {},
      };

      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: 'tsukuyomi',
        characterName: 'つくよみちゃん',
        message: '現在のオペレータ: つくよみちゃん',
      });
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(mockCharacter);

      const result = await getTargetCharacter(
        mockOperatorManager,
        mockCharacterInfoService,
        undefined
      );

      expect(result.character).toEqual(mockCharacter);
      expect(result.characterId).toBe('tsukuyomi');
    });

    test('オペレータ未アサインの場合エラーが発生すること', async () => {
      vi.mocked(mockOperatorManager.showCurrentOperator).mockResolvedValue({
        characterId: null,
        characterName: null,
        message: 'オペレータが割り当てられていません',
      });

      await expect(
        getTargetCharacter(mockOperatorManager, mockCharacterInfoService, undefined)
      ).rejects.toThrow('オペレータが割り当てられていません');
    });

    test('キャラクター情報が見つからない場合エラーが発生すること', async () => {
      vi.mocked(mockCharacterInfoService.getCharacterInfo).mockResolvedValue(null);

      await expect(
        getTargetCharacter(mockOperatorManager, mockCharacterInfoService, 'invalid')
      ).rejects.toThrow("キャラクター 'invalid' が見つかりません");
    });
  });

  describe('formatStylesResult', () => {
    test('スタイル情報の整形が正しいこと', () => {
      const character: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {},
      };
      const styles: StyleInfo[] = [
        {
          id: 'normal',
          name: 'ノーマル',
          personality: '素直で優しい',
          speakingStyle: '丁寧語',
        },
        {
          id: 'happy',
          name: 'ハッピー',
          personality: '明るく元気',
          speakingStyle: '関西弁',
        },
      ];

      const result = formatStylesResult(character, styles);

      expect(result).toContain('つくよみちゃん');
      expect(result).toContain('ノーマル');
      expect(result).toContain('素直で優しい');
      expect(result).toContain('丁寧語');
      expect(result).toContain('ハッピー');
      expect(result).toContain('明るく元気');
      expect(result).toContain('関西弁');
    });

    test('スタイルが空の場合のメッセージが含まれること', () => {
      const character: Character = {
        characterId: 'tsukuyomi',
        speakerId: 'speaker-123',
        speakerName: 'つくよみちゃん',
        defaultStyleId: 0,
        greeting: 'こんにちは',
        farewell: 'さようなら',
        personality: '素直',
        speakingStyle: '丁寧語',
        styles: {},
      };
      const styles: StyleInfo[] = [];

      const result = formatStylesResult(character, styles);

      expect(result).toContain('つくよみちゃん');
      expect(result).toContain('利用可能なスタイルがありません');
    });
  });
});
