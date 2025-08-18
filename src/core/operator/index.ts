#!/usr/bin/env node

/**
 * src/operator/index.ts: オペレータ管理システム（TypeScript実装）
 * キャラクター:スタイル単位での管理とMCP情報提供に対応
 */

import { mkdir, stat, unlink, access } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import ConfigManager, { CharacterConfig, CharacterStyle } from './config-manager.js';
import FileOperationManager from './file-operation-manager.js';
import { hostname } from 'os';
import CharacterInfoService, { Character, Style } from './character-info-service.js';

// CharacterInfoServiceからインポートされた型を使用

interface AssignResult {
    operatorId: string;
    characterName: string;
    currentStyle: {
        styleId: string;
        styleName: string;
        personality: string;
        speakingStyle: string;
    };
    voiceConfig: {
        voiceId: string;
        styleId: number;
    };
    greeting?: string;
    message?: string;
}

interface ReleaseResult {
    operatorId: string;
    characterName: string;
    farewell: string;
}

interface StatusResult {
    operatorId?: string;
    characterName?: string;
    currentStyle?: {
        styleId: string;
        styleName: string;
        personality: string;
        speakingStyle: string;
    };
    message: string;
}

/**
 * 設定ディレクトリを決定（ホームディレクトリベース）
 */
async function getConfigDir(): Promise<string> {
    // ホームディレクトリの ~/.coeiro-operator/ を優先
    const homeDir = join(process.env.HOME || process.env.USERPROFILE || '~', '.coeiro-operator');
    
    try {
        await mkdir(homeDir, { recursive: true });
        return homeDir;
    } catch {
        // フォールバック: 作業ディレクトリの .coeiroink/
        const workDir = join(process.cwd(), '.coeiroink');
        try {
            await mkdir(workDir, { recursive: true });
            return workDir;
        } catch {
            // 最終フォールバック: /tmp/coeiroink-mcp-shared/
            const tmpDir = '/tmp/coeiroink-mcp-shared';
            try {
                await mkdir(tmpDir, { recursive: true });
            } catch {}
            return tmpDir;
        }
    }
}

/**
 * セッションIDを取得
 */
function getSessionId(): string {
    if (process.env.ITERM_SESSION_ID) {
        return process.env.ITERM_SESSION_ID.replace(/[:-]/g, '_');
    } else if (process.env.TERM_SESSION_ID) {
        return process.env.TERM_SESSION_ID.replace(/[:-]/g, '_');
    } else {
        return process.ppid.toString();
    }
}

export class OperatorManager {
    private sessionId: string;
    private configDir: string | null = null;
    private coeiroinkConfigFile: string | null = null;
    private configManager: ConfigManager | null = null;
    private dataStore: FileOperationManager<string>;
    private characterInfoService: CharacterInfoService;

    constructor() {
        this.sessionId = getSessionId();
        
        // ファイルパス生成（tmpディレクトリ）
        const hostnameClean = hostname().replace(/[^a-zA-Z0-9]/g, '_');
        const filePath = `/tmp/coeiroink-operators-${hostnameClean}.json`;
        
        // デフォルト4時間のタイムアウトでFileOperationManagerを初期化
        this.dataStore = new FileOperationManager<string>(filePath, this.sessionId);
        this.characterInfoService = new CharacterInfoService();
    }

    async initialize(): Promise<void> {
        this.configDir = await getConfigDir();
        this.coeiroinkConfigFile = join(this.configDir, 'coeiroink-config.json');
        
        // 設定管理システムを初期化
        this.configManager = new ConfigManager(this.configDir);
        
        // ConfigManagerの動的設定を事前にビルドして初期化を完了
        try {
            await this.configManager.buildDynamicConfig();
        } catch (error) {
            console.warn(`OperatorManager dynamic config build failed:`, (error as Error).message);
        }
        
        // dataStoreを初期化（設定からタイムアウト取得）
        try {
            const timeoutMs = await this.configManager.getOperatorTimeout();
            const hostnameClean = hostname().replace(/[^a-zA-Z0-9]/g, '_');
            const filePath = `/tmp/coeiroink-operators-${hostnameClean}.json`;
            
            this.dataStore = new FileOperationManager<string>(filePath, this.sessionId, timeoutMs);
        } catch (error) {
            console.warn('OperatorManager initialization warning:', (error as Error).message);
            // 初期化に失敗してもデフォルト設定で続行
        }
        
        // CharacterInfoServiceを初期化
        this.characterInfoService.initialize(
            this.configManager,
            this.coeiroinkConfigFile
        );
    }

