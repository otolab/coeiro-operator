/**
 * src/say/audio-synthesizer.ts: 音声合成処理
 * COEIROINK APIを使用した音声合成機能を担当
 */

import type {
    Config,
    ConnectionConfig,
    StreamConfig,
    Chunk,
    AudioResult,
    OperatorVoice,
    AudioConfig
} from './types.js';
import { logger } from '../utils/logger.js';

// ストリーミング設定
const STREAM_CONFIG: StreamConfig = {
    chunkSizeChars: 50,          // 文字単位でのチャンク分割
    overlapChars: 5,             // チャンク間のオーバーラップ（音切れ防止）
    bufferSize: 3,               // 音声バッファサイズ（並列処理数）
    audioBufferMs: 100,          // 音声出力バッファ時間
    silencePaddingMs: 50,        // 音切れ防止用の無音パディング
    preloadChunks: 2,            // 先読みチャンク数
};

export class AudioSynthesizer {
    private audioConfig: AudioConfig;
    
    constructor(private config: Config) {
        this.audioConfig = this.getAudioConfig();
    }

    /**
     * オーディオ設定を取得
     */
    private getAudioConfig(): AudioConfig {
        const latencyMode = this.config.audio?.latencyMode || 'balanced';
        
        const presets = {
            'ultra-low': {
                splitSettings: { smallSize: 20, mediumSize: 30, largeSize: 50, overlapRatio: 0.05 },
                paddingSettings: { enabled: false, prePhonemeLength: 0, postPhonemeLength: 0, firstChunkOnly: true }
            },
            'balanced': {
                splitSettings: { smallSize: 30, mediumSize: 50, largeSize: 100, overlapRatio: 0.1 },
                paddingSettings: { enabled: true, prePhonemeLength: 0.01, postPhonemeLength: 0.01, firstChunkOnly: true }
            },
            'quality': {
                splitSettings: { smallSize: 40, mediumSize: 70, largeSize: 150, overlapRatio: 0.15 },
                paddingSettings: { enabled: true, prePhonemeLength: 0.02, postPhonemeLength: 0.02, firstChunkOnly: false }
            }
        };

        const preset = presets[latencyMode];
        return {
            latencyMode,
            splitSettings: { ...preset.splitSettings, ...this.config.audio?.splitSettings },
            paddingSettings: { ...preset.paddingSettings, ...this.config.audio?.paddingSettings }
        };
    }

    /**
     * 設定から音声生成時のサンプルレートを取得
     */
    private getSynthesisRate(): number {
        return this.config.audio.processing?.synthesisRate || 24000;
    }

    /**
     * 設定ファイルに基づいて分割モード設定を生成
     */
    private getSplitModeConfig() {
        // latencyModeプリセットの値を優先し、個別設定で上書き
        const splitSettings = {
            smallSize: this.audioConfig.splitSettings?.smallSize || 30,
            mediumSize: this.audioConfig.splitSettings?.mediumSize || 50,
            largeSize: this.audioConfig.splitSettings?.largeSize || 100,
            overlapRatio: this.audioConfig.splitSettings?.overlapRatio || 0.1
        };
        
        return {
            none: { chunkSize: Infinity, overlap: 0 },
            small: { 
                chunkSize: splitSettings.smallSize || 30, 
                overlap: Math.round((splitSettings.smallSize || 30) * (splitSettings.overlapRatio || 0.1))
            },
            medium: { 
                chunkSize: splitSettings.mediumSize || 50, 
                overlap: Math.round((splitSettings.mediumSize || 50) * (splitSettings.overlapRatio || 0.1))
            },
            large: { 
                chunkSize: splitSettings.largeSize || 100, 
                overlap: Math.round((splitSettings.largeSize || 100) * (splitSettings.overlapRatio || 0.1))
            },
            auto: { 
                chunkSize: splitSettings.mediumSize || 50, 
                overlap: Math.round((splitSettings.mediumSize || 50) * (splitSettings.overlapRatio || 0.1))
            }
        } as const;
    }

    /**
     * サーバー接続確認
     */
    async checkServerConnection(): Promise<boolean> {
        const url = `http://${this.config.connection.host}:${this.config.connection.port}/v1/speakers`;
        
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
     * 利用可能な音声一覧を取得
     */
    async listVoices(): Promise<void> {
        const url = `http://${this.config.connection.host}:${this.config.connection.port}/v1/speakers`;
        
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(3000) 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const speakers = await response.json();
            logger.info('Available voices:');
            
            speakers.forEach((speaker: any) => {
                logger.info(`${speaker.speakerUuid}: ${speaker.speakerName}`);
                speaker.styles.forEach((style: any) => {
                    logger.info(`  Style ${style.styleId}: ${style.styleName}`);
                });
            });
        } catch (error) {
            logger.error(`Error: Cannot connect to COEIROINK server at http://${this.config.connection.host}:${this.config.connection.port}`);
            logger.error('Make sure the server is running.');
            throw error;
        }
    }

