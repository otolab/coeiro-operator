/**
 * src/say/index.ts: COEIROINK音声合成ライブラリ
 * MCPサーバから直接呼び出し可能なモジュール
 */

import { readFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { OperatorManager } from '../operator/index.js';
import { SpeechQueue } from './speech-queue.js';
import { AudioPlayer } from './audio-player.js';
import { AudioSynthesizer } from './audio-synthesizer.js';
import { logger } from '../../utils/logger.js';
import {
    DEFAULT_VOICE,
    CONNECTION_SETTINGS,
    SAMPLE_RATES,
    BUFFER_SIZES,
    FILTER_SETTINGS,
    SYNTHESIS_SETTINGS,
    STREAM_SETTINGS
} from './constants.js';
import type {
    Config,
    ConnectionConfig,
    VoiceConfig, 
    AudioConfig,
    StreamConfig,
    Chunk,
    AudioResult,
    OperatorVoice,
    SpeechTask,
    SynthesizeOptions,
    SynthesizeResult
} from './types.js';


// デフォルト設定
const DEFAULT_CONFIG: Config = {
    connection: {
        host: CONNECTION_SETTINGS.DEFAULT_HOST,
        port: CONNECTION_SETTINGS.DEFAULT_PORT
    },
    voice: {
        rate: SYNTHESIS_SETTINGS.DEFAULT_RATE,
        default_voice_id: DEFAULT_VOICE.ID  // つくよみちゃん「れいせい」（COEIROINKデフォルト）
    },
    audio: {
        latencyMode: 'balanced',
        splitMode: 'punctuation',
        bufferSize: BUFFER_SIZES.DEFAULT
    }
};

// ストリーミング設定
const STREAM_CONFIG: StreamConfig = {
    chunkSizeChars: STREAM_SETTINGS.CHUNK_SIZE_CHARS,
    overlapChars: STREAM_SETTINGS.OVERLAP_CHARS,
    bufferSize: STREAM_SETTINGS.BUFFER_SIZE,
    audioBufferMs: STREAM_SETTINGS.AUDIO_BUFFER_MS,
    silencePaddingMs: STREAM_SETTINGS.SILENCE_PADDING_MS,
    preloadChunks: STREAM_SETTINGS.PRELOAD_CHUNKS
};

/**
 * 設定ディレクトリを決定（ホームディレクトリベース）
 */
async function getConfigDir(): Promise<string> {
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
 * 設定ファイルのパスを取得
 */
async function getConfigPath(filename: string): Promise<string> {
    const configDir = await getConfigDir();
    return join(configDir, filename);
}


/**
 * 設定ファイルを読み込み
 */
export async function loadConfig(configFile: string | null = null): Promise<Config> {
    if (!configFile) {
        configFile = await getConfigPath('coeiroink-config.json');
    }
    
    try {
        await access(configFile, constants.F_OK);
    } catch {
        return DEFAULT_CONFIG;
    }
    
    try {
        const configData = await readFile(configFile, 'utf8');
        const rawConfig = JSON.parse(configData);
        return { ...DEFAULT_CONFIG, ...rawConfig };
    } catch (error) {
        logger.error(`設定ファイル読み込みエラー: ${(error as Error).message}`);
        return DEFAULT_CONFIG;
    }
}

export class SayCoeiroink {
    private config: Config;
    private operatorManager: OperatorManager;
    private speechQueue: SpeechQueue;
    private audioPlayer: AudioPlayer;
    private audioSynthesizer: AudioSynthesizer;

    constructor(config: Config | null = null) {
        this.config = config || DEFAULT_CONFIG;
        this.operatorManager = new OperatorManager();
        this.audioPlayer = new AudioPlayer(this.config);
        this.audioSynthesizer = new AudioSynthesizer(this.config);
        
        // SpeechQueueを初期化（処理コールバックを渡す）
        this.speechQueue = new SpeechQueue(async (task: SpeechTask) => {
            await this.synthesizeTextInternal(task.text, task.options);
        });
    }

    async initialize(): Promise<void> {
        try {
            await this.operatorManager.initialize();
        } catch (err) {
            throw new Error(`SayCoeiroink initialization failed: ${(err as Error).message}`);
        }
    }

    async buildDynamicConfig(): Promise<void> {
        try {
            await this.operatorManager.buildDynamicConfig();
        } catch (err) {
            throw new Error(`buildDynamicConfig failed: ${(err as Error).message}`);
        }
    }

    async initializeAudioPlayer(): Promise<boolean> {
        // プリセットベースの設定がaudio-player.ts内で適用されるため、
        // 個別設定の上書きのみここで行う
        const audioConfig = this.config.audio;
        
        if (audioConfig?.processing?.synthesisRate) {
            this.audioPlayer.setSynthesisRate(audioConfig.processing.synthesisRate);
        }
        
        if (audioConfig?.processing?.playbackRate) {
            this.audioPlayer.setPlaybackRate(audioConfig.processing.playbackRate);
        }
        
        if (audioConfig?.processing?.noiseReduction !== undefined) {
            this.audioPlayer.setNoiseReduction(audioConfig.processing.noiseReduction);
        }
        
        if (audioConfig?.processing?.lowpassFilter !== undefined) {
            const cutoff = audioConfig.processing.lowpassCutoff || FILTER_SETTINGS.LOWPASS_CUTOFF;
            this.audioPlayer.setLowpassFilter(audioConfig.processing.lowpassFilter, cutoff);
        }
        
        return await this.audioPlayer.initialize();
    }


    async getCurrentOperatorVoice(): Promise<OperatorVoice | null> {
        try {
            const currentStatus = await this.operatorManager.showCurrentOperator();
            
            if (!currentStatus.operatorId) {
                return null;
            }

            const character = await this.operatorManager.getCharacterInfo(currentStatus.operatorId);
            
            if (character && character.voice_id) {
                return {
                    voice_id: character.voice_id,
                    character: character
                };
            }

            return null;
        } catch (error) {
            logger.error(`オペレータ音声取得エラー: ${(error as Error).message}`);
            return null;
        }
    }



    // AudioPlayer の playAudioStream メソッドを使用
    async playAudioStream(audioResult: AudioResult): Promise<void> {
        return await this.audioPlayer.playAudioStream(audioResult);
    }


    // AudioSynthesizer の convertRateToSpeed メソッドを使用
    convertRateToSpeed(rate: number): number {
        return this.audioSynthesizer.convertRateToSpeed(rate);
    }

    /**
     * 設定に基づいてストリーミングモードを使用するかを判定
     */
    private shouldUseStreaming(text: string): boolean {
        const chunkMode = this.config.audio?.splitMode || 'punctuation';
        
        switch (chunkMode) {
            case 'none':
                return false; // チャンク化無効
            case 'small':
                return text.length > 30;
            case 'medium':
                return text.length > 50;
            case 'large':
                return text.length > 100;
            case 'punctuation':
                return text.includes('。') || text.length > 150; // 句点があるか長いテキスト
            default:
                return text.includes('。') || text.length > 150; // デフォルトは句読点モード
        }
    }

    async streamSynthesizeAndPlay(text: string, voiceId: string | OperatorVoice, speed: number, chunkMode: 'none' | 'small' | 'medium' | 'large' | 'punctuation' = 'punctuation', bufferSize?: number): Promise<void> {
        // 真のストリーミング再生：ジェネレータを直接AudioPlayerに渡す
        await this.audioPlayer.playStreamingAudio(
            this.audioSynthesizer.synthesizeStream(text, voiceId, speed, chunkMode),
            bufferSize
        );
    }

    // AudioSynthesizer の listVoices メソッドを使用
    async listVoices(): Promise<void> {
        return await this.audioSynthesizer.listVoices();
    }

    // AudioPlayer の saveAudio メソッドを使用
    async saveAudio(audioBuffer: ArrayBuffer, outputFile: string): Promise<void> {
        return await this.audioPlayer.saveAudio(audioBuffer, outputFile);
    }

    // AudioSynthesizer の checkServerConnection メソッドを使用
    async checkServerConnection(): Promise<boolean> {
        return await this.audioSynthesizer.checkServerConnection();
    }

    // SpeechQueue の enqueue メソッドを使用
    async enqueueSpeech(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        return await this.speechQueue.enqueue(text, options);
    }

    // SpeechQueue のステータスを取得
    getSpeechQueueStatus() {
        return this.speechQueue.getStatus();
    }

    // SpeechQueue をクリア
    clearSpeechQueue(): void {
        this.speechQueue.clear();
    }

    // CLIからの直接呼び出し用メソッド
    async synthesizeText(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        return await this.synthesizeTextInternal(text, options);
    }

    // MCPサーバから呼び出される非同期キューイング版メソッド
    async synthesizeTextAsync(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        return await this.enqueueSpeech(text, options);
    }

    // 内部用の実際の音声合成処理
    async synthesizeTextInternal(text: string, options: SynthesizeOptions = {}): Promise<SynthesizeResult> {
        logger.info(`音声合成開始: テキスト="${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
        
        const {
            voice = null,
            rate = this.config.voice?.rate || 200,
            outputFile = null,
            streamMode = false,
            style = null,
            chunkMode = this.config.audio?.splitMode || 'punctuation',
            bufferSize = this.config.audio?.bufferSize || BUFFER_SIZES.DEFAULT,
            allowFallback = true  // デフォルトフォールバックを許可するかどうか
        } = options;
        
        // 音声選択の優先順位処理
        let selectedVoice: string | OperatorVoice | null = voice;
        if (!selectedVoice) {
            // 1. operator-manager から現在のオペレータの音声を取得
            const operatorVoice = await this.getCurrentOperatorVoice();
            if (operatorVoice) {
                logger.info(`オペレータ音声を使用: ${operatorVoice.character?.name || 'Unknown'} (voice_id: ${operatorVoice.voice_id})`);
                selectedVoice = operatorVoice;
            } else if (allowFallback) {
                // 2. フォールバック: 設定ファイルのデフォルト音声を使用（CLIのみ）
                const fallbackVoiceId = this.config.voice?.default_voice_id || DEFAULT_VOICE.ID;
                logger.info(`フォールバック音声を使用: ${fallbackVoiceId}`);
                selectedVoice = fallbackVoiceId;
            } else {
                // MCPの場合はオペレータが必要
                logger.error('オペレータが割り当てられておらず、フォールバックも無効です');
                throw new Error('オペレータが割り当てられていません。まず operator_assign を実行してください。');
            }
        }

        // 音声が取得できない場合は最後のフォールバック
        if (!selectedVoice) {
            logger.error('音声が選択できませんでした');
            throw new Error('音声が指定されておらず、オペレータも割り当てられていません');
        }

        // スタイル明示的指定の処理
        if (style && typeof selectedVoice === 'object' && selectedVoice.character) {
            const character = selectedVoice.character;
            const specifiedStyle = Object.entries(character.available_styles || {})
                .find(([styleId, styleData]) => styleId === style && !styleData.disabled);
            
            if (specifiedStyle) {
                // 指定されたスタイルが有効な場合、一時的にキャラクターの設定を上書き
                const modifiedCharacter = {
                    ...character,
                    style_selection: 'specified',
                    default_style: style
                };
                selectedVoice = {
                    ...selectedVoice,
                    character: modifiedCharacter
                };
            } else {
                logger.warn(`指定されたスタイル '${style}' は利用できません。デフォルトスタイルを使用します。`);
            }
        }

        // サーバー接続確認
        if (!(await this.checkServerConnection())) {
            const host = this.config.connection?.host || 'localhost';
            const port = this.config.connection?.port || '50032';
            logger.error(`COEIROINKサーバーに接続できません: http://${host}:${port}`);
            throw new Error(`Cannot connect to COEIROINK server (http://${host}:${port})`);
        }

        const speed = this.convertRateToSpeed(rate);
        
        if (outputFile) {
            logger.info(`ファイル出力モード: ${outputFile}`);
            // ファイル出力モード：ストリーミング合成してファイルに保存
            const audioChunks: ArrayBuffer[] = [];
            for await (const audioResult of this.audioSynthesizer.synthesizeStream(text, selectedVoice, speed, chunkMode)) {
                audioChunks.push(audioResult.audioBuffer);
            }
            
            // 全チャンクを結合
            const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
            const combinedBuffer = new ArrayBuffer(totalLength);
            const view = new Uint8Array(combinedBuffer);
            let offset = 0;
            
            for (const chunk of audioChunks) {
                view.set(new Uint8Array(chunk), offset);
                offset += chunk.byteLength;
            }
            
            await this.saveAudio(combinedBuffer, outputFile);
            return { success: true, outputFile, mode: 'file' };
        } else {
            logger.info('ストリーミング再生モード');
            // 統一されたストリーミング再生
            if (!(await this.initializeAudioPlayer())) {
                logger.error('音声プレーヤーの初期化に失敗');
                throw new Error('音声プレーヤーの初期化に失敗しました');
            }
            
            logger.info('音声ストリーミング再生開始...');
            await this.streamSynthesizeAndPlay(text, selectedVoice, speed, chunkMode, bufferSize);
            logger.info('音声ストリーミング再生完了');
            return { success: true, mode: 'streaming' };
        }
    }
}

// デフォルトエクスポート
export default SayCoeiroink;