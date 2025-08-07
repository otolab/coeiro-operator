/**
 * src/say/audio-synthesizer.ts: 音声合成処理
 * COEIROINK APIを使用した音声合成機能を担当
 */

import type {
    Config,
    StreamConfig,
    Chunk,
    AudioResult,
    OperatorVoice
} from './types.js';

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
    constructor(private config: Config) {}

    /**
     * 設定から音声生成時のサンプルレートを取得
     */
    private getSynthesisRate(): number {
        return this.config.synthesisRate || 24000;
    }

    /**
     * 設定ファイルに基づいてチャンクモード設定を生成
     */
    private getChunkModeConfig() {
        return {
            none: { chunkSize: Infinity, overlap: 0 },
            small: { 
                chunkSize: this.config.chunkSizeSmall || 30, 
                overlap: Math.round((this.config.chunkSizeSmall || 30) * (this.config.overlapRatio || 0.1))
            },
            medium: { 
                chunkSize: this.config.chunkSizeMedium || 50, 
                overlap: Math.round((this.config.chunkSizeMedium || 50) * (this.config.overlapRatio || 0.1))
            },
            large: { 
                chunkSize: this.config.chunkSizeLarge || 100, 
                overlap: Math.round((this.config.chunkSizeLarge || 100) * (this.config.overlapRatio || 0.1))
            },
            auto: { 
                chunkSize: this.config.chunkSizeMedium || 50, 
                overlap: Math.round((this.config.chunkSizeMedium || 50) * (this.config.overlapRatio || 0.1))
            }
        } as const;
    }

    /**
     * サーバー接続確認
     */
    async checkServerConnection(): Promise<boolean> {
        const url = `http://${this.config.host}:${this.config.port}/v1/speakers`;
        
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
        const url = `http://${this.config.host}:${this.config.port}/v1/speakers`;
        
        try {
            const response = await fetch(url, { 
                signal: AbortSignal.timeout(3000) 
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const speakers = await response.json();
            console.log('Available voices:');
            
            speakers.forEach((speaker: any) => {
                console.log(`${speaker.speakerUuid}: ${speaker.speakerName}`);
                speaker.styles.forEach((style: any) => {
                    console.log(`  Style ${style.styleId}: ${style.styleName}`);
                });
            });
        } catch (error) {
            console.error(`Error: Cannot connect to COEIROINK server at http://${this.config.host}:${this.config.port}`);
            console.error('Make sure the server is running.');
            throw error;
        }
    }

    /**
     * テキストを音切れ防止のためのオーバーラップ付きチャンクに分割
     */
    splitTextIntoChunks(text: string, chunkMode: 'auto' | 'none' | 'small' | 'medium' | 'large' = 'auto'): Chunk[] {
        const chunks: Chunk[] = [];
        const config = this.getChunkModeConfig()[chunkMode];
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
        const url = `http://${this.config.host}:${this.config.port}/v1/synthesis`;
        
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

        // 音切れ防止: 前後に無音パディングを追加
        const paddingMs = chunk.isFirst ? STREAM_CONFIG.silencePaddingMs : STREAM_CONFIG.silencePaddingMs / 2;
        const postPaddingMs = chunk.isLast ? STREAM_CONFIG.silencePaddingMs : STREAM_CONFIG.silencePaddingMs / 2;

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