    /**
     * 設定の事前構築（外部からの呼び出し用）
     */
    async buildDynamicConfig(): Promise<void> {
        if (!this.configManager) {
            throw new Error('ConfigManager is not initialized');
        }
        
        try {
            await this.configManager.buildDynamicConfig();
        } catch (error) {
            console.error(`OperatorManager buildDynamicConfig failed:`, (error as Error).message);
            throw error;
        }
    }



    /**
     * キャラクター情報を取得
     */
    async getCharacterInfo(characterId: string): Promise<Character> {
        return await this.characterInfoService.getCharacterInfo(characterId);
    }

    /**
     * スタイルを選択
     */
    selectStyle(character: Character, specifiedStyle: string | null = null): Style {
        return this.characterInfoService.selectStyle(character, specifiedStyle);
    }

    /**
     * 挨拶パターンを自動抽出
     */
    async extractGreetingPatterns(): Promise<string[]> {
        return await this.characterInfoService.extractGreetingPatterns();
    }

    /**
     * 利用可能なオペレータを取得
     */
    async getAvailableOperators(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('State manager is not initialized');
        }

        const allOperators = await this.configManager.getAvailableCharacterIds();
        const otherAssignments = await this.dataStore.getOtherEntries();
        const usedOperators = Object.values(otherAssignments);
        
