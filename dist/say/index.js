/**
 * src/say/index.ts: COEIROINK音声合成ライブラリ
 * MCPサーバから直接呼び出し可能なモジュール
 */
import { readFile, access, mkdir } from 'fs/promises';
import { constants } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { createRequire } from 'module';
// ES Modules環境でrequireを使用
const require = createRequire(import.meta.url);
// デフォルト設定
const DEFAULT_CONFIG = {
    host: 'localhost',
    port: '50032',
    rate: 200
};
// ストリーミング設定
const STREAM_CONFIG = {
    chunkSizeChars: 50, // 文字単位でのチャンク分割
    overlapChars: 5, // チャンク間のオーバーラップ（音切れ防止）
    bufferSize: 3, // 音声バッファサイズ（並列処理数）
    audioBufferMs: 100, // 音声出力バッファ時間
    silencePaddingMs: 50, // 音切れ防止用の無音パディング
    preloadChunks: 2, // 先読みチャンク数
};
/**
 * 設定ディレクトリを決定（ホームディレクトリベース）
 */
async function getConfigDir() {
    // ホームディレクトリの ~/.coeiro-operator/ を優先
    const homeDir = join(process.env.HOME || process.env.USERPROFILE || '~', '.coeiro-operator');
    try {
        await mkdir(homeDir, { recursive: true });
        return homeDir;
    }
    catch {
        // フォールバック: 作業ディレクトリの .coeiroink/
        const workDir = join(process.cwd(), '.coeiroink');
        try {
            await mkdir(workDir, { recursive: true });
            return workDir;
        }
        catch {
            // 最終フォールバック: /tmp/coeiroink-mcp-shared/
            const tmpDir = '/tmp/coeiroink-mcp-shared';
            try {
                await mkdir(tmpDir, { recursive: true });
            }
            catch { }
            return tmpDir;
        }
    }
}
/**
 * 設定ファイルのパスを取得
 */
async function getConfigPath(filename) {
    const configDir = await getConfigDir();
    return join(configDir, filename);
}
/**
 * 設定ファイルを読み込み
 */
