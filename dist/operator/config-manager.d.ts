/**
 * src/operator/config-manager.ts: 設定管理システム
 * 動的音声フォント取得、設定マージ、キャッシュ管理を担当
 */
export interface CharacterStyle {
    name: string;
    style_id: number;
    personality: string;
    speaking_style: string;
    disabled?: boolean;
}
export interface CharacterConfig {
    name: string;
    personality: string;
    speaking_style: string;
    greeting: string;
    farewell: string;
    default_style: string;
    style_selection: string;
    voice_id: string | null;
    available_styles: Record<string, CharacterStyle>;
    disabled?: boolean;
}
interface MergedConfig {
    characters: Record<string, CharacterConfig>;
}
export declare class ConfigManager {
    private configDir;
    private operatorConfigFile;
    private coeiroinkConfigFile;
    private availableVoices;
    private mergedConfig;
    constructor(configDir: string);
    /**
     * JSONファイルを安全に読み込み
     */
    readJsonFile<T>(filePath: string, defaultValue: T): Promise<T>;
    /**
     * JSONファイルを安全に書き込み
     */
    writeJsonFile(filePath: string, data: any): Promise<void>;
    /**
     * COEIROINKサーバーから利用可能な音声フォントを取得
     */
    fetchAvailableVoices(): Promise<void>;
    /**
     * 音声名からIDを生成（英語名への変換）
     */
    speakerNameToId(speakerName: string): string;
    /**
     * 再帰的なオブジェクトマージ
     */
    deepMerge(target: any, source: any): any;
    /**
     * 動的設定の構築（内蔵設定 + 動的音声情報 + ユーザー設定）
     */
    buildDynamicConfig(forceRefresh?: boolean): Promise<MergedConfig>;
    /**
     * 設定をリフレッシュ（キャッシュクリア）
     */
    refreshConfig(): void;
    /**
     * 特定キャラクターの設定を取得
     */
    getCharacterConfig(characterId: string): Promise<CharacterConfig>;
    /**
     * 利用可能なキャラクターIDリストを取得
     */
    getAvailableCharacterIds(): Promise<string[]>;
    /**
     * 挨拶パターンリストを取得
     */
    getGreetingPatterns(): Promise<string[]>;
    /**
     * デバッグ用：現在の設定状況を出力
     */
    debugConfig(): Promise<void>;
}
export default ConfigManager;
//# sourceMappingURL=config-manager.d.ts.map