        return allOperators.filter(op => !usedOperators.includes(op));
    }

    /**
     * オペレータを予約
     */
    async reserveOperator(operatorId: string): Promise<boolean> {
        try {
            await this.dataStore.store(operatorId);
            return true;
        } catch (error) {
            throw new Error(`オペレータ ${operatorId} の予約に失敗しました: ${(error as Error).message}`);
        }
    }

    /**
     * オペレータを返却
     */
    async releaseOperator(): Promise<ReleaseResult> {
        const operatorId = await this.getCurrentOperatorId();
        
        if (!operatorId) {
            throw new Error('このセッションにはオペレータが割り当てられていません');
        }
        
        const success = await this.dataStore.remove();
        
        // お別れの挨拶情報を取得
        let character: Character | null = null;
        try {
            character = await this.characterInfoService.getCharacterInfo(operatorId);
        } catch {
            character = null;
        }
        
        return {
            operatorId,
            characterName: character?.name || operatorId,
            farewell: character?.farewell || ''
        };
    }

    /**
     * 全ての利用状況をクリア
     */
    async clearAllOperators(): Promise<boolean> {
        await this.dataStore.clear();
        return true;
    }

    /**
     * 現在のセッションに割り当てられたオペレータIDを取得
     */
    async getCurrentOperatorId(): Promise<string | null> {
        return this.dataStore.restore();
    }

    /**
     * 現在のセッションのオペレータが有効かチェック
     */
    async validateCurrentOperatorSession(): Promise<boolean> {
        const currentOperatorId = await this.getCurrentOperatorId();
        return currentOperatorId !== null;
    }

    /**
     * 指定されたオペレータが利用中かチェック（全セッション対象）
     */
    async isOperatorBusy(operatorId: string): Promise<boolean> {
        const allOperators = await this.configManager?.getAvailableCharacterIds() || [];
        const availableOperators = await this.getAvailableOperators();
        
        return !availableOperators.includes(operatorId);
    }

    /**
     * 現在のオペレータをサイレントで解放
     */
    async silentReleaseCurrentOperator(): Promise<string | null> {
        try {
            const currentOperatorId = await this.getCurrentOperatorId();
            if (!currentOperatorId) {
                return null;
            }

            await this.dataStore.remove();
            return currentOperatorId;
        } catch {
            return null;
        }
    }

    /**
     * ランダムオペレータ選択と詳細情報付きアサイン
     */
    async assignRandomOperator(style: string | null = null): Promise<AssignResult> {
        const availableOperators = await this.getAvailableOperators();
        
        if (availableOperators.length === 0) {
            throw new Error('利用可能なオペレータがありません');
        }
        
        // ランダム選択
        const selectedOperator = availableOperators[Math.floor(Math.random() * availableOperators.length)];
        
        return await this.assignSpecificOperator(selectedOperator, style);
    }

    /**
     * 指定されたオペレータを詳細情報付きでアサイン
     */
    async assignSpecificOperator(specifiedOperator: string, style: string | null = null): Promise<AssignResult> {
        if (!specifiedOperator) {
            throw new Error('オペレータIDを指定してください');
        }
        
        if (!this.configManager) {
            throw new Error('Manager is not initialized');
        }

        // キャラクター情報を取得
        let character: Character;
        try {
            character = await this.characterInfoService.getOperatorCharacterInfo(specifiedOperator);
        } catch (error) {
            throw error; // CharacterInfoServiceで適切なエラーメッセージが設定される
        }
        
        // 既存のオペレータがいる場合は自動的にリリース（交代処理）
        const currentOperatorId = await this.getCurrentOperatorId();
        if (currentOperatorId) {
            // 同じオペレータが指定された場合は何もしない
            if (currentOperatorId === specifiedOperator) {
                const selectedStyle = this.characterInfoService.selectStyle(character, style);
                
                const { voiceConfig, styleInfo } = this.characterInfoService.generateVoiceConfigData(character, selectedStyle);
                
                return {
                    operatorId: specifiedOperator,
                    characterName: character.name,
                    currentStyle: styleInfo,
                    voiceConfig,
                    message: `現在のオペレータ: ${character.name} (${specifiedOperator})`
                };
            }
            
            // 現在のオペレータをサイレントリリース
            await this.silentReleaseCurrentOperator();
        }
        
        // 仕様書準拠: 統一された時間切れクリーンアップ付きで他セッション利用状況をチェック
        if (await this.isOperatorBusy(specifiedOperator)) {
            throw new Error(`オペレータ '${specifiedOperator}' は既に他のセッションで利用中です`);
        }
        
        // オペレータを予約
        await this.reserveOperator(specifiedOperator);
        
        // スタイルを選択
        const selectedStyle = this.characterInfoService.selectStyle(character, style);
        
        // 音声設定を更新
        await this.characterInfoService.updateVoiceSetting(character.voice_id, selectedStyle.style_id);
        
        const { voiceConfig, styleInfo } = this.characterInfoService.generateVoiceConfigData(character, selectedStyle);
        
        return {
            operatorId: specifiedOperator,
            characterName: character.name,
            currentStyle: styleInfo,
            voiceConfig,
            greeting: character.greeting || ''
        };
    }

    /**
     * 音声設定を更新
     */
    async updateVoiceSetting(voiceId: string | null, styleId: number = 0): Promise<void> {
        return await this.characterInfoService.updateVoiceSetting(voiceId, styleId);
    }

    /**
     * 現在のオペレータ情報表示
     * 仕様書準拠: getCurrentOperatorId()の自動時間切れ処理に依存し、統一された検証ロジックを実装
     */
    async showCurrentOperator(): Promise<StatusResult> {
        if (!this.configManager) {
            throw new Error('Manager is not initialized');
        }

        // 仕様書準拠: getCurrentOperatorId()が時間切れチェックと自動解放を実行
        const operatorId = await this.getCurrentOperatorId();
        if (!operatorId) {
            return {
                message: 'オペレータは割り当てられていません'
            };
        }
        
        let character: Character;
        try {
            character = await this.characterInfoService.getCharacterInfo(operatorId);
        } catch (error) {
            return {
                operatorId,
                message: `現在のオペレータ: ${operatorId} (キャラクター情報なし)`
            };
        }
        
        const selectedStyle = this.characterInfoService.selectStyle(character);
        
        const { styleInfo } = this.characterInfoService.generateVoiceConfigData(character, selectedStyle);
        
        return {
            operatorId,
            characterName: character.name,
            currentStyle: styleInfo,
            message: `現在のオペレータ: ${character.name} (${operatorId}) - ${selectedStyle.name}`
        };
    }

    /**
     * オペレータ予約のタイムアウトを延長
     * Issue #58: sayコマンド実行時の動的タイムアウト延長
     */
    async refreshOperatorReservation(): Promise<boolean> {
        const operatorId = await this.getCurrentOperatorId();
        if (!operatorId) {
            return false; // オペレータが割り当てられていない
        }
        
        return this.dataStore.refresh();
    }
}

export default OperatorManager;