#!/usr/bin/env node

/**
 * src/say/cli.ts: say-coeiroinkコマンドラインインターフェース
 * macOS sayコマンド互換のCLIツール
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { SayCoeiroink, loadConfig } from './index.js';

interface ParsedOptions {
    voice: string;
    rate: number;
    inputFile: string;
    outputFile: string;
    streamMode: boolean;
    text: string;
    chunkMode: 'auto' | 'none' | 'small' | 'medium' | 'large';
    bufferSize: number;
}

class SayCoeiroinkCLI {
    private sayCoeiroink: SayCoeiroink;

    constructor(sayCoeiroink: SayCoeiroink) {
        this.sayCoeiroink = sayCoeiroink;
    }

    async showUsage(): Promise<void> {
        console.log(`Usage: say-coeiroink [-v voice] [-r rate] [-o outfile] [-f file | text] [-s] [--chunk-mode mode] [--buffer-size size]

低レイテンシストリーミング音声合成・再生（macOS sayコマンド互換）

Options:
    -v voice           Specify voice (voice ID or name, use '?' to list available voices)
    -r rate            Speech rate in words per minute (default: ${(this.sayCoeiroink as any).config.rate})
    -o outfile         Write audio to file instead of playing (WAV format)
    -f file            Read text from file (use '-' for stdin)
    -s                 Force stream mode (auto-enabled for long text)
    --chunk-mode mode  Text splitting mode: auto|none|small|medium|large (default: auto)
    --buffer-size size Audio buffer size in bytes: 256-8192 (default: 1024)
    -h                 Show this help

Chunk Modes:
    none    No text splitting (best for long text, natural speech)
    small   30 chars (low latency, interactive use)
    medium  50 chars (balanced, default for auto)
    large   100 chars (stability focused)
    auto    Automatic selection based on text length

Buffer Sizes:
    256     Lowest latency, higher CPU usage
    512     Low latency, moderate CPU usage
    1024    Balanced (default)
    2048    Higher stability, lower CPU usage
    4096+   Maximum stability, background use

Features:
    - ネイティブ音声出力（speakerライブラリ）
    - カスタマイズ可能な分割制御
    - バッファサイズ制御
    - 真のストリーミング再生
    - macOS sayコマンド互換

Examples:
    say-coeiroink "短いテキスト"
    say-coeiroink -v "?" # 音声リスト表示
    say-coeiroink -o output.wav "ファイル保存"
    say-coeiroink --chunk-mode none "長文を分割せずにスムーズに読み上げ"
    say-coeiroink --chunk-mode small --buffer-size 256 "低レイテンシ再生"
    say-coeiroink --buffer-size 2048 "高品質・安定再生"
    echo "テキスト" | say-coeiroink -f -`);
    }

    private async parseArguments(args: string[]): Promise<ParsedOptions> {
        const options: ParsedOptions = {
            voice: process.env.COEIROINK_VOICE || '',
            rate: (this.sayCoeiroink as any).config.rate,
            inputFile: '',
            outputFile: '',
            streamMode: false,
            text: '',
            chunkMode: 'auto',
            bufferSize: 1024
        };

        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '-h':
                case '--help':
                    await this.showUsage();
                    throw new Error('HELP_REQUESTED');
                    
                case '-v':
                    if (args[i + 1] === '?') {
                        await this.sayCoeiroink.listVoices();
                        throw new Error('VOICE_LIST_REQUESTED');
                    }
                    options.voice = args[i + 1];
                    i++;
                    break;
                
                case '-r':
                case '--rate':
                    options.rate = parseInt(args[i + 1]);
                    i++;
                    break;
                
                case '-o':
                case '--output-file':
                    options.outputFile = args[i + 1];
                    i++;
                    break;
                
                case '-f':
                case '--input-file':
                    options.inputFile = args[i + 1];
                    i++;
                    break;
                
                case '-s':
                case '--stream':
                    options.streamMode = true;
                    break;
                
                case '--chunk-mode':
                    const chunkMode = args[i + 1];
                    if (!['auto', 'none', 'small', 'medium', 'large'].includes(chunkMode)) {
                        throw new Error(`Invalid chunk mode: ${chunkMode}. Must be one of: auto, none, small, medium, large`);
                    }
                    options.chunkMode = chunkMode as 'auto' | 'none' | 'small' | 'medium' | 'large';
                    i++;
                    break;
                
                case '--buffer-size':
                    const bufferSize = parseInt(args[i + 1]);
                    if (isNaN(bufferSize) || bufferSize < 256 || bufferSize > 8192) {
                        throw new Error(`Invalid buffer size: ${args[i + 1]}. Must be a number between 256 and 8192`);
                    }
                    options.bufferSize = bufferSize;
                    i++;
                    break;
                
                default:
                    if (arg.startsWith('-')) {
                        throw new Error(`Unknown option ${arg}`);
                    } else {
                        options.text = options.text ? `${options.text} ${arg}` : arg;
                    }
                    break;
            }
        }

        return options;
    }

    private async getInputText(options: ParsedOptions): Promise<string> {
        let text = options.text;

        if (options.inputFile) {
            if (options.inputFile === '-') {
                const chunks: Buffer[] = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk as Buffer);
                }
                text = Buffer.concat(chunks).toString('utf8').trim();
            } else {
                try {
                    await access(options.inputFile, constants.F_OK);
                    text = (await readFile(options.inputFile, 'utf8')).trim();
                } catch {
                    throw new Error(`File '${options.inputFile}' not found`);
                }
            }
        } else if (!text) {
            const chunks: Buffer[] = [];
            for await (const chunk of process.stdin) {
                chunks.push(chunk as Buffer);
            }
            text = Buffer.concat(chunks).toString('utf8').trim();
        }

        if (!text) {
            throw new Error('No text to speak');
        }

        return text;
    }

    async run(args: string[]): Promise<void> {
        const options = await this.parseArguments(args);
        const text = await this.getInputText(options);

        const result = await this.sayCoeiroink.synthesizeText(text, {
            voice: options.voice || null,
            rate: options.rate,
            outputFile: options.outputFile || null,
            streamMode: options.streamMode,
            chunkMode: options.chunkMode,
            bufferSize: options.bufferSize
        });

        if (options.outputFile) {
            console.error(`Audio saved to: ${options.outputFile}`);
        }
    }
}

// プロセス終了ハンドリング
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
});

// メイン実行関数
async function main(): Promise<void> {
    const config = await loadConfig();
    const sayCoeiroink = new SayCoeiroink(config);
    
    await sayCoeiroink.initialize();
    await sayCoeiroink.buildDynamicConfig();
    
    const cli = new SayCoeiroinkCLI(sayCoeiroink);
    await cli.run(process.argv.slice(2));
}

// メイン実行
main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        // 特別なエラーメッセージは正常終了扱い
        if ((error as Error).message === 'HELP_REQUESTED' || 
            (error as Error).message === 'VOICE_LIST_REQUESTED') {
            process.exit(0);
        } else {
            console.error(`Error: ${(error as Error).message}`);
            process.exit(1);
        }
    });

export default SayCoeiroinkCLI;