    /**
     * テキストを音切れ防止のためのオーバーラップ付きチャンクに分割
     */
    splitTextIntoChunks(text: string, splitMode: 'auto' | 'none' | 'small' | 'medium' | 'large' = 'auto'): Chunk[] {
        const chunks: Chunk[] = [];
        const config = this.getSplitModeConfig()[splitMode];
        const chunkSize = config.chunkSize;
        const overlap = config.overlap;
        
        for (let i = 0; i < text.length; i += chunkSize - overlap) {
            const end = Math.min(i + chunkSize, text.length);
            const chunk = text.slice(i, end);
            
            if (chunk.trim().length > 0) {
                chunks.push({
                    text: chunk,
                    index: chunks.length,
                    isFirst: i === 0,
                    isLast: end >= text.length,
                    overlap: i > 0 ? overlap : 0
                });
            }
        }
        
        return chunks;
    }

    /**
     * 単一チャンクの音声合成
     */
    async synthesizeChunk(chunk: Chunk, voiceInfo: string | OperatorVoice, speed: number): Promise<AudioResult> {
        const url = `http://${this.config.connection.host}:${this.config.connection.port}/v1/synthesis`;
        
        // voiceInfoから音声IDとスタイルIDを取得
        let voiceId: string;
        let styleId = 0;
        
        if (typeof voiceInfo === 'object' && voiceInfo.voice_id) {
            // 新しいアーキテクチャ: オペレータ情報付き
            voiceId = voiceInfo.voice_id;
            
            // キャラクターのスタイル選択ロジックを適用
            if (voiceInfo.character) {
                const character = voiceInfo.character;
                const availableStyles = Object.entries(character.available_styles || {})
                    .filter(([_, style]) => !style.disabled)
                    .map(([styleId, style]) => ({ styleId, ...style }));
                
                if (availableStyles.length > 0) {
                    let selectedStyle: any;
                    switch (character.style_selection) {
                        case 'default':
                            selectedStyle = availableStyles.find(s => s.styleId === character.default_style);
                            break;
                        case 'random':
                            selectedStyle = availableStyles[Math.floor(Math.random() * availableStyles.length)];
                            break;
                        default:
                            selectedStyle = availableStyles[0];
                    }
                    
                    // フォールバック: default_styleが見つからない場合は最初のスタイルを使用
                    if (!selectedStyle) {
                        selectedStyle = availableStyles[0];
                    }
                    
                    styleId = selectedStyle?.style_id || 0;
                }
            }
        } else {
            // 従来の形式: 音声IDのみ
            voiceId = voiceInfo as string;
        }

        // 音切れ防止: 前後に無音パディングを追加（設定に基づく）
        let paddingMs = 0;
        let postPaddingMs = 0;
        
        if (this.audioConfig.paddingSettings?.enabled) {
            const basePrePadding = this.audioConfig.paddingSettings.prePhonemeLength || 0.01;
            const basePostPadding = this.audioConfig.paddingSettings.postPhonemeLength || 0.01;
            const firstChunkOnly = this.audioConfig.paddingSettings.firstChunkOnly;
            
            if (!firstChunkOnly || chunk.isFirst) {
                paddingMs = (chunk.isFirst ? basePrePadding : basePrePadding / 2) * 1000;
                postPaddingMs = (chunk.isLast ? basePostPadding : basePostPadding / 2) * 1000;
            }
        }

        const synthesisParam = {
            text: chunk.text,
            speakerUuid: voiceId,
            styleId: styleId,
            speedScale: speed,
            volumeScale: 1.0,
            pitchScale: 0.0,
            intonationScale: 1.0,
            prePhonemeLength: paddingMs / 1000,
            postPhonemeLength: postPaddingMs / 1000,
            outputSamplingRate: this.getSynthesisRate()
        };

        const startTime = Date.now();
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(synthesisParam)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const audioBuffer = await response.arrayBuffer();
            const latency = Date.now() - startTime;
            
            return {
                chunk,
                audioBuffer,
                latency
            };
        } catch (error) {
            throw new Error(`チャンク${chunk.index}合成エラー: ${(error as Error).message}`);
        }
    }

    /**
     * レート値をスピード値に変換
     */
    convertRateToSpeed(rate: number): number {
        const baseRate = 200;
        let speed = rate / baseRate;
        if (speed < 0.5) speed = 0.5;
        if (speed > 2.0) speed = 2.0;
        return speed;
    }

    /**
     * ストリーミング音声合成
     */
    async* synthesizeStream(text: string, voiceId: string | OperatorVoice, speed: number, chunkMode: 'auto' | 'none' | 'small' | 'medium' | 'large' = 'auto'): AsyncGenerator<AudioResult> {
        const chunks = this.splitTextIntoChunks(text, chunkMode);

        for (const chunk of chunks) {
            const result = await this.synthesizeChunk(chunk, voiceId, speed);
            yield result;
        }
    }

    /**
     * 単純な音声合成（単一ファイル）
     */
    async synthesize(text: string, voiceId: string | OperatorVoice, speed: number): Promise<AudioResult> {
        const chunk: Chunk = {
            text,
            index: 0,
            isFirst: true,
            isLast: true,
            overlap: 0
        };

        return await this.synthesizeChunk(chunk, voiceId, speed);
    }
}