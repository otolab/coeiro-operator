#!/usr/bin/env node

/**
 * src/operator/index.js: オペレータ管理システム（JavaScript実装）
 * キャラクター:スタイル単位での管理とMCP情報提供に対応
 */

import { readFile, writeFile, access, mkdir, unlink } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';
import ConfigManager from './config-manager.js';

/**
 * 設定ディレクトリを決定（ホームディレクトリベース）
 */
async function getConfigDir() {
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
        this.activeOperatorsFile = null;
        this.speechLockFile = null;
        this.sessionOperatorFile = null;
        this.coeiroinkConfigFile = null;
        this.configManager = null;
    }

    async initialize() {
        this.configDir = await getConfigDir();
        this.sessionDir = await getSessionDir(this.sessionId);
        
        this.activeOperatorsFile = join(this.configDir, 'active-operators.json');
        this.speechLockFile = join(this.configDir, 'speech-lock');
        this.sessionOperatorFile = join(this.sessionDir, `session-operator-${this.sessionId}.json`);
        this.coeiroinkConfigFile = join(this.configDir, 'coeiroink-config.json');
        
        // 設定管理システムを初期化
        this.configManager = new ConfigManager(this.configDir);
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
     * キャラクター情報を取得
     */
    async getCharacterInfo(characterId) {
        return await this.configManager.getCharacterConfig(characterId);
    }

    /**
     * スタイルを選択
     */
    selectStyle(character, specifiedStyle = null) {
        const availableStyles = Object.entries(character.available_styles || {})
            .filter(([_, style]) => !style.disabled) // disabledフラグをチェック
            .map(([styleId, style]) => ({ styleId, ...style }));
        
        if (availableStyles.length === 0) {
            throw new Error(`キャラクター '${character.name}' に利用可能なスタイルがありません`);
        }
        
        // 明示的にスタイルが指定された場合はそれを優先
        if (specifiedStyle) {
            const requestedStyle = availableStyles.find(s => 
                s.styleId === specifiedStyle || 
                s.name === specifiedStyle ||
                s.styleId.toString() === specifiedStyle
            );
            if (requestedStyle) {
                return requestedStyle;
            }
            // 指定されたスタイルが見つからない場合は警告ログを出力してデフォルト処理に続行
            console.warn(`指定されたスタイル '${specifiedStyle}' が見つかりません。デフォルト選択を使用します。`);
        }
        
        switch (character.style_selection) {
            case 'default':
                // デフォルトスタイルを使用
                const defaultStyle = availableStyles.find(s => s.styleId === character.default_style);
                return defaultStyle || availableStyles[0];
                
            case 'random':
                // ランダム選択
                return availableStyles[Math.floor(Math.random() * availableStyles.length)];
                
            case 'specified':
                // 指定されたスタイル（今回は default と同じ扱い）
                const specifiedStyleFromConfig = availableStyles.find(s => s.styleId === character.default_style);
                return specifiedStyleFromConfig || availableStyles[0];
                
            default:
                return availableStyles[0];
        }
    }

    /**
     * 挨拶パターンを自動抽出
     */
    async extractGreetingPatterns() {
        return await this.configManager.getGreetingPatterns();
    }

    /**
     * 利用可能なオペレータを取得
     */
    async getAvailableOperators() {
        await this.initActiveOperators();
        
        const allOperators = await this.configManager.getAvailableCharacterIds();
        const activeOperators = await this.readJsonFile(this.activeOperatorsFile, { active: {} });
        
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
        let character;
        try {
            character = await this.configManager.getCharacterConfig(operatorId);
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
     * ランダムオペレータ選択と詳細情報付きアサイン
     */
    async assignRandomOperator(style = null) {
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
    async assignSpecificOperator(specifiedOperator, style = null) {
        if (!specifiedOperator) {
            throw new Error('オペレータIDを指定してください');
        }
        
        // キャラクター情報を取得
        let character;
        try {
            character = await this.configManager.getCharacterConfig(specifiedOperator);
        } catch (error) {
            throw new Error(`オペレータ '${specifiedOperator}' は存在しないか無効です`);
        }
        
        // 既存のオペレータがいる場合は自動的にリリース（交代処理）
        try {
            await access(this.sessionOperatorFile, constants.F_OK);
            const currentData = await this.readJsonFile(this.sessionOperatorFile);
            const currentOperator = currentData.operator_id;
            
            // 同じオペレータが指定された場合は何もしない
            if (currentOperator === specifiedOperator) {
                const selectedStyle = this.selectStyle(character, style);
                
                return {
                    operatorId: specifiedOperator,
                    characterName: character.name,
                    currentStyle: {
                        styleId: selectedStyle.styleId,
                        styleName: selectedStyle.name,
                        personality: selectedStyle.personality,
                        speakingStyle: selectedStyle.speaking_style
                    },
                    voiceConfig: {
                        voiceId: character.voice_id,
                        styleId: selectedStyle.style_id
                    },
                    message: `現在のオペレータ: ${character.name} (${specifiedOperator})`
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
        
        // スタイルを選択
        const selectedStyle = this.selectStyle(character, style);
        
        // 音声設定を更新
        await this.updateVoiceSetting(character.voice_id, selectedStyle.style_id);
        
        return {
            operatorId: specifiedOperator,
            characterName: character.name,
            currentStyle: {
                styleId: selectedStyle.styleId,
                styleName: selectedStyle.name,
                personality: selectedStyle.personality,
                speakingStyle: selectedStyle.speaking_style
            },
            voiceConfig: {
                voiceId: character.voice_id,
                styleId: selectedStyle.style_id
            },
            greeting: character.greeting || ''
        };
    }

    /**
     * 音声設定を更新
     */
    async updateVoiceSetting(voiceId, styleId = 0) {
        try {
            const config = await this.readJsonFile(this.coeiroinkConfigFile, {});
            config.voice_id = voiceId;
            config.style_id = styleId;
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
        
        let character;
        try {
            character = await this.configManager.getCharacterConfig(operatorId);
        } catch {
            return {
                operatorId,
                message: `現在のオペレータ: ${operatorId} (キャラクター情報なし)`
            };
        }
        
        const selectedStyle = this.selectStyle(character);
        
        return {
            operatorId,
            characterName: character.name,
            currentStyle: {
                styleId: selectedStyle.styleId,
                styleName: selectedStyle.name,
                personality: selectedStyle.personality,
                speakingStyle: selectedStyle.speaking_style
            },
            message: `現在のオペレータ: ${character.name} (${operatorId}) - ${selectedStyle.name}`
        };
    }
}

export default OperatorManager;