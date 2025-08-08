/**
 * src/core/environment/voice-provider.ts: 音声環境情報プロバイダ
 * COEIROINKサーバーからの動的音声情報取得を一元管理
 */

import { DEFAULT_VOICE, CONNECTION_SETTINGS } from '../say/constants.js';

export interface VoiceStyle {
    styleId: number;
    styleName: string;
}

export interface Speaker {
    speakerName: string;
    speakerUuid: string;
    styles: VoiceStyle[];
}

export interface VoiceInfo {
    id: string;
    name: string;
    voice_id: string;
    styles: Array<{
        id: number;
        name: string;
        style_id: number;
    }>;
}

export interface ConnectionConfig {
    host: string;
    port: string;
}

/**
 * 音声環境情報プロバイダクラス
 * COEIROINKサーバーからの音声情報取得を一元管理
 */
export class VoiceProvider {
    private connectionConfig: ConnectionConfig;
    private cachedSpeakers: Speaker[] | null = null;
    private lastFetchTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分間キャッシュ

    constructor(connectionConfig?: Partial<ConnectionConfig>) {
        this.connectionConfig = {
            host: connectionConfig?.host || CONNECTION_SETTINGS.DEFAULT_HOST,
            port: connectionConfig?.port || CONNECTION_SETTINGS.DEFAULT_PORT
        };
    }

    /**
     * 接続設定を更新
     */
    updateConnection(config: Partial<ConnectionConfig>): void {
        this.connectionConfig = {
            ...this.connectionConfig,
            ...config
        };
        // 接続設定が変更されたらキャッシュをクリア
        this.clearCache();
    }

    /**
     * キャッシュをクリア
     */
    clearCache(): void {
        this.cachedSpeakers = null;
        this.lastFetchTime = 0;
    }

    /**
     * サーバー接続確認
     */
    async checkConnection(): Promise<boolean> {
        const url = `http://${this.connectionConfig.host}:${this.connectionConfig.port}/v1/speakers`;
        
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(3000) 
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * 利用可能な音声一覧を取得（キャッシュ対応）
     */
    async getSpeakers(): Promise<Speaker[]> {
        const now = Date.now();
        
        // キャッシュが有効な場合はキャッシュを返す
        if (this.cachedSpeakers && (now - this.lastFetchTime) < this.CACHE_DURATION) {
            return this.cachedSpeakers;
        }

        const url = `http://${this.connectionConfig.host}:${this.connectionConfig.port}/v1/speakers`;
        
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(5000) 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const speakers = await response.json() as Speaker[];
            
            // キャッシュを更新
            this.cachedSpeakers = speakers;
            this.lastFetchTime = now;
            
            return speakers;
        } catch (error) {
            console.warn(`音声情報取得エラー: ${(error as Error).message}`);
            // エラー時は空配列を返す（既存のキャッシュがあれば使用）
            return this.cachedSpeakers || [];
        }
    }

    /**
     * 特定の音声のスタイル情報を取得
     */
    async getVoiceStyles(voiceId: string): Promise<VoiceStyle[]> {
        const speakers = await this.getSpeakers();
        const speaker = speakers.find(s => s.speakerUuid === voiceId);
        return speaker?.styles || [];
    }

    /**
     * 特定の音声の最初のスタイルIDを取得（フォールバック用）
     */
    async getFirstStyleId(voiceId: string): Promise<number> {
        const styles = await this.getVoiceStyles(voiceId);
        return styles.length > 0 ? styles[0].styleId : DEFAULT_VOICE.STYLE_ID;
    }

    /**
     * ConfigManager用のVoiceInfo形式に変換
     */
    async getVoicesForConfig(): Promise<VoiceInfo[]> {
        const speakers = await this.getSpeakers();
        
        return speakers.map(speaker => ({
            id: this.speakerNameToId(speaker.speakerName),
            name: speaker.speakerName,
            voice_id: speaker.speakerUuid,
            styles: speaker.styles.map(style => ({
                id: style.styleId,
                name: style.styleName,
                style_id: style.styleId
            }))
        }));
    }

    /**
     * デバッグ用：音声一覧をコンソール出力
     */
    async logAvailableVoices(): Promise<void> {
        try {
            const speakers = await this.getSpeakers();
            
            console.log('Available voices:');
            speakers.forEach((speaker) => {
                console.log(`${speaker.speakerUuid}: ${speaker.speakerName}`);
                speaker.styles.forEach((style) => {
                    console.log(`  Style ${style.styleId}: ${style.styleName}`);
                });
            });
        } catch (error) {
            console.error(`Error: Cannot connect to COEIROINK server at http://${this.connectionConfig.host}:${this.connectionConfig.port}`);
            console.error('Make sure the server is running.');
            throw error;
        }
    }

    /**
     * 音声名からIDを生成（英語名への変換）
     */
    private speakerNameToId(speakerName: string): string {
        const SPEAKER_NAME_TO_ID_MAP: Record<string, string> = {
            'つくよみちゃん': 'tsukuyomi',
            'アンジーさん': 'angie', 
            'アルマちゃん': 'alma',
            'AI声優-朱花': 'ai_shuka',
            'ディアちゃん': 'dia',
            'AI声優-KANA': 'ai_kana',
            'AI声優-金苗': 'ai_kanae',
            'リリンちゃん': 'ririn',
            'AI声優-MANA': 'ai_mana'
        };
        
        return SPEAKER_NAME_TO_ID_MAP[speakerName] || 
               speakerName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
}

/**
 * シングルトンインスタンス
 * プロジェクト全体で共有される音声プロバイダ
 */
let globalVoiceProvider: VoiceProvider | null = null;

/**
 * グローバル音声プロバイダを取得
 * 設定ファイルから接続情報を読み込んで初期化
 */
export function getVoiceProvider(connectionConfig?: Partial<ConnectionConfig>): VoiceProvider {
    if (!globalVoiceProvider || connectionConfig) {
        globalVoiceProvider = new VoiceProvider(connectionConfig);
    }
    return globalVoiceProvider;
}

/**
 * 音声プロバイダをリセット（テスト用）
 */
export function resetVoiceProvider(): void {
    globalVoiceProvider = null;
}