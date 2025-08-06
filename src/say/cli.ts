#!/usr/bin/env node

/**
 * src/say/cli.ts: say-coeiroinkコマンドラインインターフェース
 * macOS sayコマンド互換のCLIツール
 */

import { readFileSync, existsSync } from 'fs';
import { SayCoeiroink, loadConfig } from './index.js';

class SayCoeiroinkCLI {
    private sayCoeiroink: SayCoeiroink;

    constructor(sayCoeiroink: SayCoeiroink) {
        this.sayCoeiroink = sayCoeiroink;
    }

    async showUsage(): Promise<void> {
        console.log(`Usage: say-coeiroink [-v voice] [-r rate] [-o outfile] [-f file | text] [-s]

低レイテンシストリーミング音声合成・再生（macOS sayコマンド互換）

Options:
    -v voice    Specify voice (voice ID or name, use '?' to list available voices)
    -r rate     Speech rate in words per minute (default: ${(this.sayCoeiroink as any).config.rate})
    -o outfile  Write audio to file instead of playing (WAV format)
    -f file     Read text from file (use '-' for stdin)
    -s          Force stream mode (auto-enabled for long text)
    -h          Show this help

Features:
    - 低レイテンシ並列合成（バッファサイズ: 3）
    - 音切れ防止オーバーラップ処理
    - リアルタイム音声出力（バッファ: 100ms）
    - macOS sayコマンド互換

Examples:
    say-coeiroink "短いテキスト"
    say-coeiroink -v "?" # 音声リスト表示
    say-coeiroink -o output.wav "ファイル保存"
    say-coeiroink -s "長いテキストをストリーミング再生"
    echo "テキスト" | say-coeiroink -f -`);
    }

    async run(args: string[]): Promise<void> {
        let voice = process.env.COEIROINK_VOICE || '';
        let rate = (this.sayCoeiroink as any).config.rate;
        let text = '';
        let inputFile = '';
        let outputFile = '';
        let streamMode = false;

        // 引数解析
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            
            switch (arg) {
                case '-h':
                case '--help':
                    await this.showUsage();
                    process.exit(0);
                    break;
                
                case '-v':
                    if (args[i + 1] === '?') {
                        await this.sayCoeiroink.listVoices();
                        process.exit(0);
                    }
                    voice = args[i + 1];
                    i++;
                    break;
                
                case '-r':
                case '--rate':
                    rate = parseInt(args[i + 1]);
                    i++;
                    break;
                
                case '-o':
                case '--output-file':
                    outputFile = args[i + 1];
                    i++;
                    break;
                
                case '-f':
                case '--input-file':
                    inputFile = args[i + 1];
                    i++;
                    break;
                
                case '-s':
                case '--stream':
                    streamMode = true;
                    break;
                
                default:
                    if (arg.startsWith('-')) {
                        console.error(`Error: Unknown option ${arg}`);
                        process.exit(1);
                    } else {
                        text = text ? `${text} ${arg}` : arg;
                    }
                    break;
            }
        }

        // テキスト入力処理
        if (inputFile) {
            if (inputFile === '-') {
                const chunks: Buffer[] = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk as Buffer);
                }
                text = Buffer.concat(chunks).toString('utf8').trim();
            } else {
                if (!existsSync(inputFile)) {
                    console.error(`Error: File '${inputFile}' not found`);
                    process.exit(1);
                }
                text = readFileSync(inputFile, 'utf8').trim();
            }
        } else if (!text) {
            const chunks: Buffer[] = [];
            for await (const chunk of process.stdin) {
                chunks.push(chunk as Buffer);
            }
            text = Buffer.concat(chunks).toString('utf8').trim();
        }

        if (!text) {
            console.error('Error: No text to speak');
            process.exit(1);
        }

        try {
            const result = await this.sayCoeiroink.synthesizeText(text, {
                voice: voice || null,
                rate,
                outputFile: outputFile || null,
                streamMode
            });

            if (outputFile) {
                console.error(`Audio saved to: ${outputFile}`);
            }

            process.exit(0);
        } catch (error) {
            console.error(`Error: ${(error as Error).message}`);
            process.exit(1);
        }
    }
}

// メイン実行（top-level await）
if (import.meta.url === `file://${process.argv[1]}`) {
    try {
        const config = await loadConfig();
        const sayCoeiroink = new SayCoeiroink(config);
        const cli = new SayCoeiroinkCLI(sayCoeiroink);
        await cli.run(process.argv.slice(2));
    } catch (error) {
        console.error(`Fatal error: ${(error as Error).message}`);
        process.exit(1);
    }
}

export default SayCoeiroinkCLI;
