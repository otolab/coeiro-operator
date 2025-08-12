/**
 * src/operator/voice-selection-service.test.ts: VoiceSelectionServiceテスト
 */

import { VoiceSelectionService, Character, Style } from './voice-selection-service.js';
import FileOperationManager from './file-operation-manager.js';
import ConfigManager, { CharacterConfig } from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('VoiceSelectionService', () => {
    let voiceSelectionService: VoiceSelectionService;
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
                name: 'ノーマル',
                style_id: 0,
                personality: '明るくて元気',
                speaking_style: 'フレンドリー'
            },
            happy: {
                name: 'ハッピー',
                style_id: 1,
                personality: 'とても明るい',
                speaking_style: '楽しげ'
            },
            sad: {
                name: 'サッド',
                style_id: 2,
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
        
        voiceSelectionService = new VoiceSelectionService(fileManager);
        voiceSelectionService.initialize(configManager, coeiroinkConfigFile);
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
            
            const character = await voiceSelectionService.getCharacterInfo('test-character');
            
            expect(character.name).toBe('テストキャラクター');
            expect(character.voice_id).toBe('test-voice-123');
            expect(character.greeting).toBe('こんにちは！');
            expect(character.available_styles).toHaveProperty('normal');
            expect(character.available_styles).toHaveProperty('happy');
            expect(character.available_styles).toHaveProperty('sad');
        });

        test('初期化されていない場合はエラー', async () => {
            const uninitializedService = new VoiceSelectionService(fileManager);
            
            await expect(uninitializedService.getCharacterInfo('test')).rejects.toThrow('VoiceSelectionService is not initialized');
        });
    });

    describe('selectStyle', () => {
        let testCharacter: Character;

        beforeEach(async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            testCharacter = await voiceSelectionService.getCharacterInfo('test-character');
        });

        test('デフォルトスタイルを正しく選択する', () => {
            const selectedStyle = voiceSelectionService.selectStyle(testCharacter);
            
            expect(selectedStyle.styleId).toBe('normal');
            expect(selectedStyle.name).toBe('ノーマル');
            expect(selectedStyle.style_id).toBe(0);
        });

        test('指定されたスタイルを正しく選択する', () => {
            const selectedStyle = voiceSelectionService.selectStyle(testCharacter, 'happy');
            
            expect(selectedStyle.styleId).toBe('happy');
            expect(selectedStyle.name).toBe('ハッピー');
            expect(selectedStyle.style_id).toBe(1);
        });

        test('スタイル名で指定できる', () => {
            const selectedStyle = voiceSelectionService.selectStyle(testCharacter, 'ハッピー');
            
            expect(selectedStyle.styleId).toBe('happy');
            expect(selectedStyle.name).toBe('ハッピー');
        });

        test('無効なスタイルを指定した場合はデフォルトを使用', () => {
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();
            
            const selectedStyle = voiceSelectionService.selectStyle(testCharacter, 'invalid-style');
            
            expect(selectedStyle.styleId).toBe('normal'); // デフォルト
            expect(consoleSpy).toHaveBeenCalledWith('指定されたスタイル \'invalid-style\' が見つかりません。デフォルト選択を使用します。');
            
            consoleSpy.mockRestore();
        });

        test('disabledなスタイルは選択されない', () => {
            // sadスタイルは無効化されているので選択肢に含まれない
            const selectedStyle = voiceSelectionService.selectStyle(testCharacter, 'sad');
            
            expect(selectedStyle.styleId).toBe('normal'); // デフォルトが選択される
        });

        test('ランダム選択モードで動作する', async () => {
            const randomCharacterConfig = {
                ...mockCharacterConfig,
                style_selection: 'random'
            };
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(randomCharacterConfig);
            const randomCharacter = await voiceSelectionService.getCharacterInfo('random-character');
            
            const selectedStyle = voiceSelectionService.selectStyle(randomCharacter);
            
            // ランダムなので、利用可能なスタイル（normal, happy）のいずれかが選択される
            expect(['normal', 'happy']).toContain(selectedStyle.styleId);
        });

        test('利用可能なスタイルがない場合はエラー', async () => {
            const noStyleCharacterConfig = {
                ...mockCharacterConfig,
                available_styles: {
                    disabled_style: {
                        name: '無効スタイル',
                        style_id: 0,
                        personality: 'テスト',
                        speaking_style: 'テスト',
                        disabled: true
                    }
                }
            };
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(noStyleCharacterConfig);
            const noStyleCharacter = await voiceSelectionService.getCharacterInfo('no-style-character');
            
            expect(() => voiceSelectionService.selectStyle(noStyleCharacter)).toThrow('キャラクター \'テストキャラクター\' に利用可能なスタイルがありません');
        });
    });

    describe('updateVoiceSetting', () => {
        test('音声設定を正しく更新する', async () => {
            await voiceSelectionService.updateVoiceSetting('voice-123', 42);
            
            const config = await fileManager.readJsonFile(coeiroinkConfigFile, {}) as Record<string, unknown>;
            const voiceConfig = config.voice as Record<string, unknown>;
            expect(voiceConfig?.default_voice_id).toBe('voice-123');
            expect(voiceConfig?.default_style_id).toBe(42);
            
            // 古い設定値が削除されていることを確認
            expect(config.voice_id).toBeUndefined();
            expect(config.style_id).toBeUndefined();
        });

        test('初期化されていない場合はエラー', async () => {
            const uninitializedService = new VoiceSelectionService(fileManager);
            
            await expect(uninitializedService.updateVoiceSetting('voice', 1)).rejects.toThrow('coeiroinkConfigFile is not initialized');
        });
    });

    describe('generateVoiceConfigData', () => {
        test('音声設定データを正しく生成する', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            const character = await voiceSelectionService.getCharacterInfo('test-character');
            const selectedStyle = voiceSelectionService.selectStyle(character, 'happy');
            
            const configData = voiceSelectionService.generateVoiceConfigData(character, selectedStyle);
            
            expect(configData.voiceConfig.voiceId).toBe('test-voice-123');
            expect(configData.voiceConfig.styleId).toBe(1);
            expect(configData.styleInfo.styleId).toBe('happy');
            expect(configData.styleInfo.styleName).toBe('ハッピー');
            expect(configData.styleInfo.personality).toBe('とても明るい');
            expect(configData.styleInfo.speakingStyle).toBe('楽しげ');
        });
    });

    describe('getOperatorCharacterInfo', () => {
        test('オペレータのキャラクター情報を取得する', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockResolvedValue(mockCharacterConfig);
            
            const character = await voiceSelectionService.getOperatorCharacterInfo('operator1');
            
            expect(character.name).toBe('テストキャラクター');
            expect(character.voice_id).toBe('test-voice-123');
        });

        test('存在しないオペレータの場合はエラー', async () => {
            vi.spyOn(configManager, 'getCharacterConfig').mockRejectedValue(new Error('Character not found'));
            
            await expect(voiceSelectionService.getOperatorCharacterInfo('invalid-operator')).rejects.toThrow('オペレータ \'invalid-operator\' は存在しないか無効です');
        });
    });

    describe('extractGreetingPatterns', () => {
        test('挨拶パターンを抽出する', async () => {
            const mockPatterns = ['こんにちは！', 'おはよう！', 'こんばんは！'];
            vi.spyOn(configManager, 'getGreetingPatterns').mockResolvedValue(mockPatterns);
            
            const patterns = await voiceSelectionService.extractGreetingPatterns();
            
            expect(patterns).toEqual(mockPatterns);
        });
    });

    describe('getAvailableCharacterIds', () => {
        test('利用可能なキャラクターIDリストを取得する', async () => {
            const mockIds = ['character1', 'character2', 'character3'];
            vi.spyOn(configManager, 'getAvailableCharacterIds').mockResolvedValue(mockIds);
            
            const ids = await voiceSelectionService.getAvailableCharacterIds();
            
            expect(ids).toEqual(mockIds);
        });
    });
});