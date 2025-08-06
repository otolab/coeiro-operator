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
import type {
    Config,
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
    host: 'localhost',
    port: '50032',
    rate: 200
};

// ストリーミング設定
const STREAM_CONFIG: StreamConfig = {
    chunkSizeChars: 50,          // 文字単位でのチャンク分割
    overlapChars: 5,             // チャンク間のオーバーラップ（音切れ防止）
    bufferSize: 3,               // 音声バッファサイズ（並列処理数）
    audioBufferMs: 100,          // 音声出力バッファ時間
    silencePaddingMs: 50,        // 音切れ防止用の無音パディング
    preloadChunks: 2,            // 先読みチャンク数
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
        const config = JSON.parse(configData);
        return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
        console.error(`設定ファイル読み込みエラー: ${(error as Error).message}`);
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
        this.audioPlayer = new AudioPlayer();
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
            console.error(`オペレータ音声取得エラー: ${(error as Error).message}`);
            return null;
        }
    }



    // AudioPlayer の playAudioStream メソッドを使用
    async playAudioStream(audioResult: AudioResult): Promise<void> {
        return await this.audioPlayer.playAudioStream(audioResult);
    }

    // AudioPlayer の playAudioFile メソッドを使用
    async playAudioFile(audioFile: string): Promise<void> {
        return await this.audioPlayer.playAudioFile(audioFile);
    }



    // AudioSynthesizer の convertRateToSpeed メソッドを使用
    convertRateToSpeed(rate: number): number {
        return this.audioSynthesizer.convertRateToSpeed(rate);
    }

    async streamSynthesizeAndPlay(text: string, voiceId: string | OperatorVoice, speed: number): Promise<void> {
        // AudioSynthesizer の synthesizeStream と AudioPlayer を組み合わせて使用
        for await (const audioResult of this.audioSynthesizer.synthesizeStream(text, voiceId, speed)) {
            await this.audioPlayer.playAudioStream(audioResult);
        }
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
        console.log(`DEBUG: enqueueSpeech called with text: "${text}"`);
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
        const {
            voice = null,
            rate = this.config.rate,
            outputFile = null,
            streamMode = false,
            style = null
        } = options;

        // 音声選択の優先順位処理
        let selectedVoice: string | OperatorVoice | null = voice;
        if (!selectedVoice) {
            // 1. operator-manager から現在のオペレータの音声を取得
            const operatorVoice = await this.getCurrentOperatorVoice();
            if (operatorVoice) {
                selectedVoice = operatorVoice;
            } else {
                // 2. フォールバック: 設定ファイルのデフォルト音声を使用
                selectedVoice = this.config.voice_id || 'b28bb401-bc43-c9c7-77e4-77a2bbb4b283';
            }
        }

        // 音声が取得できない場合は最後のフォールバック
        if (!selectedVoice) {
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
                console.warn(`指定されたスタイル '${style}' は利用できません。デフォルトスタイルを使用します。`);
            }
        }

        // サーバー接続確認
        if (!(await this.checkServerConnection())) {
            throw new Error(`Cannot connect to COEIROINK server (http://${this.config.host}:${this.config.port})`);
        }

        const speed = this.convertRateToSpeed(rate);
        
        if (outputFile) {
            // ファイル出力モード：ストリーミング合成してファイルに保存
            const audioChunks: ArrayBuffer[] = [];
            for await (const audioResult of this.audioSynthesizer.synthesizeStream(text, selectedVoice, speed)) {
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
            // 統一されたストリーミング再生
            if (!(await this.initializeAudioPlayer())) {
                throw new Error('音声プレーヤーの初期化に失敗しました');
            }
            
            await this.streamSynthesizeAndPlay(text, selectedVoice, speed);
            return { success: true, mode: 'streaming' };
        }
    }
}

// デフォルトエクスポート
export default SayCoeiroink;