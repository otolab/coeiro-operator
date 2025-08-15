/**
 * src/operator/operator-state-manager.ts: オペレータ状態管理クラス
 * オペレータの予約、解放、状態クエリを担当
 * 
 * Issue #43 対応: 統一ファイル管理システム
 * - 統一ファイルによる一元管理
 * - 排他制御付きで複数プロセス対応
 * - セッションIDベースの予約管理
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
     * 初期化
     */
    async initialize(configManager: ConfigManager): Promise<void> {
        this.configManager = configManager;
        
        try {
            await this.fileOperationManager.initUnifiedOperatorState();
            await this.fileOperationManager.cleanupStaleOperators(this.sessionId);
        } catch (error) {
            console.warn('OperatorStateManager initialization warning:', (error as Error).message);
            // 初期化に失敗しても続行（最小限の機能は利用可能）
        }
    }

    /**
     * 利用可能なオペレータを取得
     * セッションIDを渡さず、全予約を除外する（正しい動作）
     */
    async getAvailableOperators(): Promise<string[]> {
        if (!this.configManager) {
            throw new Error('State manager is not initialized');
        }

        const allOperators = await this.configManager.getAvailableCharacterIds();
        return await this.fileOperationManager.getAvailableOperatorsUnified(allOperators);
    }

    /**
     * オペレータを予約
     */
    async reserveOperator(operatorId: string): Promise<boolean> {
        const success = await this.fileOperationManager.reserveOperatorUnified(operatorId, this.sessionId);
        
        if (!success) {
            throw new Error(`オペレータ ${operatorId} は既に利用中です`);
        }
        
        return true;
    }

    /**
     * オペレータを返却
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
     * 全ての利用状況をクリア
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
     * 現在のセッションに割り当てられたオペレータIDを取得
     */
    async getCurrentOperatorId(): Promise<string | null> {
        return await this.fileOperationManager.getCurrentOperatorUnified(this.sessionId);
    }

    /**
     * 現在のセッションのオペレータが有効かチェック（時間切れ考慮）
     * 時間切れの場合は自動的に解放する
     */
    async validateCurrentOperatorSession(): Promise<boolean> {
        const currentOperatorId = await this.getCurrentOperatorId();
        if (!currentOperatorId) {
            return false; // オペレータが割り当てられていない
        }

        // 時間切れチェック
        const isStale = await this.fileOperationManager.isOperatorStale(currentOperatorId, this.sessionId);
        if (isStale) {
            // 時間切れの場合は自動解放
            try {
                await this.releaseOperator();
                console.log(`時間切れオペレータを自動解放: ${currentOperatorId}`);
            } catch (error) {
                console.warn(`時間切れオペレータの自動解放に失敗: ${(error as Error).message}`);
            }
            return false;
        }

        return true; // 有効なオペレータが存在
    }

    /**
     * 指定されたオペレータが利用中かチェック（全セッション対象）
     * Issue #56: セッションIDを渡さず、全予約を対象とする
     */
    async isOperatorBusy(operatorId: string): Promise<boolean> {
        const allOperators = await this.configManager?.getAvailableCharacterIds() || [];
        const availableOperators = await this.fileOperationManager.getAvailableOperatorsUnified(allOperators);
        
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

            await this.fileOperationManager.releaseOperatorUnified(currentOperatorId, this.sessionId);
            return currentOperatorId;
        } catch {
            return null;
        }
    }

    /**
     * オペレータ予約のタイムアウトを延長
     * Issue #58: sayコマンド実行時の動的タイムアウト延長
     */
    async refreshOperatorReservation(operatorId: string): Promise<boolean> {
        return await this.fileOperationManager.refreshOperatorReservation(operatorId, this.sessionId);
    }
}

export default OperatorStateManager;