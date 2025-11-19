#!/usr/bin/env node --no-deprecation

/**
 * src/say/cli.ts: say-coeiroinkコマンドラインインターフェース
 * macOS sayコマンド互換のCLIツール
 */

import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import { Command } from 'commander';
import { SayCoeiroink } from '@coeiro-operator/audio';
import { ConfigManager, getConfigDir } from '@coeiro-operator/core';
import { LoggerPresets, logger } from '@coeiro-operator/common';
import type { Config } from '@coeiro-operator/audio';
import { BUFFER_SIZES } from '@coeiro-operator/audio';

interface ParsedOptions {
  voice?: string;
  rate?: string;  // 数値（WPM）または文字列（"150%"）
  inputFile?: string;
  outputFile?: string;
  style?: string;
  chunkMode: string;
  bufferSize: string;
  debug?: boolean;
}

class SayCoeiroinkCLI {
  private sayCoeiroink: SayCoeiroink;
  private config: Config;
  private program: Command;

  constructor(sayCoeiroink: SayCoeiroink, config: Config) {
    this.sayCoeiroink = sayCoeiroink;
    this.config = config;
    this.program = new Command();
    this.setupCommander();
  }

  private setupCommander(): void {
    const defaultRate = this.config?.audio?.defaultRate ? `${this.config.audio.defaultRate} WPM` : '話者固有速度';

    this.program
      .name('say-coeiroink')
      .description('低レイテンシストリーミング音声合成・再生（macOS sayコマンド互換）')
      .version('1.0.0', '-V, --version')
      .argument('[text...]', 'Text to speak')
      .option('-v, --voice <voice>', 'Specify voice (voice ID or name, use "?" to list available voices)',
        process.env.COEIROINK_VOICE || '')
      .option('-r, --rate <rate>',
        `Speech rate: number (WPM) or percentage (e.g., 150%) (default: ${defaultRate})\n` +
        '                       - 数値: 絶対速度（200 = 標準話速）\n' +
        '                       - %付き: 話者速度の相対倍率（150% = 1.5倍速）\n' +
        '                       - 未指定: 話者固有の自然な速度')
      .option('-o, --output-file <file>', 'Write audio to file instead of playing (WAV format)')
      .option('-f, --input-file <file>', 'Read text from file (use "-" for stdin)')
      .option('--style <style>', 'Specify voice style (e.g., "のーまる", "セクシー")')
      .option('--chunk-mode <mode>',
        'Text splitting mode: punctuation|none|small|medium|large',
        'punctuation')
      .option('--buffer-size <size>',
        `Audio buffer size in bytes: ${BUFFER_SIZES.MIN}-${BUFFER_SIZES.MAX}`,
        BUFFER_SIZES.DEFAULT.toString())
      .option('--debug', 'Enable debug logging')
      .addHelpText('after', `
Chunk Modes:
    none         No text splitting (best for long text, natural speech)
    small        30 chars (low latency, interactive use)
    medium       50 chars (balanced)
    large        100 chars (stability focused)
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
    echo "テキスト" | say-coeiroink -f -`)
      .action(async (textArgs, options) => {
        await this.handleCommand(textArgs, options);
      });
  }

  private async handleCommand(textArgs: string[], options: ParsedOptions): Promise<void> {
    // 音声リスト表示の特別処理
    if (options.voice === '?') {
      await this.sayCoeiroink.listVoices();
      return;
    }

    // テキストの取得
    const text = await this.getInputText(textArgs, options);

    // バッファサイズのバリデーション
    const bufferSize = parseInt(options.bufferSize);
    if (isNaN(bufferSize) || bufferSize < BUFFER_SIZES.MIN || bufferSize > BUFFER_SIZES.MAX) {
      throw new Error(
        `Invalid buffer size: ${options.bufferSize}. Must be a number between ${BUFFER_SIZES.MIN} and ${BUFFER_SIZES.MAX}`
      );
    }

    // チャンクモードのバリデーション
    const validChunkModes = ['none', 'small', 'medium', 'large', 'punctuation'];
    if (!validChunkModes.includes(options.chunkMode)) {
      throw new Error(
        `Invalid chunk mode: ${options.chunkMode}. Must be one of: ${validChunkModes.join(', ')}`
      );
    }

    // ファイル出力の場合はウォームアップ不要
    if (!options.outputFile) {
      // オーディオドライバーのウォームアップ
      await this.sayCoeiroink.warmup();
    }

    // rate文字列をパースして適切な形式に変換
    let speedOptions: { rate?: number; factor?: number } = {};
    if (options.rate !== undefined && options.rate !== '') {
      if (options.rate.endsWith('%')) {
        // パーセント指定 → factor
        const percent = parseFloat(options.rate.slice(0, -1));
        if (!isNaN(percent)) {
          speedOptions.factor = percent / 100;
        }
      } else {
        // 数値指定 → rate（WPM）
        const rateNum = parseFloat(options.rate);
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
      chunkMode: options.chunkMode as 'none' | 'small' | 'medium' | 'large' | 'punctuation',
      bufferSize,
    });

    if (options.outputFile) {
      logger.error(`Audio saved to: ${options.outputFile}`);
    }

    // すべてのタスクの完了を待つ
    await this.sayCoeiroink.waitCompletion();
  }

  private async getInputText(textArgs: string[], options: ParsedOptions): Promise<string> {
    let text = '';

    if (options.inputFile) {
      if (options.inputFile === '-') {
        // stdinから読み込み
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(chunk as Buffer);
        }
        text = Buffer.concat(chunks).toString('utf8').trim();
      } else {
        // ファイルから読み込み
        try {
          await access(options.inputFile, constants.F_OK);
          text = (await readFile(options.inputFile, 'utf8')).trim();
        } catch {
          throw new Error(`File '${options.inputFile}' not found`);
        }
      }
    } else if (textArgs && textArgs.length > 0) {
      // コマンドライン引数からテキストを結合
      text = textArgs.join(' ');
    } else {
      // 引数がない場合はstdinから読み込み
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
    await this.program.parseAsync(args, { from: 'node' });
  }
}

// プロセス終了ハンドリング（テスト環境では無効化）
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error.message);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
  });
}

// メイン実行関数
async function main(): Promise<void> {
  // デバッグモード判定（commander解析前に簡易チェック）
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
  await cli.run(process.argv);
}

// メイン実行（テスト環境では実行しない）
if (process.env.NODE_ENV !== 'test') {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    });
}

export default SayCoeiroinkCLI;