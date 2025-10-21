#!/usr/bin/env node --no-deprecation

/**
 * src/say/cli.ts: say-coeiroinkコマンドラインインターフェース
 * macOS sayコマンド互換のCLIツール
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { SayCoeiroink } from '@coeiro-operator/audio';
import { ConfigManager, getConfigDir } from '@coeiro-operator/core';
import { LoggerPresets } from '@coeiro-operator/common';
import type { Config } from '@coeiro-operator/audio';
import { BUFFER_SIZES } from '@coeiro-operator/audio';

interface ParsedOptions {
  voice: string;
  rate: number | string | undefined;  // 数値（WPM）、文字列（"150%"）、または未指定
  inputFile: string;
  outputFile: string;
  text: string;
  style?: string;
  chunkMode: 'none' | 'small' | 'medium' | 'large' | 'punctuation';
  bufferSize: number;
}

class SayCoeiroinkCLI {
  private sayCoeiroink: SayCoeiroink;
  private config: Config;

  constructor(sayCoeiroink: SayCoeiroink, config: Config) {
    this.sayCoeiroink = sayCoeiroink;
    this.config = config;
  }

  async showUsage(): Promise<void> {
    const defaultRate = this.config?.operator?.rate ? `${this.config.operator.rate} WPM` : '話者固有速度';
    console.log(`Usage: say-coeiroink [-v voice] [-r rate] [-o outfile] [-f file | text] [--style style] [--chunk-mode mode] [--buffer-size size]

低レイテンシストリーミング音声合成・再生（macOS sayコマンド互換）

Options:
    -v voice           Specify voice (voice ID or name, use '?' to list available voices)
    -r rate            Speech rate: number (WPM) or percentage (e.g., 150%) (default: ${defaultRate})
                       - 数値: 絶対速度（200 = 標準話速）
                       - %付き: 話者速度の相対倍率（150% = 1.5倍速）
                       - 未指定: 話者固有の自然な速度
    -o outfile         Write audio to file instead of playing (WAV format)
    -f file            Read text from file (use '-' for stdin)
    --style style      Specify voice style (e.g., 'のーまる', 'セクシー')
    --chunk-mode mode  Text splitting mode: punctuation|none|small|medium|large (default: punctuation)
    --buffer-size size Audio buffer size in bytes: ${BUFFER_SIZES.MIN}-${BUFFER_SIZES.MAX} (default: ${BUFFER_SIZES.DEFAULT})
    -h                 Show this help

Chunk Modes:
    none    No text splitting (best for long text, natural speech)
    small   30 chars (low latency, interactive use)
    medium  50 chars (balanced)
    large   100 chars (stability focused)
    punctuation  Sentence-based splitting (default, natural Japanese)

Buffer Sizes:
    256     Lowest latency, higher CPU usage
    512     Low latency, moderate CPU usage
    1024    Balanced
    2048    Higher stability (default)
    4096+   Maximum stability, background use

Features:
    - ネイティブ音声出力（speakerライブラリ）
    - カスタマイズ可能な分割制御
    - バッファサイズ制御
    - 真のストリーミング再生
    - macOS sayコマンド互換

Examples:
    say-coeiroink "短いテキスト"                          # 話者固有速度
    say-coeiroink -r 150% "少し速く読み上げ"              # 話者速度の1.5倍
    say-coeiroink -r 200 "標準速度で読み上げ"             # 200 WPM（絶対速度）
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
      rate: this.config?.operator?.rate,  // undefined = 話者固有速度
      inputFile: '',
      outputFile: '',
      text: '',
      chunkMode: 'punctuation',
      bufferSize: BUFFER_SIZES.DEFAULT,
    };

    // args が undefined や null の場合はデフォルト値を返す
    if (!args || !Array.isArray(args)) {
      return options;
    }

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
        case '--rate': {
          const rateValue = args[i + 1];
          // %で終わる場合は文字列として保持、そうでなければ数値に変換
          if (rateValue.endsWith('%')) {
            options.rate = rateValue;  // "150%" のような文字列
          } else {
            const parsed = parseInt(rateValue);
            if (isNaN(parsed)) {
              throw new Error(`Invalid rate value: ${rateValue}. Must be a number (WPM) or percentage (e.g., 150%)`);
            }
            options.rate = parsed;
          }
          i++;
          break;
        }

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

        case '--style':
          options.style = args[i + 1];
          i++;
          break;

        case '--chunk-mode': {
          const chunkMode = args[i + 1];
          if (!['none', 'small', 'medium', 'large', 'punctuation'].includes(chunkMode)) {
            throw new Error(
              `Invalid chunk mode: ${chunkMode}. Must be one of: none, small, medium, large, punctuation`
            );
          }
          options.chunkMode = chunkMode as 'none' | 'small' | 'medium' | 'large' | 'punctuation';
          i++;
          break;
        }

        case '--buffer-size': {
          const bufferSize = parseInt(args[i + 1]);
          if (isNaN(bufferSize) || bufferSize < BUFFER_SIZES.MIN || bufferSize > BUFFER_SIZES.MAX) {
            throw new Error(
              `Invalid buffer size: ${args[i + 1]}. Must be a number between ${BUFFER_SIZES.MIN} and ${BUFFER_SIZES.MAX}`
            );
          }
          options.bufferSize = bufferSize;
          i++;
          break;
        }

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

    // ファイル出力の場合はウォームアップ不要
    if (!options.outputFile) {
      // オーディオドライバーのウォームアップ
      await this.sayCoeiroink.warmup();
    }

    // rate文字列をパースして適切な形式に変換
    let speedOptions: { rate?: number; factor?: number } = {};
    if (options.rate !== undefined) {
      if (typeof options.rate === 'string' && options.rate.endsWith('%')) {
        // パーセント指定 → factor
        const percent = parseFloat(options.rate.slice(0, -1));
        if (!isNaN(percent)) {
          speedOptions.factor = percent / 100;
        }
      } else {
        // 数値指定 → rate（WPM）
        const rateNum = typeof options.rate === 'number' ? options.rate : parseFloat(options.rate);
        if (!isNaN(rateNum)) {
          speedOptions.rate = rateNum;
        }
      }
    }

    // 音声合成タスクをキューに追加
    this.sayCoeiroink.synthesize(text, {
      voice: options.voice || null,
      ...speedOptions,  // rateまたはfactorを展開
      outputFile: options.outputFile || null,
      style: options.style || undefined,
      chunkMode: options.chunkMode,
      bufferSize: options.bufferSize,
    });

    if (options.outputFile) {
      console.error(`Audio saved to: ${options.outputFile}`);
    }

    // すべてのタスクの完了を待つ
    await this.sayCoeiroink.waitCompletion();
  }
}

// プロセス終了ハンドリング（テスト環境では無効化）
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', error => {
    console.error('Uncaught Exception:', error.message);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

// メイン実行関数
async function main(): Promise<void> {
  // デバッグモード判定
  const isDebugMode = process.argv.includes('--debug');

  // CLIモードでは通常ログレベル（info）を使用、デバッグモードではdebugレベル
  if (isDebugMode) {
    LoggerPresets.debug();
  } else {
    LoggerPresets.cli();
  }

  const configDir = await getConfigDir();
  const configManager = new ConfigManager(configDir);
  await configManager.buildDynamicConfig();
  
  const sayCoeiroink = new SayCoeiroink(configManager);
  await sayCoeiroink.initialize();
  await sayCoeiroink.buildDynamicConfig();

  const config = await configManager.getFullConfig();
  const cli = new SayCoeiroinkCLI(sayCoeiroink, config);
  await cli.run(process.argv.slice(2));
}

// メイン実行（テスト環境では実行しない）
if (process.env.NODE_ENV !== 'test') {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      // 特別なエラーメッセージは正常終了扱い
      if (
        (error as Error).message === 'HELP_REQUESTED' ||
        (error as Error).message === 'VOICE_LIST_REQUESTED'
      ) {
        process.exit(0);
      } else {
        console.error(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}

export default SayCoeiroinkCLI;
