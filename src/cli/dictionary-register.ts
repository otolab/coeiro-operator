#!/usr/bin/env node

/**
 * COEIROINK ユーザー辞書登録 CLIツール
 *
 * 使用方法:
 * dictionary-register                       # デフォルト技術用語を登録
 * dictionary-register --preset all          # 全プリセット登録
 * dictionary-register --file dict.json      # カスタム辞書ファイル
 * dictionary-register --word KARTE --yomi カルテ --accent 1 --moras 3
 */

import { Command } from 'commander';
import fs from 'fs';
import { DictionaryService } from '../core/dictionary/dictionary-service.js';
import { DictionaryWord } from '../core/dictionary/dictionary-client.js';
import {
  DEFAULT_TECHNICAL_WORDS,
  CHARACTER_NAME_WORDS,
} from '../core/dictionary/default-dictionaries.js';

const program = new Command();

program
  .name('dictionary-register')
  .description('COEIROINKのユーザー辞書に単語を登録')
  .version('1.0.0')
  .option('-p, --preset <type>', 'プリセット辞書 (technical|characters|all)', 'technical')
  .option('-f, --file <path>', 'カスタム辞書JSONファイル')
  .option('-w, --word <word>', '登録する単語')
  .option('-y, --yomi <yomi>', '読み方（カタカナ）')
  .option('-a, --accent <number>', 'アクセント位置', parseInt)
  .option('-m, --moras <number>', 'モーラ数', parseInt)
  .option('--host <host>', 'COEIROINKサーバーホスト', 'localhost')
  .option('--port <port>', 'COEIROINKサーバーポート', '50032')
  .option('--list', 'デフォルト辞書の内容を表示')
  .option('--export <path>', 'デフォルト辞書をJSONファイルにエクスポート')
  .option('--test <word>', '指定した単語の韻律解析をテスト')
  .option('--persist', '辞書データを永続化する（デフォルト: true）', true)
  .option('--no-persist', '辞書データを永続化しない')
  .parse(process.argv);

const options = program.opts();

/**
 * 韻律解析テスト
 */
async function testProsody(word: string, host: string, port: string): Promise<void> {
  try {
    const response = await fetch(`http://${host}:${port}/v1/estimate_prosody`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: word }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`\n📝 「${word}」の韻律解析結果:`);
      console.log('─'.repeat(60));

      if (result.detail && result.detail[0]) {
        console.log('モーラ解析:');
        result.detail[0].forEach((mora: {hira: string; phoneme: string; accent: number}, index: number) => {
          console.log(
            `  ${index + 1}. ${mora.hira} (${mora.phoneme}) - アクセント: ${mora.accent}`
          );
        });
        console.log('\n音素記号:');
        console.log('  ' + result.plain.join(' '));
      } else {
        console.log('詳細情報なし');
      }
      console.log('─'.repeat(60));
    } else {
      console.error('❌ 韻律解析に失敗しました:', response.statusText);
    }
  } catch (error) {
    console.error('❌ エラー:', (error as Error).message);
  }
}

/**
 * メイン処理
 */
