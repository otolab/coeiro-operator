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
import OperatorStateManager from './operator-state-manager.js';
import VoiceSelectionService, { Character, Style } from './voice-selection-service.js';

// VoiceSelectionServiceからインポートされた型を使用

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
    private fileOperationManager: FileOperationManager;
    private operatorStateManager: OperatorStateManager;
    private voiceSelectionService: VoiceSelectionService;

    constructor() {
        this.sessionId = getSessionId();
        this.fileOperationManager = new FileOperationManager();
        this.operatorStateManager = new OperatorStateManager(this.sessionId, this.fileOperationManager);
        this.voiceSelectionService = new VoiceSelectionService(this.fileOperationManager);
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
        
        // OperatorStateManagerを初期化（統一ファイルシステム）
        await this.operatorStateManager.initialize(this.configManager);
        
        // VoiceSelectionServiceを初期化
        this.voiceSelectionService.initialize(
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
     * JSONファイルを安全に読み込み
     */
    async readJsonFile<T>(filePath: string, defaultValue: T = {} as T): Promise<T> {
        return await this.fileOperationManager.readJsonFile(filePath, defaultValue);
    }

    /**
     * JSONファイルを安全に書き込み
     */
    async writeJsonFile(filePath: string, data: unknown): Promise<void> {
        return await this.fileOperationManager.writeJsonFile(filePath, data);
    }


    /**
     * キャラクター情報を取得
     */
    async getCharacterInfo(characterId: string): Promise<Character> {
        return await this.voiceSelectionService.getCharacterInfo(characterId);
    }

    /**
     * スタイルを選択
     */
    selectStyle(character: Character, specifiedStyle: string | null = null): Style {
        return this.voiceSelectionService.selectStyle(character, specifiedStyle);
    }

    /**
     * 挨拶パターンを自動抽出
     */
    async extractGreetingPatterns(): Promise<string[]> {
        return await this.voiceSelectionService.extractGreetingPatterns();
    }

    /**
     * 利用可能なオペレータを取得
     */
    async getAvailableOperators(): Promise<string[]> {
        return await this.operatorStateManager.getAvailableOperators();
    }

    /**
     * オペレータを予約
     */
    async reserveOperator(operatorId: string): Promise<boolean> {
        return await this.operatorStateManager.reserveOperator(operatorId);
    }

    /**
     * オペレータを返却
     */
    async releaseOperator(): Promise<ReleaseResult> {
        // OperatorStateManagerで状態管理部分を処理
        const { operatorId } = await this.operatorStateManager.releaseOperator();
        
        // お別れの挨拶情報を取得
        let character: Character | null = null;
        try {
            character = await this.voiceSelectionService.getCharacterInfo(operatorId);
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
        return await this.operatorStateManager.clearAllOperators();
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
            character = await this.voiceSelectionService.getOperatorCharacterInfo(specifiedOperator);
        } catch (error) {
            throw error; // VoiceSelectionServiceで適切なエラーメッセージが設定される
        }
        
        // 既存のオペレータがいる場合は自動的にリリース（交代処理）
        const currentOperatorId = await this.operatorStateManager.getCurrentOperatorId();
        if (currentOperatorId) {
            // 同じオペレータが指定された場合は何もしない
            if (currentOperatorId === specifiedOperator) {
                const selectedStyle = this.selectStyle(character, style);
                
                const { voiceConfig, styleInfo } = this.voiceSelectionService.generateVoiceConfigData(character, selectedStyle);
                
                return {
                    operatorId: specifiedOperator,
                    characterName: character.name,
                    currentStyle: styleInfo,
                    voiceConfig,
                    message: `現在のオペレータ: ${character.name} (${specifiedOperator})`
                };
            }
            
            // 現在のオペレータをサイレントリリース
            await this.operatorStateManager.silentReleaseCurrentOperator();
        }
        
        // 指定されたオペレータが他のセッションで利用中かチェック
        if (await this.operatorStateManager.isOperatorBusy(specifiedOperator)) {
            throw new Error(`オペレータ '${specifiedOperator}' は既に他のセッションで利用中です`);
        }
        
        // オペレータを予約
        await this.operatorStateManager.reserveOperator(specifiedOperator);
        
        // スタイルを選択
        const selectedStyle = this.voiceSelectionService.selectStyle(character, style);
        
        // 音声設定を更新
        await this.voiceSelectionService.updateVoiceSetting(character.voice_id, selectedStyle.style_id);
        
        const { voiceConfig, styleInfo } = this.voiceSelectionService.generateVoiceConfigData(character, selectedStyle);
        
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
        return await this.voiceSelectionService.updateVoiceSetting(voiceId, styleId);
    }

    /**
     * 現在のオペレータ情報表示
     */
    async showCurrentOperator(): Promise<StatusResult> {
        if (!this.configManager) {
            throw new Error('Manager is not initialized');
        }

        // オペレータのタイムアウト検証を実行
        const isValid = await this.operatorStateManager.validateCurrentOperatorSession();
        if (!isValid) {
            return {
                message: 'オペレータは割り当てられていません'
            };
        }

        const operatorId = await this.operatorStateManager.getCurrentOperatorId();
        if (!operatorId) {
            return {
                message: 'オペレータは割り当てられていません'
            };
        }
        
        let character: Character;
        try {
            character = await this.voiceSelectionService.getCharacterInfo(operatorId);
        } catch (error) {
            return {
                operatorId,
                message: `現在のオペレータ: ${operatorId} (キャラクター情報なし)`
            };
        }
        
        const selectedStyle = this.voiceSelectionService.selectStyle(character);
        
        const { styleInfo } = this.voiceSelectionService.generateVoiceConfigData(character, selectedStyle);
        
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
        const operatorId = await this.operatorStateManager.getCurrentOperatorId();
        if (!operatorId) {
            return false; // オペレータが割り当てられていない
        }
        
        return await this.operatorStateManager.refreshOperatorReservation(operatorId);
    }
}

export default OperatorManager;