/**
 * DictionaryService テスト
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DictionaryService } from './dictionary-service.js';
import { DictionaryClient } from './dictionary-client.js';
import { DictionaryPersistenceManager } from './dictionary-persistence.js';
import { DEFAULT_TECHNICAL_WORDS, CHARACTER_NAME_WORDS } from './default-dictionaries.js';

// モックの設定
vi.mock('./dictionary-client.js');
vi.mock('./dictionary-persistence.js');
vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

interface MockDictionaryClient {
    checkConnection: ReturnType<typeof vi.fn>;
    registerWords: ReturnType<typeof vi.fn>;
}

interface MockPersistenceManager {
    load: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
}

describe('DictionaryService', () => {
    let service: DictionaryService;
    let mockClient: MockDictionaryClient;
    let mockPersistenceManager: MockPersistenceManager;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // DictionaryClientのモック設定
        mockClient = {
            checkConnection: vi.fn().mockResolvedValue(true),
            registerWords: vi.fn().mockResolvedValue({
                success: true,
                registeredCount: 10,
                error: null
            })
        };
        (DictionaryClient as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
            return mockClient as unknown as DictionaryClient;
        });

        // DictionaryPersistenceManagerのモック設定
        mockPersistenceManager = {
            load: vi.fn().mockResolvedValue(null),
            save: vi.fn().mockResolvedValue(undefined)
        };
        (DictionaryPersistenceManager as unknown as ReturnType<typeof vi.fn>).mockImplementation(function() {
            return mockPersistenceManager as unknown as DictionaryPersistenceManager;
        });

        service = new DictionaryService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('initialize', () => {
        it('接続できない場合はスキップする', async () => {
            mockClient.checkConnection.mockResolvedValue(false);

            await service.initialize();

            expect(mockClient.checkConnection).toHaveBeenCalled();
            expect(mockClient.registerWords).not.toHaveBeenCalled();
            expect(mockPersistenceManager.load).not.toHaveBeenCalled();
        });

        it('初回起動時はデフォルト辞書を登録して永続化ファイルを作成', async () => {
            mockPersistenceManager.load.mockResolvedValue(null);

            await service.initialize();

            expect(mockPersistenceManager.load).toHaveBeenCalled();
            expect(mockPersistenceManager.save).toHaveBeenCalledWith([], true);
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS
            ]);
        });

        it('保存された辞書がある場合は読み込んで登録', async () => {
            const customWords = [
                { word: 'TestWord', yomi: 'テストワード', accent: 2, numMoras: 5 }
            ];
            mockPersistenceManager.load.mockResolvedValue({
                customWords,
                includeDefaults: true
            });

            await service.initialize();

            expect(mockPersistenceManager.load).toHaveBeenCalled();
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS,
                ...customWords
            ]);
            expect(mockPersistenceManager.save).not.toHaveBeenCalled();
        });

        it('辞書登録が失敗してもエラーを投げない', async () => {
            mockClient.registerWords.mockResolvedValue({
                success: false,
                registeredCount: 0,
                error: 'Registration failed'
            });

            await expect(service.initialize()).resolves.not.toThrow();
        });

        it('エラーが発生してもエラーを投げない', async () => {
            mockClient.checkConnection.mockRejectedValue(new Error('Connection error'));

            await expect(service.initialize()).resolves.not.toThrow();
        });
    });

    describe('addWord', () => {
        it('単語を追加して永続化する', async () => {
            const newWord = {
                word: 'Redis',
                yomi: 'レディス',
                accent: 1,
                numMoras: 4
            };
            mockPersistenceManager.load.mockResolvedValue({
                customWords: [],
                includeDefaults: true
            });

            const result = await service.addWord(newWord);

            expect(result).toBe(true);
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS,
                newWord
            ]);
            expect(mockPersistenceManager.save).toHaveBeenCalledWith([newWord], true);
        });

        it('同じ単語がある場合は上書きする', async () => {
            const existingWord = {
                word: 'Redis',
                yomi: 'レディス',
                accent: 1,
                numMoras: 4
            };
            const updatedWord = {
                word: 'Redis',
                yomi: 'レディース',
                accent: 2,
                numMoras: 4
            };
            mockPersistenceManager.load.mockResolvedValue({
                customWords: [existingWord],
                includeDefaults: true
            });

            const result = await service.addWord(updatedWord);

            expect(result).toBe(true);
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS,
                updatedWord // 更新された単語のみ
            ]);
            expect(mockPersistenceManager.save).toHaveBeenCalledWith([updatedWord], true);
        });

        it('辞書登録が失敗した場合はfalseを返す', async () => {
            const newWord = {
                word: 'TestWord',
                yomi: 'テストワード',
                accent: 2,
                numMoras: 5
            };
            mockClient.registerWords.mockResolvedValue({
                success: false,
                registeredCount: 0,
                error: 'Registration failed'
            });

            const result = await service.addWord(newWord);

            expect(result).toBe(false);
            expect(mockPersistenceManager.save).not.toHaveBeenCalled();
        });

        it('既存辞書の読み込みに失敗しても処理を続行', async () => {
            const newWord = {
                word: 'TestWord',
                yomi: 'テストワード',
                accent: 2,
                numMoras: 5
            };
            mockPersistenceManager.load.mockResolvedValue(null);

            const result = await service.addWord(newWord);

            expect(result).toBe(true);
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS,
                newWord
            ]);
        });

        it('エラーが発生した場合はfalseを返す', async () => {
            const newWord = {
                word: 'TestWord',
                yomi: 'テストワード',
                accent: 2,
                numMoras: 5
            };
            mockClient.registerWords.mockRejectedValue(new Error('API error'));

            const result = await service.addWord(newWord);

            expect(result).toBe(false);
            expect(mockPersistenceManager.save).not.toHaveBeenCalled();
        });
    });

    describe('checkConnection', () => {
        it('接続状態を正しく返す', async () => {
            mockClient.checkConnection.mockResolvedValue(true);

            const result = await service.checkConnection();

            expect(result).toBe(true);
            expect(mockClient.checkConnection).toHaveBeenCalled();
        });

        it('接続できない場合はfalseを返す', async () => {
            mockClient.checkConnection.mockResolvedValue(false);

            const result = await service.checkConnection();

            expect(result).toBe(false);
        });
    });

    describe('constructor', () => {
        it('接続設定を渡せる', () => {
            const connectionConfig = {
                host: 'custom-host',
                port: '12345'
            };

            const _customService = new DictionaryService(connectionConfig);

            expect(DictionaryClient).toHaveBeenCalledWith(connectionConfig);
        });

        it('接続設定なしでも動作する', () => {
            const _defaultService = new DictionaryService();

            expect(DictionaryClient).toHaveBeenCalledWith(undefined);
        });
    });

    describe('統合シナリオ', () => {
        it('初期化→単語追加→再初期化のフロー', async () => {
            // 初期化（初回）
            mockPersistenceManager.load.mockResolvedValue(null);
            await service.initialize();
            
            expect(mockPersistenceManager.save).toHaveBeenCalledWith([], true);
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS
            ]);

            vi.clearAllMocks();

            // 単語追加
            const newWord = {
                word: 'Kubernetes',
                yomi: 'クバネティス',
                accent: 3,
                numMoras: 6
            };
            mockPersistenceManager.load.mockResolvedValue({
                customWords: [],
                includeDefaults: true
            });
            
            await service.addWord(newWord);
            
            expect(mockPersistenceManager.save).toHaveBeenCalledWith([newWord], true);

            vi.clearAllMocks();

            // 再初期化（保存された辞書あり）
            mockPersistenceManager.load.mockResolvedValue({
                customWords: [newWord],
                includeDefaults: true
            });
            
            await service.initialize();
            
            expect(mockClient.registerWords).toHaveBeenCalledWith([
                ...DEFAULT_TECHNICAL_WORDS,
                ...CHARACTER_NAME_WORDS,
                newWord
            ]);
            expect(mockPersistenceManager.save).not.toHaveBeenCalled();
        });
    });
});