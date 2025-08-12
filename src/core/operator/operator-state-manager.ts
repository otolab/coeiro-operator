/**
 * src/operator/operator-state-manager.ts: オペレータ状態管理クラス
 * オペレータの予約、解放、状態クエリを担当
 * 
 * Issue #43 対応: 統一ファイル管理システムへの移行
 * - 旧システム（分離ファイル）と新システム（統一ファイル）の両方をサポート
 * - 段階的移行による安全な更新
 * - 新システムは排他制御付きで複数プロセス対応
 */

import FileOperationManager from './file-operation-manager.js';
import ConfigManager from './config-manager.js';

export class OperatorStateManager {
    private fileOperationManager: FileOperationManager;
    private configManager: ConfigManager | null = null;
    private sessionId: string;

    constructor(sessionId: string, fileOperationManager: FileOperationManager) {
        this.sessionId = sessionId;
        this.fileOperationManager = fileOperationManager;
    }

    /**
     * 初期化：統一ファイル管理システム用
     */
    async initialize(configManager: ConfigManager): Promise<void> {
        this.configManager = configManager;
        await this.fileOperationManager.initUnifiedOperatorState();
        await this.fileOperationManager.cleanupStaleOperators(this.sessionId);
    }

    /**
     * 利用可能なオペレータを取得（統一システム版）
     */
    async getAvailableOperators(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('State manager is not initialized');
        }

        const allOperators = await this.configManager.getAvailableCharacterIds();
        return await this.fileOperationManager.getAvailableOperatorsUnified(allOperators);
    }

    /**
     * オペレータを予約（統一システム版）
     */
    async reserveOperator(operatorId: string): Promise<boolean> {
        const success = await this.fileOperationManager.reserveOperatorUnified(operatorId, this.sessionId);
        
        if (!success) {
            throw new Error(`オペレータ ${operatorId} は既に利用中です`);
        }
        
        return true;
    }

    /**
     * オペレータを返却（統一システム版）
     */
    async releaseOperator(): Promise<{ operatorId: string; success: boolean }> {
        const operatorId = await this.getCurrentOperatorId();
        
        if (!operatorId) {
            throw new Error('このセッションにはオペレータが割り当てられていません');
        }
        
        const success = await this.fileOperationManager.releaseOperatorUnified(operatorId, this.sessionId);
        
        return { operatorId, success };
    }

    /**
     * 全ての利用状況をクリア（統一システム版）
     */
    async clearAllOperators(): Promise<boolean> {
        // 統一ファイルを削除してリセット
        const unifiedFilePath = this.fileOperationManager.getUnifiedOperatorFilePath();
        await this.fileOperationManager.deleteFile(unifiedFilePath);
        
        // 新しい空の統一ファイルを作成
        await this.fileOperationManager.initUnifiedOperatorState();
        
        return true;
    }

    /**
     * 現在のセッションに割り当てられたオペレータIDを取得（統一システム版）
     */
    async getCurrentOperatorId(): Promise<string | null> {
        return await this.fileOperationManager.getCurrentOperatorUnified(this.sessionId);
    }

    /**
     * 指定されたオペレータが他のセッションで利用中かチェック（統一システム版）
     */
    async isOperatorBusy(operatorId: string): Promise<boolean> {
        const allOperators = await this.configManager?.getAvailableCharacterIds() || [];
        const availableOperators = await this.fileOperationManager.getAvailableOperatorsUnified(allOperators);
        
        return !availableOperators.includes(operatorId);
    }

    /**
     * 現在のオペレータをサイレントで解放（統一システム版）
     */
    async silentReleaseCurrentOperator(): Promise<string | null> {
        try {
            const currentOperatorId = await this.getCurrentOperatorId();
            if (!currentOperatorId) {
                return null;
            }

            await this.fileOperationManager.releaseOperatorUnified(currentOperatorId, this.sessionId);
            return currentOperatorId;
        } catch {
            return null;
        }
    }
}

export default OperatorStateManager;