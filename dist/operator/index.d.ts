#!/usr/bin/env node
export class OperatorManager {
    sessionId: string;
    configDir: string | null;
    sessionDir: string | null;
    activeOperatorsFile: string | null;
    speechLockFile: string | null;
    sessionOperatorFile: string | null;
    coeiroinkConfigFile: string | null;
    configManager: ConfigManager | null;
    initialize(): Promise<void>;
    /**
     * JSONファイルを安全に読み込み
     */
    readJsonFile(filePath: any, defaultValue?: {}): Promise<any>;
    /**
     * JSONファイルを安全に書き込み
     */
    writeJsonFile(filePath: any, data: any): Promise<void>;
    /**
     * 利用中オペレータファイルの初期化
     */
    initActiveOperators(): Promise<void>;
    /**
     * キャラクター情報を取得
     */
    getCharacterInfo(characterId: any): Promise<import("./config-manager.js").CharacterConfig>;
    /**
     * スタイルを選択
     */
    selectStyle(character: any, specifiedStyle?: null): any;
    /**
     * 挨拶パターンを自動抽出
     */
    extractGreetingPatterns(): Promise<string[]>;
    /**
     * 利用可能なオペレータを取得
     */
    getAvailableOperators(): Promise<string[]>;
    /**
     * オペレータを予約
     */
    reserveOperator(operatorId: any): Promise<boolean>;
    /**
     * オペレータを返却
     */
    releaseOperator(): Promise<{
        operatorId: any;
        characterName: any;
        farewell: string;
    }>;
    /**
     * 全ての利用状況をクリア
     */
    clearAllOperators(): Promise<boolean>;
    /**
     * ランダムオペレータ選択と詳細情報付きアサイン
     */
    assignRandomOperator(style?: null): Promise<{
        operatorId: any;
        characterName: string;
        currentStyle: {
            styleId: any;
            styleName: any;
            personality: any;
            speakingStyle: any;
        };
        voiceConfig: {
            voiceId: string | null;
            styleId: any;
        };
        message: string;
        greeting?: undefined;
    } | {
        operatorId: any;
        characterName: string;
        currentStyle: {
            styleId: any;
            styleName: any;
            personality: any;
            speakingStyle: any;
        };
        voiceConfig: {
            voiceId: string | null;
            styleId: any;
        };
        greeting: string;
        message?: undefined;
    }>;
    /**
     * 指定されたオペレータを詳細情報付きでアサイン
     */
    assignSpecificOperator(specifiedOperator: any, style?: null): Promise<{
        operatorId: any;
        characterName: string;
        currentStyle: {
            styleId: any;
            styleName: any;
            personality: any;
            speakingStyle: any;
        };
        voiceConfig: {
            voiceId: string | null;
            styleId: any;
        };
        message: string;
        greeting?: undefined;
    } | {
        operatorId: any;
        characterName: string;
        currentStyle: {
            styleId: any;
            styleName: any;
            personality: any;
            speakingStyle: any;
        };
        voiceConfig: {
            voiceId: string | null;
            styleId: any;
        };
        greeting: string;
        message?: undefined;
    }>;
    /**
     * 音声設定を更新
     */
    updateVoiceSetting(voiceId: any, styleId?: number): Promise<void>;
    /**
     * 現在のオペレータ情報表示
     */
    showCurrentOperator(): Promise<{
        message: string;
        operatorId?: undefined;
        characterName?: undefined;
        currentStyle?: undefined;
    } | {
        operatorId: any;
        message: string;
        characterName?: undefined;
        currentStyle?: undefined;
    } | {
        operatorId: any;
        characterName: string;
        currentStyle: {
            styleId: any;
            styleName: any;
            personality: any;
            speakingStyle: any;
        };
        message: string;
    }>;
}
export default OperatorManager;
import ConfigManager from './config-manager.js';
//# sourceMappingURL=index.d.ts.map