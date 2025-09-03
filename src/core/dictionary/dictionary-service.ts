/**
 * 辞書管理サービス
 * 
 * 辞書の登録・永続化を統一的に管理
 */

import { DictionaryClient, DictionaryWord } from './dictionary-client.js';
import { DictionaryPersistenceManager } from './dictionary-persistence.js';
import { DEFAULT_TECHNICAL_WORDS, CHARACTER_NAME_WORDS } from './default-dictionaries.js';
import { logger } from '../../utils/logger.js';

/**
 * 辞書管理サービス
 */
export class DictionaryService {
    private client: DictionaryClient;
    private persistenceManager: DictionaryPersistenceManager;
    
    constructor(connectionConfig?: any) {
        this.client = new DictionaryClient(connectionConfig);
        this.persistenceManager = new DictionaryPersistenceManager();
    }
    
    /**
     * 辞書を初期化（起動時の自動登録）
     */
    async initialize(): Promise<void> {
        try {
            const isConnected = await this.client.checkConnection();
            if (!isConnected) {
                logger.warn("COEIROINKサーバーに接続できないため、辞書の初期化をスキップしました");
                return;
            }
            
            // 保存された辞書を読み込み
            const savedDictionary = await this.persistenceManager.load();
            let customWords: DictionaryWord[] = [];
            
            if (savedDictionary) {
                customWords = savedDictionary.customWords || [];
                logger.info(`保存された辞書を読み込みました: カスタム単語${customWords.length}個`);
            } else {
                // 初回起動時は空の辞書で永続化ファイルを作成
                await this.persistenceManager.save([], true);
                logger.info("辞書設定ファイルを初期化しました");
            }
            
            // すべての辞書を登録
            await this.registerAllWords(customWords);
            
        } catch (error) {
            logger.warn(`辞書の初期化中にエラーが発生しました: ${(error as Error).message}`);
        }
    }
    
    /**
     * 単語を追加登録
     */
    async addWord(word: DictionaryWord): Promise<boolean> {
        try {
            // 既存のカスタム辞書を読み込み
            let existingWords: DictionaryWord[] = [];
            const savedDictionary = await this.persistenceManager.load();
            if (savedDictionary) {
                existingWords = savedDictionary.customWords || [];
            }
            
            // 重複チェック（同じ単語があれば上書き）
            const updatedWords = existingWords.filter(w => w.word !== word.word);
            updatedWords.push(word);
            
            // すべての辞書を登録
            const success = await this.registerAllWords(updatedWords);
            
            if (success) {
                // 永続化
                await this.persistenceManager.save(updatedWords, true);
                logger.info(`辞書に単語を追加: ${word.word} → ${word.yomi}`);
            }
            
            return success;
            
        } catch (error) {
            logger.error(`単語の追加に失敗しました: ${(error as Error).message}`);
            return false;
        }
    }
    
    /**
     * すべての辞書（デフォルト＋カスタム）を登録
     */
    private async registerAllWords(customWords: DictionaryWord[]): Promise<boolean> {
        const allWords = [
            ...DEFAULT_TECHNICAL_WORDS,
            ...CHARACTER_NAME_WORDS,
            ...customWords
        ];
        
        if (allWords.length === 0) {
            return true;
        }
        
        const result = await this.client.registerWords(allWords);
        
        if (result.success) {
            logger.info(`辞書を登録しました: 合計${result.registeredCount}個の単語`);
            return true;
        } else {
            logger.warn(`辞書登録に失敗: ${result.error}`);
            return false;
        }
    }
    
    /**
     * 接続確認
     */
    async checkConnection(): Promise<boolean> {
        return await this.client.checkConnection();
    }
}