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
        speaking_style: 'フレンドリー',
        greeting: 'こんにちは！',
        farewell: 'またね！',
        default_style: 'normal',
        style_selection: 'default',
        voice_id: 'test-voice-123',
        available_styles: {
            normal: {
                styleId: 0,
                styleName: 'ノーマル',
                personality: '明るくて元気',
                speaking_style: 'フレンドリー'
            },
            happy: {
                styleId: 1,
                styleName: 'ハッピー',
                personality: 'とても明るい',
                speaking_style: '楽しげ'
            },
            sad: {
                styleId: 2,
                styleName: 'サッド',
                personality: '少し落ち込んだ',
                speaking_style: '静か',
                disabled: true // 無効化されたスタイル
            }
        }
    };

    beforeEach(async () => {
        // 一時ディレクトリを作成
        tempDir = join(tmpdir(), `coeiro-voice-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await mkdir(tempDir, { recursive: true });
        
        coeiroinkConfigFile = join(tempDir, 'coeiroink-config.json');
        
        fileManager = new FileOperationManager();
        configManager = new ConfigManager(tempDir);
        
        // モックの設定ファイルを作成
        const coeiroinkConfig = {
            host: 'localhost',
            port: '50032'
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
            // ConfigManagerの動的設定を構築（モック）
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            
            const character = await characterInfoService.getCharacterInfo('test-character');
            
            expect(character.speakerName).toBe('テストキャラクター');
            expect(character.speakerId).toBe('test-voice-123');
            expect(character.greeting).toBe('こんにちは！');
            expect(character.available_styles).toHaveProperty('normal');
            expect(character.available_styles).toHaveProperty('happy');
            expect(character.available_styles).toHaveProperty('sad');
        });

        test('初期化されていない場合はエラー', async () => {
            const uninitializedService = new CharacterInfoService();
            
            await expect(uninitializedService.getCharacterInfo('test')).rejects.toThrow('CharacterInfoService is not initialized');
        });
    });

    describe('selectStyle', () => {
        let testCharacter: Speaker;

        beforeEach(async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            testCharacter = await characterInfoService.getCharacterInfo('test-character');
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
            expect(() => characterInfoService.selectStyle(testCharacter, 'invalid-style')).toThrow('指定されたスタイル');
        });

        test('disabledなスタイルは選択されない', () => {
            // サッドスタイルは無効化されているので選択肢に含まれない
            expect(() => characterInfoService.selectStyle(testCharacter, 'サッド')).toThrow('指定されたスタイル');
        });

        test('ランダム選択モードで動作する', async () => {
            const randomCharacterConfig = {
                ...mockCharacterConfig,
                style_selection: 'random'
            };
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(randomCharacterConfig);
            const randomCharacter = await characterInfoService.getCharacterInfo('random-character');
            
            const selectedStyle = characterInfoService.selectStyle(randomCharacter);
            
            // ランダムなので、利用可能なスタイル（styleId: 0 または 1）のいずれかが選択される
            expect([0, 1]).toContain(selectedStyle.styleId);
        });

        test('利用可能なスタイルがない場合はエラー', async () => {
            const noStyleCharacterConfig = {
                ...mockCharacterConfig,
                available_styles: {
                    disabled_style: {
                        styleId: 0,
                        styleName: '無効スタイル',
                        personality: 'テスト',
                        speaking_style: 'テスト',
                        disabled: true
                    }
                }
            };
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(noStyleCharacterConfig);
            const noStyleCharacter = await characterInfoService.getCharacterInfo('no-style-character');
            
            expect(() => characterInfoService.selectStyle(noStyleCharacter)).toThrow('スピーカー \'テストキャラクター\' に利用可能なスタイルがありません');
        });
    });

    describe('updateVoiceSetting', () => {
        test('音声設定を正しく更新する', async () => {
            await characterInfoService.updateVoiceSetting('voice-123', 42);
            
            const config = await fileManager.readJsonFile(coeiroinkConfigFile, {}) as Record<string, unknown>;
            const voiceConfig = config.voice as Record<string, unknown>;
            expect(voiceConfig?.default_speaker_id).toBe('voice-123');
            expect(voiceConfig?.default_style_id).toBe(42);
            
            // 古い設定値が削除されていることを確認
            expect(config.voice_id).toBeUndefined();
            expect(config.style_id).toBeUndefined();
        });

        test('初期化されていない場合はエラー', async () => {
            const uninitializedService = new CharacterInfoService();
            
            await expect(uninitializedService.updateVoiceSetting('voice', 1)).rejects.toThrow('CharacterInfoService is not initialized');
        });
    });

    describe('generateVoiceConfigData', () => {
        test('音声設定データを正しく生成する', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            const character = await characterInfoService.getCharacterInfo('test-character');
            const selectedStyle = characterInfoService.selectStyle(character, 'ハッピー');
            
            const configData = characterInfoService.generateVoiceConfigData(character, selectedStyle);
            
            expect(configData.speakerId).toBe('test-voice-123');
            expect(configData.styleId).toBe(1);
            expect(configData.speakerInfo.speakerName).toBe('テストキャラクター');
            expect(configData.speakerInfo.styleName).toBe('ハッピー');
            expect(configData.speakerInfo.personality).toBe('とても明るい');
            expect(configData.speakerInfo.speakingStyle).toBe('楽しげ');
        });
    });

    describe('getOperatorCharacterInfo', () => {
        test('オペレータのキャラクター情報を取得する', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            
            const character = await characterInfoService.getOperatorCharacterInfo('operator1');
            
            expect(character.speakerName).toBe('テストキャラクター');
            expect(character.speakerId).toBe('test-voice-123');
        });

        test('存在しないオペレータの場合はエラー', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockRejectedValue(new Error('Character not found'));
            
            await expect(characterInfoService.getOperatorCharacterInfo('invalid-operator')).rejects.toThrow('オペレータ \'invalid-operator\' は存在しないか無効です');
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