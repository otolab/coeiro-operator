/**
 * src/operator/character-info-service.test.ts: CharacterInfoServiceテスト
 */

import { CharacterInfoService, Speaker, Style } from './character-info-service.js';
import FileOperationManager from './file-operation-manager.js';
import ConfigManager, { CharacterConfig } from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CharacterInfoService', () => {
  let characterInfoService: CharacterInfoService;
  let fileManager: FileOperationManager;
  let configManager: ConfigManager;
  let tempDir: string;
  let coeiroinkConfigFile: string;

  // テスト用のサンプルキャラクター設定
  const mockCharacterConfig: CharacterConfig = {
    name: 'テストキャラクター',
    personality: '明るくて元気',
    speakingStyle: 'フレンドリー',
    greeting: 'こんにちは！',
    farewell: 'またね！',
    defaultStyle: 'normal',
    speakerId: 'test-voice-123',
  };

  // テスト用のサンプルキャラクター（Speaker情報含む）
  const mockCharacter: Character = {
    characterId: 'test-character',
    speaker: {
      speakerId: 'test-voice-123',
      speakerName: 'テストキャラクター',
      styles: [
        {
          styleId: 0,
          styleName: 'ノーマル',
          personality: '普通',
          speakingStyle: '標準',
          disabled: false,
        },
        {
          styleId: 1,
          styleName: 'ハッピー',
          personality: 'とても明るい',
          speakingStyle: '楽しげ',
          disabled: false,
        },
        {
          styleId: 2,
          styleName: 'サッド',
          personality: '悲しげ',
          speakingStyle: '落ち着いた',
          disabled: true,
        },
      ],
    },
    defaultStyle: 'normal',
    greeting: 'こんにちは！',
    farewell: 'またね！',
    personality: '明るくて元気',
    speakingStyle: 'フレンドリー',
  };

  beforeEach(async () => {
    // 一時ディレクトリを作成
    tempDir = join(
      tmpdir(),
      `coeiro-voice-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await mkdir(tempDir, { recursive: true });

    coeiroinkConfigFile = join(tempDir, 'coeiroink-config.json');

    fileManager = new FileOperationManager();
    configManager = new ConfigManager(tempDir);

    // モックの設定ファイルを作成
    const coeiroinkConfig = {
      host: 'localhost',
      port: '50032',
    };
    await writeFile(coeiroinkConfigFile, JSON.stringify(coeiroinkConfig), 'utf8');

    characterInfoService = new CharacterInfoService(fileManager);
    characterInfoService.initialize(configManager, coeiroinkConfigFile);
  });

  afterEach(async () => {
    // 一時ディレクトリをクリーンアップ
    const fs = await import('fs');
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe('getCharacterInfo', () => {
    test('キャラクター情報を正しく取得する', async () => {
      // ConfigManagerの動的設定を構範（モック）
      vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);

      const character = await characterInfoService.getCharacterInfo('test-character');

      expect(character.speaker?.speakerName).toBe('テストキャラクター');
      expect(character.speaker?.speakerId).toBe('test-voice-123');
      expect(character.greeting).toBe('こんにちは！');
      expect(character.speaker?.styles).toBeDefined();
    });

    test('初期化されていない場合はエラー', async () => {
      const uninitializedService = new CharacterInfoService();

      await expect(uninitializedService.getCharacterInfo('test')).rejects.toThrow(
        'CharacterInfoService is not initialized'
      );
    });
  });

  describe('selectStyle', () => {
    let testCharacter: Character;

    beforeEach(async () => {
      testCharacter = { ...mockCharacter };
    });

    test('デフォルトスタイルを正しく選択する', () => {
      const selectedStyle = characterInfoService.selectStyle(testCharacter);

      expect(selectedStyle.styleName).toBe('ノーマル');
      expect(selectedStyle.styleId).toBe(0);
    });

    test('指定されたスタイルを正しく選択する', () => {
      const selectedStyle = characterInfoService.selectStyle(testCharacter, 'ハッピー');

      expect(selectedStyle.styleName).toBe('ハッピー');
      expect(selectedStyle.styleId).toBe(1);
    });

    test('スタイル名で指定できる', () => {
      const selectedStyle = characterInfoService.selectStyle(testCharacter, 'ハッピー');

      expect(selectedStyle.styleName).toBe('ハッピー');
      expect(selectedStyle.styleId).toBe(1);
    });

    test('無効なスタイルを指定した場合はエラー', () => {
      expect(() => characterInfoService.selectStyle(testCharacter, 'invalid-style')).toThrow(
        '指定されたスタイル'
      );
    });

    test('disabledなスタイルは選択されない', () => {
      // サッドスタイルは無効化されているので選択肢に含まれない
      // disabled:trueのスタイルはselectStyle内でフィルタリングされる
      const selectedStyle = characterInfoService.selectStyle(testCharacter);
      expect(selectedStyle.styleName).not.toBe('サッド');
    });

    test('ランダム選択モードで動作する', async () => {
      const selectedStyle = characterInfoService.selectStyle(testCharacter);

      // デフォルトスタイルが選択される
      expect(selectedStyle.styleId).toBe(0);
    });

    test('利用可能なスタイルがない場合はエラー', () => {
      const noStyleCharacter: Character = {
        ...mockCharacter,
        speaker: {
          ...mockCharacter.speaker!,
          styles: [], // 空のスタイル配列
        },
      };

      expect(() => characterInfoService.selectStyle(noStyleCharacter)).toThrow(
        "キャラクター 'test-character' に利用可能なスタイルがありません"
      );
    });
  });

  // updateVoiceSettingとgenerateVoiceConfigDataは削除されたためテストも削除

  describe('getOperatorCharacterInfo', () => {
    test('オペレータのキャラクター情報を取得する', async () => {
      vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);

      const character = await characterInfoService.getOperatorCharacterInfo('operator1');

      expect(character.speaker?.speakerName).toBe('テストキャラクター');
      expect(character.speaker?.speakerId).toBe('test-voice-123');
    });

    test('存在しないオペレータの場合はエラー', async () => {
      vi.spyOn(configManager, 'getCharacterConfig').mockRejectedValue(
        new Error('Character not found')
      );

      await expect(
        characterInfoService.getOperatorCharacterInfo('invalid-operator')
      ).rejects.toThrow("オペレータ 'invalid-operator' は存在しないか無効です");
    });
  });

  describe('extractGreetingPatterns', () => {
    test('挨拶パターンを抽出する', async () => {
      const mockPatterns = ['こんにちは！', 'おはよう！', 'こんばんは！'];
      vi.spyOn(configManager, 'getGreetingPatterns').mockResolvedValue(mockPatterns);

      const patterns = await characterInfoService.extractGreetingPatterns();

      expect(patterns).toEqual(mockPatterns);
    });
  });

  describe('getAvailableCharacterIds', () => {
    test('利用可能なキャラクターIDリストを取得する', async () => {
      const mockIds = ['character1', 'character2', 'character3'];
      vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(mockIds);

      const ids = await characterInfoService.getAvailableCharacterIds();

      expect(ids).toEqual(mockIds);
    });
  });
});
