/**
 * src/operator/operator-state-manager.ts: オペレータ状態管理クラス
 * オペレータの予約、解放、状態クエリを担当
 */

import FileOperationManager, { ActiveOperators, SessionData } from './file-operation-manager.js';
import ConfigManager from './config-manager.js';

export class OperatorStateManager {
    private fileOperationManager: FileOperationManager;
    private configManager: ConfigManager | null = null;
    private sessionId: string;
    private activeOperatorsFile: string | null = null;
    private sessionOperatorFile: string | null = null;

    constructor(sessionId: string, fileOperationManager: FileOperationManager) {
        this.sessionId = sessionId;
        this.fileOperationManager = fileOperationManager;
    }

    /**
     * 初期化：必要なファイルパスとConfigManagerを設定
     */
    initialize(
        activeOperatorsFile: string, 
        sessionOperatorFile: string, 
        configManager: ConfigManager
    ): void {
        this.activeOperatorsFile = activeOperatorsFile;
        this.sessionOperatorFile = sessionOperatorFile;
        this.configManager = configManager;
    }

    /**
     * 利用可能なオペレータを取得
     */
    async getAvailableOperators(): Promise<string[]> {
        if (!this.configManager || !this.activeOperatorsFile) {
            throw new Error('State manager is not initialized');
        }

        await this.fileOperationManager.initActiveOperators(this.activeOperatorsFile);
        
        const allOperators = await this.configManager.getAvailableCharacterIds();
        const activeOperators = await this.fileOperationManager.readJsonFile<ActiveOperators>(
            this.activeOperatorsFile, 
            { active: {}, last_updated: '' }
        );
        
        const availableOperators = allOperators.filter(op => !activeOperators.active[op]);
        
        return availableOperators;
    }

    /**
     * オペレータを予約
     */
    async reserveOperator(operatorId: string): Promise<boolean> {
        if (!this.activeOperatorsFile || !this.sessionOperatorFile) {
            throw new Error('File paths are not initialized');
        }

        await this.fileOperationManager.initActiveOperators(this.activeOperatorsFile);
        
        const activeOperators = await this.fileOperationManager.readJsonFile<ActiveOperators>(
            this.activeOperatorsFile, 
            { active: {}, last_updated: '' }
        );
        
        // オペレータが利用可能かチェック
        if (activeOperators.active[operatorId]) {
            throw new Error(`オペレータ ${operatorId} は既に利用中です`);
        }
        
        // オペレータを予約
        activeOperators.active[operatorId] = this.sessionId;
        activeOperators.last_updated = new Date().toISOString();
        await this.fileOperationManager.writeJsonFile(this.activeOperatorsFile, activeOperators);
        
        // セッション情報を保存
        const sessionData: SessionData = {
            operator_id: operatorId,
            session_id: this.sessionId,
            reserved_at: new Date().toISOString()
        };
        await this.fileOperationManager.writeJsonFile(this.sessionOperatorFile, sessionData);
        
        return true;
    }

    /**
     * オペレータを返却
     */
    async releaseOperator(): Promise<{ operatorId: string; success: boolean }> {
        if (!this.sessionOperatorFile || !this.activeOperatorsFile) {
            throw new Error('File paths are not initialized');
        }

        const sessionExists = await this.fileOperationManager.fileExists(this.sessionOperatorFile);
        if (!sessionExists) {
            throw new Error('このセッションにはオペレータが割り当てられていません');
        }
        
        const sessionData = await this.fileOperationManager.readJsonFile<SessionData>(this.sessionOperatorFile);
        const operatorId = sessionData.operator_id;
        
        // オペレータを返却
        const activeOperators = await this.fileOperationManager.readJsonFile<ActiveOperators>(
            this.activeOperatorsFile, 
            { active: {}, last_updated: '' }
        );
        delete activeOperators.active[operatorId];
        activeOperators.last_updated = new Date().toISOString();
        await this.fileOperationManager.writeJsonFile(this.activeOperatorsFile, activeOperators);
        
        // セッションファイルを削除
        await this.fileOperationManager.deleteFile(this.sessionOperatorFile);
        
        return { operatorId, success: true };
    }

    /**
     * 全ての利用状況をクリア
     */
    async clearAllOperators(): Promise<boolean> {
        if (!this.activeOperatorsFile) {
            throw new Error('activeOperatorsFile is not initialized');
        }

        // 利用中オペレータファイルを削除
        await this.fileOperationManager.deleteFile(this.activeOperatorsFile);
        
        // 全セッションファイルを削除（簡単な実装）
        try {
            const fs = await import('fs');
            const { exec } = await import('child_process');
            exec('rm -f /tmp/coeiroink-mcp-session-*/session-operator-*.json');
        } catch {}
        
        return true;
    }

    /**
     * 現在のセッションに割り当てられたオペレータIDを取得
     */
    async getCurrentOperatorId(): Promise<string | null> {
        if (!this.sessionOperatorFile) {
            throw new Error('sessionOperatorFile is not initialized');
        }

        const sessionExists = await this.fileOperationManager.fileExists(this.sessionOperatorFile);
        if (!sessionExists) {
            return null;
        }
        
        const sessionData = await this.fileOperationManager.readJsonFile<SessionData>(this.sessionOperatorFile);
        return sessionData.operator_id;
    }

    /**
     * 指定されたオペレータが他のセッションで利用中かチェック
     */
    async isOperatorBusy(operatorId: string): Promise<boolean> {
        if (!this.activeOperatorsFile) {
            throw new Error('activeOperatorsFile is not initialized');
        }

        await this.fileOperationManager.initActiveOperators(this.activeOperatorsFile);
        const activeOperators = await this.fileOperationManager.readJsonFile<ActiveOperators>(
            this.activeOperatorsFile, 
            { active: {}, last_updated: '' }
        );
        
        return !!activeOperators.active[operatorId];
    }

    /**
     * 現在のオペレータをサイレントで解放（エラーハンドリング付き）
     */
    async silentReleaseCurrentOperator(): Promise<string | null> {
        try {
            const currentOperatorId = await this.getCurrentOperatorId();
            if (!currentOperatorId) {
                return null;
            }

            if (!this.activeOperatorsFile || !this.sessionOperatorFile) {
                return null;
            }

            // 現在のオペレータをサイレントリリース
            const activeOperators = await this.fileOperationManager.readJsonFile<ActiveOperators>(
                this.activeOperatorsFile, 
                { active: {}, last_updated: '' }
            );
            delete activeOperators.active[currentOperatorId];
            activeOperators.last_updated = new Date().toISOString();
            await this.fileOperationManager.writeJsonFile(this.activeOperatorsFile, activeOperators);
            await this.fileOperationManager.deleteFile(this.sessionOperatorFile);
            
            return currentOperatorId;
        } catch {
            return null;
        }
    }
}

export default OperatorStateManager;