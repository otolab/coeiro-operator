#!/usr/bin/env node

/**
 * src/operator/index.js: オペレータ管理システム（JavaScript実装）
 * 複数Claudeセッション間でのオペレータ重複を防ぐ
 */

import { readFile, writeFile, access, mkdir, unlink } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// デフォルト設定
const DEFAULT_OPERATOR_CONFIG = {
    operators: {},
    greeting_patterns: [],
    farewell_patterns: []
};

/**
 * 設定ディレクトリを決定（作業ディレクトリベース）
 */
async function getConfigDir() {
    // 作業ディレクトリの .coeiroink/ を優先
    const workDir = join(process.cwd(), '.coeiroink');
    
    try {
        await mkdir(workDir, { recursive: true });
        return workDir;
    } catch {
        // フォールバック: /tmp/coeiroink-mcp-shared/
        const tmpDir = '/tmp/coeiroink-mcp-shared';
        try {
            await mkdir(tmpDir, { recursive: true });
        } catch {}
        return tmpDir;
    }
}

/**
 * セッション固有ディレクトリを決定
 */
async function getSessionDir(sessionId) {
    const sessionDir = `/tmp/coeiroink-mcp-session-${sessionId}`;
    try {
        await mkdir(sessionDir, { recursive: true });
    } catch {}
    return sessionDir;
}

/**
 * セッションIDを取得
 */
function getSessionId() {
    if (process.env.ITERM_SESSION_ID) {
        return process.env.ITERM_SESSION_ID.replace(/[:-]/g, '_');
    } else if (process.env.TERM_SESSION_ID) {
        return process.env.TERM_SESSION_ID.replace(/[:-]/g, '_');
    } else {
        return process.ppid.toString();
    }
}

export class OperatorManager {
    constructor() {
        this.sessionId = getSessionId();
        this.configDir = null;
        this.sessionDir = null;
        this.operatorConfigFile = null;
        this.activeOperatorsFile = null;
        this.speechLockFile = null;
        this.sessionOperatorFile = null;
        this.coeiroinkConfigFile = null;
    }

    async initialize() {
        this.configDir = await getConfigDir();
        this.sessionDir = await getSessionDir(this.sessionId);
        
        this.operatorConfigFile = join(this.configDir, 'operator-config.json');
        this.activeOperatorsFile = join(this.configDir, 'active-operators.json');
        this.speechLockFile = join(this.configDir, 'speech-lock');
        this.sessionOperatorFile = join(this.sessionDir, `session-operator-${this.sessionId}.json`);
        this.coeiroinkConfigFile = join(this.configDir, 'coeiroink-config.json');
    }

