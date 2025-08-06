/**
 * src/operator/character-defaults.ts: 内蔵キャラクター設定
 * COEIROINKキャラクターのデフォルト設定を定義
 */
interface CharacterConfig {
    name: string;
    personality: string;
    speaking_style: string;
    greeting: string;
    farewell: string;
    default_style: string;
    style_selection: string;
}
export declare const BUILTIN_CHARACTER_CONFIGS: Record<string, CharacterConfig>;
export declare const SPEAKER_NAME_TO_ID_MAP: Record<string, string>;
export {};
//# sourceMappingURL=character-defaults.d.ts.map