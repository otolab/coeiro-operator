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
import { logger } from '../../utils/logger.js';
import {
    SAMPLE_RATES,
    SPLIT_SETTINGS,
    PADDING_SETTINGS,
    SYNTHESIS_SETTINGS
} from './constants.js';
import { getVoiceProvider } from '../environment/voice-provider.js';

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
    private voiceProvider = getVoiceProvider();
    
    constructor(private config: Config) {
        this.audioConfig = this.getAudioConfig();
        // 接続設定を更新
        this.voiceProvider.updateConnection({
            host: this.config.connection.host,
            port: this.config.connection.port
        });
    }

    /**
     * オーディオ設定を取得
     */
    private getAudioConfig(): AudioConfig {
        const latencyMode = this.config.audio?.latencyMode || 'balanced';
        
        const presets = {
            'ultra-low': {
                splitSettings: SPLIT_SETTINGS.PRESETS.ULTRA_LOW,
                paddingSettings: PADDING_SETTINGS.PRESETS.ULTRA_LOW
            },
            'balanced': {
                splitSettings: SPLIT_SETTINGS.PRESETS.BALANCED,
                paddingSettings: PADDING_SETTINGS.PRESETS.BALANCED
            },
            'quality': {
                splitSettings: SPLIT_SETTINGS.PRESETS.QUALITY,
                paddingSettings: PADDING_SETTINGS.PRESETS.QUALITY
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
        return this.config.audio.processing?.synthesisRate || SAMPLE_RATES.SYNTHESIS;
    }

    /**
     * 設定ファイルに基づいて分割モード設定を生成
     */
    private getSplitModeConfig() {
        // latencyModeプリセットの値を優先し、個別設定で上書き
        const splitSettings = {
            smallSize: this.audioConfig.splitSettings?.smallSize || SPLIT_SETTINGS.DEFAULTS.SMALL_SIZE,
            mediumSize: this.audioConfig.splitSettings?.mediumSize || SPLIT_SETTINGS.DEFAULTS.MEDIUM_SIZE,
            largeSize: this.audioConfig.splitSettings?.largeSize || SPLIT_SETTINGS.DEFAULTS.LARGE_SIZE,
            overlapRatio: this.audioConfig.splitSettings?.overlapRatio || SPLIT_SETTINGS.DEFAULTS.OVERLAP_RATIO
        };
        
        return {
            none: { chunkSize: Infinity, overlap: 0 },
            small: { 
                chunkSize: splitSettings.smallSize, 
                overlap: Math.round(splitSettings.smallSize * splitSettings.overlapRatio)
            },
            medium: { 
                chunkSize: splitSettings.mediumSize, 
                overlap: Math.round(splitSettings.mediumSize * splitSettings.overlapRatio)
            },
            large: { 
                chunkSize: splitSettings.largeSize, 
                overlap: Math.round(splitSettings.largeSize * splitSettings.overlapRatio)
            },
            auto: { 
                chunkSize: splitSettings.mediumSize, 
                overlap: Math.round(splitSettings.mediumSize * splitSettings.overlapRatio)
            },
            punctuation: { 
                chunkSize: SPLIT_SETTINGS.PUNCTUATION.MAX_CHUNK_SIZE, 
                overlap: SPLIT_SETTINGS.PUNCTUATION.OVERLAP_CHARS
            }
        } as const;
    }

    /**
     * サーバー接続確認
     */
    async checkServerConnection(): Promise<boolean> {
        return await this.voiceProvider.checkConnection();
    }

    /**
     * 利用可能な音声一覧を取得
     */
    async listVoices(): Promise<void> {
        await this.voiceProvider.logAvailableVoices();
    }

    /**
     * 句読点に基づくテキスト分割
     */
    private splitByPunctuation(text: string): Chunk[] {
        const chunks: Chunk[] = [];
        const config = SPLIT_SETTINGS.PUNCTUATION;
        
        // 句点（。）で最初に分割
        const rawSentences = text.split('。');
        const sentences: string[] = [];
        
        for (let i = 0; i < rawSentences.length; i++) {
            const sentence = rawSentences[i].trim();
            if (sentence.length > 0) {
                // 最後の要素以外、または元のテキストが句点で終わっている場合は句点を復元
                if (i < rawSentences.length - 1 || text.endsWith('。')) {
                    sentences.push(sentence + '。');
                } else {
                    sentences.push(sentence);
                }
            }
        }
        
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            
            // 文が最大文字数を超える場合は読点で分割、それでも長い場合は文字数で強制分割
            if (sentence.length > config.MAX_CHUNK_SIZE) {
                if (config.ALLOW_COMMA_SPLIT && sentence.includes('、')) {
                    const subChunks = this.splitLongSentenceByComma(sentence, config.MAX_CHUNK_SIZE);
                    subChunks.forEach(subChunk => {
                        if (subChunk.trim().length >= config.MIN_CHUNK_SIZE) {
                            chunks.push({
                                text: subChunk,
                                index: chunks.length,
                                isFirst: chunks.length === 0,
                                isLast: false, // 後で更新
                                overlap: 0
                            });
                        }
                    });
                } else {
                    // 読点もない場合は文字数で強制分割
                    const forcedChunks = this.forceSplitByLength(sentence, config.MAX_CHUNK_SIZE);
                    forcedChunks.forEach(chunk => {
                        if (chunk.trim().length >= config.MIN_CHUNK_SIZE) {
                            chunks.push({
                                text: chunk,
                                index: chunks.length,
                                isFirst: chunks.length === 0,
                                isLast: false, // 後で更新
                                overlap: 0
                            });
                        }
                    });
                }
            } else if (sentence.length >= config.MIN_CHUNK_SIZE) {
                chunks.push({
                    text: sentence,
                    index: chunks.length,
                    isFirst: chunks.length === 0,
                    isLast: false, // 後で更新
                    overlap: 0
                });
            }
        }
        
        // 最後のチャンクのisLastフラグを設定
        if (chunks.length > 0) {
            chunks[chunks.length - 1].isLast = true;
        }
        
        return chunks;
    }

    /**
     * 文字数で強制分割
     */
    private forceSplitByLength(text: string, maxSize: number): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += maxSize) {
            chunks.push(text.slice(i, i + maxSize));
        }
        return chunks;
    }

    /**
     * 長い文を読点で分割
     */
    private splitLongSentenceByComma(sentence: string, maxSize: number): string[] {
        const parts: string[] = [];
        const commaParts = sentence.split('、');
        
        let currentChunk = '';
        for (let i = 0; i < commaParts.length; i++) {
            const part = commaParts[i] + (i < commaParts.length - 1 ? '、' : '');
            
            if (currentChunk.length + part.length <= maxSize) {
                currentChunk += part;
            } else {
                if (currentChunk.length > 0) {
                    parts.push(currentChunk);
                    currentChunk = part;
                } else {
                    // 単一パートが最大サイズを超える場合は強制的に文字数分割
                    parts.push(part);
                }
            }
        }
        
        if (currentChunk.length > 0) {
            parts.push(currentChunk);
        }
        
        return parts;
    }

    /**
     * テキストを音切れ防止のためのオーバーラップ付きチャンクに分割
     */
    splitTextIntoChunks(text: string, splitMode: 'auto' | 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation'): Chunk[] {
        // 句読点分割の場合は専用処理
        if (splitMode === 'punctuation') {
            return this.splitByPunctuation(text);
        }
        
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
            // 従来の形式: 音声IDのみ - 正しいstyleIDを取得する必要がある
            voiceId = voiceInfo as string;
            
            // VoiceProviderから正しいstyleIDを取得
            try {
                styleId = await this.voiceProvider.getFirstStyleId(voiceId);
            } catch (error) {
                // API呼び出しが失敗した場合は0を使用（従来の動作）
                console.warn('Failed to fetch speaker styles, using styleId=0:', error);
                styleId = 0;
            }
        }

        // 音切れ防止: 前後に無音パディングを追加（設定に基づく）
        let paddingMs = 0;
        let postPaddingMs = 0;
        
        if (this.audioConfig.paddingSettings?.enabled) {
            const basePrePadding = this.audioConfig.paddingSettings.prePhonemeLength || PADDING_SETTINGS.DEFAULTS.PRE_PHONEME_LENGTH;
            const basePostPadding = this.audioConfig.paddingSettings.postPhonemeLength || PADDING_SETTINGS.DEFAULTS.POST_PHONEME_LENGTH;
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
            volumeScale: SYNTHESIS_SETTINGS.DEFAULT_VOLUME,
            pitchScale: SYNTHESIS_SETTINGS.DEFAULT_PITCH,
            intonationScale: SYNTHESIS_SETTINGS.DEFAULT_INTONATION,
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
    async* synthesizeStream(text: string, voiceId: string | OperatorVoice, speed: number, chunkMode: 'auto' | 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation'): AsyncGenerator<AudioResult> {
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