export async function loadConfig(configFile = null) {
    if (!configFile) {
        configFile = await getConfigPath('coeiroink-config.json');
    }
    try {
        await access(configFile, constants.F_OK);
    }
    catch {
        return DEFAULT_CONFIG;
    }
    try {
        const configData = await readFile(configFile, 'utf8');
        const config = JSON.parse(configData);
        return { ...DEFAULT_CONFIG, ...config };
    }
    catch (error) {
        console.error(`設定ファイル読み込みエラー: ${error.message}`);
        return DEFAULT_CONFIG;
    }
}
export class SayCoeiroink {
    config;
    audioPlayer = null;
    audioQueue = [];
    isPlaying = false;
    synthesisQueue = [];
    activeSynthesis = new Map();
    speechQueue = [];
    isProcessing = false;
    constructor(config = null) {
        this.config = config || DEFAULT_CONFIG;
    }
    async initializeAudioPlayer() {
        try {
            // Fallback to system audio command for compatibility
            console.error(`音声プレーヤー初期化: システムオーディオ使用（低レイテンシモード）`);
            this.audioPlayer = 'system';
            return true;
        }
        catch (error) {
            console.error(`音声プレーヤー初期化エラー: ${error.message}`);
            return false;
        }
    }
    // テキストを音切れ防止のためのオーバーラップ付きチャンクに分割
    splitTextIntoChunks(text) {
        const chunks = [];
        const chunkSize = STREAM_CONFIG.chunkSizeChars;
        const overlap = STREAM_CONFIG.overlapChars;
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
    async execCommand(command, args) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                }
                else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            child.on('error', (err) => {
                reject(new Error(`Failed to execute command: ${err.message}`));
            });
        });
    }
    async getCurrentOperatorVoice() {
        try {
            const operatorStatus = await this.execCommand('operator-manager', ['status']);
            if (operatorStatus === 'オペレータは割り当てられていません') {
                console.error('エラー: オペレータが割り当てられていません。');
                return null;
            }
            // オペレータIDを抽出
            const operatorMatch = operatorStatus.match(/([a-z]+)/);
            if (operatorMatch) {
                const operatorId = operatorMatch[1];
                // operator-config.jsonから音声情報を取得
                const operatorConfigPath = await getConfigPath('operator-config.json');
                try {
                    const operatorConfigData = await readFile(operatorConfigPath, 'utf8');
                    const operatorConfig = JSON.parse(operatorConfigData);
                    const character = operatorConfig.characters?.[operatorId];
                    if (character) {
                        return {
                            voice_id: character.voice_id,
                            character: character
                        };
                    }
                }
                catch (configError) {
                    console.error(`オペレータ設定読み込みエラー: ${configError.message}`);
                }
            }
        }
        catch (error) {
            console.error(`オペレータ音声取得エラー: ${error.message}`);
        }
        return null;
    }
    async synthesizeChunk(chunk, voiceInfo, speed) {
        const url = `http://${this.config.host}:${this.config.port}/v1/synthesis`;
        // voiceInfoから音声IDとスタイルIDを取得
        let voiceId;
        let styleId = 0;
        if (typeof voiceInfo === 'object' && voiceInfo.voice_id) {
            // 新しいアーキテクチャ: オペレータ情報付き
            voiceId = voiceInfo.voice_id;
            // キャラクターのスタイル選択ロジックを適用
            if (voiceInfo.character) {
                const character = voiceInfo.character;
                const availableStyles = Object.entries(character.available_styles || {})
                    .filter(([_, style]) => style.enabled)
                    .map(([styleId, style]) => ({ styleId, ...style }));
                if (availableStyles.length > 0) {
                    let selectedStyle;
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
                    styleId = selectedStyle?.style_id || 0;
                }
            }
        }
        else {
            // 従来の形式: 音声IDのみ
            voiceId = voiceInfo;
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
            outputSamplingRate: 24000
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
            console.error(`チャンク${chunk.index}合成完了: ${latency}ms, ${chunk.text.slice(0, 20)}...`);
            return {
                chunk,
                audioBuffer,
                latency
            };
        }
        catch (error) {
            throw new Error(`チャンク${chunk.index}合成エラー: ${error.message}`);
        }
    }
    // WAVヘッダーを除去してPCMデータを抽出
    extractPCMFromWAV(wavBuffer) {
        const view = new DataView(wavBuffer);
        // WAVヘッダーの検証とデータ位置の特定
        if (view.getUint32(0, false) !== 0x52494646) { // "RIFF"
            throw new Error('Invalid WAV file');
        }
        let dataOffset = 12; // RIFFヘッダー後
        while (dataOffset < wavBuffer.byteLength - 8) {
            const chunkType = view.getUint32(dataOffset, false);
            const chunkSize = view.getUint32(dataOffset + 4, true);
            if (chunkType === 0x64617461) { // "data"
                // データチャンクが見つかった
                const pcmData = wavBuffer.slice(dataOffset + 8, dataOffset + 8 + chunkSize);
                return new Uint8Array(pcmData);
            }
            dataOffset += 8 + chunkSize;
        }
        throw new Error('WAV data chunk not found');
    }
    async playAudioStream(audioResult) {
        try {
            // 一時ファイルに保存して即座に再生（低レイテンシ）
            const tempFile = `/tmp/stream_${Date.now()}_${audioResult.chunk.index}.wav`;
            const fs = await import('fs');
            await fs.promises.writeFile(tempFile, Buffer.from(audioResult.audioBuffer));
            // 非同期再生（レイテンシ重視）
            const playPromise = this.playAudioFile(tempFile);
            // ファイルクリーンアップを遅延実行
            playPromise.finally(() => {
                setTimeout(() => {
                    fs.promises.unlink(tempFile).catch(() => { });
                }, 1000);
            });
            return playPromise;
        }
        catch (error) {
            console.error(`音声再生エラー: ${error.message}`);
        }
    }
    async playAudioFile(audioFile) {
        try {
            const audioPlayer = this.detectAudioPlayerSync();
            await this.execCommand(audioPlayer, [audioFile]);
        }
        catch (error) {
            throw new Error(`音声再生エラー: ${error.message}`);
        }
    }
    detectAudioPlayerSync() {
        const players = ['afplay', 'aplay', 'paplay', 'play'];
        for (const player of players) {
            try {
                spawn('which', [player], { stdio: 'ignore' });
                return player;
            }
            catch {
                continue;
            }
        }
        return 'afplay'; // デフォルト（macOS）
    }
    applyCrossfade(pcmData, overlapSamples) {
        // 簡単なクロスフェード実装（音切れ軽減）
        // 副作用を避けるため、新しい配列を作成して返す
        const result = new Uint8Array(pcmData);
        if (overlapSamples > 0 && overlapSamples < pcmData.length / 2) {
            for (let i = 0; i < overlapSamples * 2; i += 2) {
                const factor = i / (overlapSamples * 2);
                const sample = (pcmData[i] | (pcmData[i + 1] << 8));
                const fadedSample = Math.floor(sample * factor);
                result[i] = fadedSample & 0xFF;
                result[i + 1] = (fadedSample >> 8) & 0xFF;
            }
        }
        return result;
    }
    convertRateToSpeed(rate) {
        const baseRate = 200;
        let speed = rate / baseRate;
        if (speed < 0.5)
            speed = 0.5;
        if (speed > 2.0)
            speed = 2.0;
        return speed;
    }
    async streamSynthesizeAndPlay(text, voiceId, speed) {
        const chunks = this.splitTextIntoChunks(text);
        console.error(`ストリーミング開始: ${chunks.length}チャンク, 文字数${text.length}`);
        const overallStartTime = Date.now();
        let totalLatency = 0;
        // 順次処理でシンプルに実装
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const result = await this.synthesizeChunk(chunk, voiceId, speed);
            await this.playAudioStream(result);
            totalLatency += result.latency;
        }
        const overallTime = Date.now() - overallStartTime;
        const avgLatency = totalLatency / chunks.length;
        console.error(`ストリーミング完了: 総時間${overallTime}ms, 平均レイテンシ${avgLatency.toFixed(1)}ms/チャンク`);
    }
    async listVoices() {
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
            speakers.forEach((speaker) => {
                console.log(`${speaker.speakerUuid}: ${speaker.speakerName}`);
                speaker.styles.forEach((style) => {
                    console.log(`  Style ${style.styleId}: ${style.styleName}`);
                });
            });
        }
        catch (error) {
            console.error(`Error: Cannot connect to COEIROINK server at http://${this.config.host}:${this.config.port}`);
            console.error('Make sure the server is running.');
            throw error;
        }
    }
    async saveAudio(audioBuffer, outputFile) {
        try {
            const fs = await import('fs');
            await fs.promises.writeFile(outputFile, Buffer.from(audioBuffer));
        }
        catch (error) {
            throw new Error(`音声ファイル保存エラー: ${error.message}`);
        }
    }
    async checkServerConnection() {
        const url = `http://${this.config.host}:${this.config.port}/v1/speakers`;
        try {
            const response = await fetch(url, {
                signal: AbortSignal.timeout(3000)
            });
            return response.ok;
        }
        catch (error) {
            return false;
        }
    }
    // 音声キューに追加（非同期処理用）
    enqueueSpeech(text, options = {}) {
        const speechTask = {
            id: Date.now() + Math.random(),
            text,
            options,
            timestamp: Date.now()
        };
        this.speechQueue.push(speechTask);
        this.processSpeechQueue();
        return {
            success: true,
            taskId: speechTask.id,
            queueLength: this.speechQueue.length
        };
    }
    // 音声キューの処理
    async processSpeechQueue() {
        if (this.isProcessing || this.speechQueue.length === 0) {
            return;
        }
        this.isProcessing = true;
        while (this.speechQueue.length > 0) {
            const task = this.speechQueue.shift();
            if (!task)
                break;
            try {
                await this.synthesizeTextInternal(task.text, task.options);
                console.error(`音声タスク完了: ${task.id}`);
            }
            catch (error) {
                console.error(`音声タスクエラー: ${task.id}, ${error.message}`);
            }
        }
        this.isProcessing = false;
    }
    // MCPサーバから呼び出される主要メソッド（即座に戻る）
    async synthesizeText(text, options = {}) {
        return this.enqueueSpeech(text, options);
    }
    // 内部用の実際の音声合成処理
    async synthesizeTextInternal(text, options = {}) {
        const { voice = null, rate = this.config.rate, outputFile = null, streamMode = false, style = null } = options;
        // 音声選択の優先順位処理
        let selectedVoice = voice;
        if (!selectedVoice) {
            // 1. operator-manager から現在のオペレータの音声を取得
            const operatorVoice = await this.getCurrentOperatorVoice();
            if (operatorVoice) {
                selectedVoice = operatorVoice;
            }
            else {
                // 2. フォールバック: デフォルト値なし（エラーとして扱う）
                throw new Error('音声が指定されておらず、オペレータも割り当てられていません');
            }
        }
        // スタイル明示的指定の処理
        if (style && typeof selectedVoice === 'object' && selectedVoice.character) {
            const character = selectedVoice.character;
            const specifiedStyle = Object.entries(character.available_styles || {})
                .find(([styleId, styleData]) => styleId === style && styleData.enabled);
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
            }
            else {
                console.warn(`指定されたスタイル '${style}' は利用できません。デフォルトスタイルを使用します。`);
            }
        }
        // サーバー接続確認
        if (!(await this.checkServerConnection())) {
            throw new Error(`Cannot connect to COEIROINK server (http://${this.config.host}:${this.config.port})`);
        }
        const speed = this.convertRateToSpeed(rate);
        if (outputFile) {
            // ファイル出力モード
            const chunks = [{
                    text,
                    index: 0,
                    isFirst: true,
                    isLast: true,
                    overlap: 0
                }];
            const result = await this.synthesizeChunk(chunks[0], selectedVoice, speed);
            await this.saveAudio(result.audioBuffer, outputFile);
            return { success: true, outputFile, latency: result.latency };
        }
        else if (streamMode || text.length > STREAM_CONFIG.chunkSizeChars) {
            // ストリーミング再生
            if (!(await this.initializeAudioPlayer())) {
                throw new Error('音声プレーヤーの初期化に失敗しました');
            }
            await this.streamSynthesizeAndPlay(text, selectedVoice, speed);
            return { success: true, mode: 'streaming' };
        }
        else {
            // 通常再生（短いテキスト）
            if (!(await this.initializeAudioPlayer())) {
                throw new Error('音声プレーヤーの初期化に失敗しました');
            }
            const chunks = [{
                    text,
                    index: 0,
                    isFirst: true,
                    isLast: true,
                    overlap: 0
                }];
            const result = await this.synthesizeChunk(chunks[0], selectedVoice, speed);
            await this.playAudioStream(result);
            return { success: true, mode: 'normal', latency: result.latency };
        }
    }
}
// デフォルトエクスポート
export default SayCoeiroink;
//# sourceMappingURL=index.js.map