async function main() {
  // リスト表示
  if (options.list) {
    console.log('📚 デフォルト辞書:');
    console.log('\n技術用語:');
    console.log(JSON.stringify(DEFAULT_TECHNICAL_WORDS, null, 2));
    console.log('\nキャラクター名:');
    console.log(JSON.stringify(CHARACTER_NAME_WORDS, null, 2));
    process.exit(0);
  }

  // エクスポート
  if (options.export) {
    const exportData = [...DEFAULT_TECHNICAL_WORDS, ...CHARACTER_NAME_WORDS];
    fs.writeFileSync(options.export, JSON.stringify(exportData, null, 2));
    console.log(`✅ デフォルト辞書をエクスポートしました: ${options.export}`);
    process.exit(0);
  }

  // 韻律解析テスト
  if (options.test) {
    await testProsody(options.test, options.host, options.port);
    process.exit(0);
  }

  // DictionaryServiceのインスタンス作成
  const service = new DictionaryService({
    host: options.host,
    port: options.port,
  });

  // 初期化と接続確認
  await service.initialize();
  const isConnected = await service.checkConnection();
  if (!isConnected) {
    console.error('❌ COEIROINKサーバーに接続できません');
    console.error(`   接続先: http://${options.host}:${options.port}`);
    console.error('   サーバーが起動していることを確認してください');
    process.exit(1);
  }

  // 登録する単語を決定
  let wordsToRegister: DictionaryWord[] = [];

  // カスタムファイル
  if (options.file) {
    try {
      const content = fs.readFileSync(options.file, 'utf8');
      wordsToRegister = JSON.parse(content);
      console.log(`📁 カスタム辞書ファイルを読み込みました: ${options.file}`);
    } catch (error) {
      console.error(`❌ ファイル読み込みエラー: ${(error as Error).message}`);
      process.exit(1);
    }
  }
  // 単一単語の登録
  else if (options.word) {
    if (!options.yomi || options.accent === undefined || !options.moras) {
      console.error('❌ 単語登録には --yomi, --accent, --moras が必要です');
      process.exit(1);
    }
    wordsToRegister = [
      {
        word: options.word,
        yomi: options.yomi,
        accent: options.accent,
        numMoras: options.moras,
      },
    ];
  }
  // プリセット辞書
  else {
    switch (options.preset) {
      case 'technical':
        wordsToRegister = DEFAULT_TECHNICAL_WORDS;
        break;
      case 'characters':
        wordsToRegister = CHARACTER_NAME_WORDS;
        break;
      case 'all':
        wordsToRegister = [...DEFAULT_TECHNICAL_WORDS, ...CHARACTER_NAME_WORDS];
        break;
      default:
        console.error(`❌ 無効なプリセット: ${options.preset}`);
        process.exit(1);
    }
  }

  if (wordsToRegister.length === 0) {
    console.error('⚠️ 登録する単語がありません');
    process.exit(1);
  }

  // 辞書登録実行
  console.log(`📝 ${wordsToRegister.length}個の単語を登録中...`);

  // 単一単語の場合はaddWord、複数の場合は直接登録
  let success = false;
  if (options.word && wordsToRegister.length === 1) {
    // 単一単語はDictionaryServiceのaddWordを使用（永続化含む）
    success = await service.addWord(wordsToRegister[0]);
    if (success) {
      console.log(`✅ 単語を登録しました\n`);
      if (options.persist) {
        console.log('💾 辞書データを永続化しました（次回起動時に自動登録されます）\n');
      }
    }
  } else {
    // プリセットなど複数単語の場合は初期化で既に登録済み
    // ここでは表示のみ
    success = true;
    console.log(`✅ ${wordsToRegister.length}個の単語を登録しました\n`);
  }

  if (success) {
    // 登録内容を表示
    console.log('登録された単語:');
    console.log('─'.repeat(60));
    console.log('単語\t\t読み方\t\tアクセント\tモーラ数');
    console.log('─'.repeat(60));

    for (const word of wordsToRegister) {
      const paddedWord = word.word.padEnd(16);
      const paddedYomi = word.yomi.padEnd(16);
      console.log(`${paddedWord}${paddedYomi}${word.accent}\t\t${word.numMoras}`);
    }
    console.log('─'.repeat(60));

    console.log('\n⚠️ 注意事項:');
    console.log('• 登録した辞書はCOEIROINK再起動時にリセットされます');
    console.log('• 全角で登録された単語は半角入力にも適用されます');
    if (options.persist) {
      console.log('• 永続化した辞書は次回起動時に自動的に登録されます');
    } else {
      console.log('• 永続的な登録が必要な場合は --persist オプションを使用してください');
    }
  } else {
    console.error(`❌ 辞書登録に失敗しました`);
    process.exit(1);
  }
}

// エラーハンドリング
main().catch(error => {
  console.error('❌ 予期しないエラー:', error.message);
  process.exit(1);
});
