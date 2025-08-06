#!/usr/bin/env node
/**
 * src/operator/index.ts: オペレータ管理システム（TypeScript実装）
 * キャラクター:スタイル単位での管理とMCP情報提供に対応
 */
interface Style {
    styleId: string;
    name: string;
    personality: string;
    speaking_style: string;
    style_id: number;
    enabled: boolean;
    disabled?: boolean;
}
interface Character {
    name: string;
    voice_id: string | null;
    available_styles: Record<string, Style>;
    style_selection: string;
    default_style: string;
    greeting?: string;
    farewell?: string;
    personality: string;
    speaking_style: string;
}
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
export declare class OperatorManager {
    private sessionId;
    private configDir;
    private sessionDir;
    private activeOperatorsFile;
    private speechLockFile;
    private sessionOperatorFile;
    private coeiroinkConfigFile;
    private configManager;
    constructor();
    initialize(): Promise<void>;
    /**
     * JSONファイルを安全に読み込み
     */
    readJsonFile<T>(filePath: string, defaultValue?: T): Promise<T>;
    /**
     * JSONファイルを安全に書き込み
     */
    writeJsonFile(filePath: string, data: any): Promise<void>;
    /**
     * 利用中オペレータファイルの初期化
     */
    initActiveOperators(): Promise<void>;
    /**
     * キャラクター情報を取得
     */
    getCharacterInfo(characterId: string): Promise<Character>;
    /**
     * スタイルを選択
     */
    selectStyle(character: Character, specifiedStyle?: string | null): Style;
    /**
     * 挨拶パターンを自動抽出
     */
    extractGreetingPatterns(): Promise<any>;
    /**
     * 利用可能なオペレータを取得
     */
    getAvailableOperators(): Promise<string[]>;
    /**
     * オペレータを予約
     */
    reserveOperator(operatorId: string): Promise<boolean>;
    /**
     * オペレータを返却
     */
    releaseOperator(): Promise<ReleaseResult>;
    /**
     * 全ての利用状況をクリア
     */
    clearAllOperators(): Promise<boolean>;
    /**
     * ランダムオペレータ選択と詳細情報付きアサイン
     */
    assignRandomOperator(style?: string | null): Promise<AssignResult>;
    /**
     * 指定されたオペレータを詳細情報付きでアサイン
     */
    assignSpecificOperator(specifiedOperator: string, style?: string | null): Promise<AssignResult>;
    /**
     * 音声設定を更新
     */
    updateVoiceSetting(voiceId: string | null, styleId?: number): Promise<void>;
    /**
     * 現在のオペレータ情報表示
     */
    showCurrentOperator(): Promise<StatusResult>;
}
export default OperatorManager;
//# sourceMappingURL=index.d.ts.map