    /**
     * JSONファイルを安全に読み込み
     */
    async readJsonFile(filePath, defaultValue = {}) {
        try {
            await access(filePath, constants.F_OK);
            const content = await readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch {
            return defaultValue;
        }
    }

    /**
     * JSONファイルを安全に書き込み
     */
    async writeJsonFile(filePath, data) {
        const tempFile = `${filePath}.tmp`;
        await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');
        
        // アトミックに置き換え（rename相当）
        try {
            await unlink(filePath);
        } catch {}
        
        const fs = await import('fs');
        await fs.promises.rename(tempFile, filePath);
    }

    /**
     * 利用中オペレータファイルの初期化
     */
    async initActiveOperators() {
        try {
            await access(this.activeOperatorsFile, constants.F_OK);
        } catch {
            const initialData = {
                active: {},
                last_updated: new Date().toISOString()
            };
            await this.writeJsonFile(this.activeOperatorsFile, initialData);
        }
    }

    /**
     * 利用可能なオペレータを取得
     */
    async getAvailableOperators() {
        await this.initActiveOperators();
        
        const operatorConfig = await this.readJsonFile(this.operatorConfigFile, DEFAULT_OPERATOR_CONFIG);
        const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
        
        const allOperators = Object.keys(operatorConfig.operators || {});
        const availableOperators = allOperators.filter(op => !activeOperators.active[op]);
        
        return availableOperators;
    }

    /**
     * オペレータを予約
     */
    async reserveOperator(operatorId) {
        await this.initActiveOperators();
        
        const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
        
        // オペレータが利用可能かチェック
        if (activeOperators.active[operatorId]) {
            throw new Error(`オペレータ ${operatorId} は既に利用中です`);
        }
        
        // オペレータを予約
        activeOperators.active[operatorId] = this.sessionId;
        activeOperators.last_updated = new Date().toISOString();
        await this.writeJsonFile(this.activeOperatorsFile, activeOperators);
        
        // セッション情報を保存
        const sessionData = {
            operator_id: operatorId,
            session_id: this.sessionId,
            reserved_at: new Date().toISOString()
        };
        await this.writeJsonFile(this.sessionOperatorFile, sessionData);
        
        return true;
    }

    /**
     * オペレータを返却
     */
    async releaseOperator() {
        try {
            await access(this.sessionOperatorFile, constants.F_OK);
        } catch {
            throw new Error('このセッションにはオペレータが割り当てられていません');
        }
        
        const sessionData = await this.readJsonFile(this.sessionOperatorFile);
        const operatorId = sessionData.operator_id;
        
        // オペレータを返却
        const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
        delete activeOperators.active[operatorId];
        activeOperators.last_updated = new Date().toISOString();
        await this.writeJsonFile(this.activeOperatorsFile, activeOperators);
        
        // セッションファイルを削除
        await unlink(this.sessionOperatorFile);
        
        // お別れの挨拶情報を取得
        const operatorConfig = await this.readJsonFile(this.operatorConfigFile, DEFAULT_OPERATOR_CONFIG);
        const operatorInfo = operatorConfig.operators[operatorId];
        const operatorName = operatorInfo?.name || operatorId;
        
        return {
            operatorId,
            operatorName,
            farewell: operatorInfo?.farewell || ''
        };
    }

    /**
     * 全ての利用状況をクリア
     */
    async clearAllOperators() {
        // 利用中オペレータファイルを削除
        try {
            await unlink(this.activeOperatorsFile);
        } catch {}
        
        // 全セッションファイルを削除（簡単な実装）
        try {
            const fs = await import('fs');
            const { exec } = await import('child_process');
            exec('rm -f /tmp/coeiroink-mcp-session-*/session-operator-*.json');
        } catch {}
        
        return true;
    }

    /**
     * ランダムオペレータ選択と挨拶
     */
    async assignRandomOperator() {
        const availableOperators = await this.getAvailableOperators();
        
        if (availableOperators.length === 0) {
            throw new Error('利用可能なオペレータがありません');
        }
        
        // ランダム選択
        const selectedOperator = availableOperators[Math.floor(Math.random() * availableOperators.length)];
        
        // オペレータを予約
        await this.reserveOperator(selectedOperator);
        
        // 挨拶情報取得
        const operatorConfig = await this.readJsonFile(this.operatorConfigFile, DEFAULT_OPERATOR_CONFIG);
        const operatorInfo = operatorConfig.operators[selectedOperator];
        
        // 音声設定を更新
        await this.updateVoiceSetting(operatorInfo.voice_id);
        
        return {
            operatorId: selectedOperator,
            operatorName: operatorInfo?.name || selectedOperator,
            greeting: operatorInfo?.greeting || '',
            voiceId: operatorInfo?.voice_id || ''
        };
    }

    /**
     * 指定されたオペレータを割り当て
     */
    async assignSpecificOperator(specifiedOperator) {
        if (!specifiedOperator) {
            throw new Error('オペレータIDを指定してください');
        }
        
        const operatorConfig = await this.readJsonFile(this.operatorConfigFile, DEFAULT_OPERATOR_CONFIG);
        
        // オペレータが存在するかチェック
        if (!operatorConfig.operators[specifiedOperator]) {
            throw new Error(`オペレータ '${specifiedOperator}' は存在しません`);
        }
        
        // 既存のオペレータがいる場合は自動的にリリース（交代処理）
        try {
            await access(this.sessionOperatorFile, constants.F_OK);
            const currentData = await this.readJsonFile(this.sessionOperatorFile);
            const currentOperator = currentData.operator_id;
            
            // 同じオペレータが指定された場合は何もしない
            if (currentOperator === specifiedOperator) {
                const operatorName = operatorConfig.operators[specifiedOperator]?.name || specifiedOperator;
                return {
                    operatorId: specifiedOperator,
                    operatorName,
                    message: `現在のオペレータ: ${operatorName} (${specifiedOperator})`
                };
            }
            
            // 現在のオペレータをサイレントリリース
            const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
            delete activeOperators.active[currentOperator];
            activeOperators.last_updated = new Date().toISOString();
            await this.writeJsonFile(this.activeOperatorsFile, activeOperators);
            await unlink(this.sessionOperatorFile);
        } catch {
            // セッションファイルが存在しない場合は何もしない
        }
        
        // 指定されたオペレータが他のセッションで利用中かチェック
        await this.initActiveOperators();
        const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
        if (activeOperators.active[specifiedOperator]) {
            throw new Error(`オペレータ '${specifiedOperator}' は既に他のセッションで利用中です`);
        }
        
        // オペレータを予約
        await this.reserveOperator(specifiedOperator);
        
        // 挨拶情報取得
        const operatorInfo = operatorConfig.operators[specifiedOperator];
        
        // 音声設定を更新
        await this.updateVoiceSetting(operatorInfo.voice_id);
        
        return {
            operatorId: specifiedOperator,
            operatorName: operatorInfo?.name || specifiedOperator,
            greeting: operatorInfo?.greeting || '',
            voiceId: operatorInfo?.voice_id || ''
        };
    }

    /**
     * 音声設定を更新
     */
    async updateVoiceSetting(voiceId) {
        try {
            const config = await this.readJsonFile(this.coeiroinkConfigFile, {});
            config.voice_id = voiceId;
            await this.writeJsonFile(this.coeiroinkConfigFile, config);
        } catch (error) {
            console.error(`音声設定更新エラー: ${error.message}`);
        }
    }

    /**
     * 現在のオペレータ情報表示
     */
    async showCurrentOperator() {
        try {
            await access(this.sessionOperatorFile, constants.F_OK);
        } catch {
            return {
                message: 'オペレータは割り当てられていません'
            };
        }
        
        const sessionData = await this.readJsonFile(this.sessionOperatorFile);
        const operatorId = sessionData.operator_id;
        
        const operatorConfig = await this.readJsonFile(this.operatorConfigFile, DEFAULT_OPERATOR_CONFIG);
        const operatorName = operatorConfig.operators[operatorId]?.name || operatorId;
        
        return {
            operatorId,
            operatorName,
            message: `現在のオペレータ: ${operatorName} (${operatorId})`
        };
    }
}

export default OperatorManager;