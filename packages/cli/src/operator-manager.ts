#!/usr/bin/env node --no-deprecation

/**
 * src/operator/cli.ts: オペレータ管理CLI
 * operator-managerスクリプトのJavaScript版
 */

import { OperatorManager, ConfigManager, CharacterInfoService, TerminalBackground, getConfigDir } from '@coeiro-operator/core';
import { logger } from '@coeiro-operator/common';

interface AssignResult {
  characterId: string; // キャラクターID（例: 'tsukuyomi'）
  characterName: string;
  currentStyle?: {
    styleId: string;
    styleName: string;
    personality: string;
    speakingStyle: string;
  };
  greeting?: string;
}

interface ReleaseResult {
  characterId?: string;
  characterName?: string;
  farewell?: string;
  wasAssigned: boolean;
}

interface StatusResult {
  characterId?: string; // キャラクターID
  message: string;
}

interface ParsedArgs {
  characterId: string | null; // キャラクターID
  style: string | null;
}

class OperatorManagerCLI {
  private manager: OperatorManager | null = null;
  private terminalBackground: TerminalBackground | null = null;
  private configManager: ConfigManager | null = null;

  constructor() {
    // OperatorManagerはrun()で初期化
  }

  private parseAssignArgs(args: string[]): ParsedArgs {
    let characterId: string | null = null;
    let style: string | null = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith('--style=')) {
        style = arg.substring(8);
      } else if (!arg.startsWith('--')) {
        characterId = arg;
      }
    }

    return { characterId, style };
  }

  private async executeAssignment(characterId: string | null, style: string | null): Promise<void> {
    if (characterId) {
      const result: AssignResult = await this.manager!.assignSpecificOperator(characterId, style);
      logger.info(`オペレータ決定: ${result.characterName} (${result.characterId})`);
      if (result.currentStyle) {
        logger.info(
          `スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`
        );
      }
      // 背景画像を切り替え
      if (this.terminalBackground && await this.terminalBackground.isEnabled()) {
        await this.terminalBackground.switchCharacter(result.characterId);
      }
    } else {
      const currentStatus: StatusResult = await this.manager!.showCurrentOperator();
      if (currentStatus.characterId) {
        logger.info(currentStatus.message);
      } else {
        const result: AssignResult = await this.manager!.assignRandomOperator(style);
        logger.info(`オペレータ決定: ${result.characterName} (${result.characterId})`);
        if (result.currentStyle) {
          logger.info(
            `スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`
          );
        }
        // 背景画像を切り替え
        if (this.terminalBackground && await this.terminalBackground.isEnabled()) {
          await this.terminalBackground.switchCharacter(result.characterId);
        }
      }
    }
  }

  async showUsage(): Promise<void> {
    logger.info(`使用法: operator-manager <command> [options]

オペレータ管理:
  assign [オペレータID] [--style=スタイル名] - オペレータを割り当て（IDを指定しない場合はランダム）
  release                                    - 現在のオペレータを返却
  status                                     - 現在のオペレータを表示
  available                                  - 利用可能なオペレータを表示
  clear                                      - 全てのオペレータ利用状況をクリア

キャラクター登録・測定:
  list-unmeasured [--json]                   - 未計測のSpeaker/Styleを表示
  add-character <characterId> <speakerName>  - キャラクターを新規登録
  measure <characterId> [--style=スタイル名] [--dry-run] - 話速を測定して設定を更新`);
  }

  async run(args: string[]): Promise<void> {
    // ConfigManagerとCharacterInfoServiceを初期化
    const configDir = await getConfigDir();
    this.configManager = new ConfigManager(configDir);
    await this.configManager.buildDynamicConfig();

    const characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(this.configManager);

    // OperatorManagerを初期化（DI）
    this.manager = new OperatorManager(this.configManager, characterInfoService);
    await this.manager.initialize();

    // TerminalBackgroundを初期化
    this.terminalBackground = new TerminalBackground(this.configManager);

    const command = args[0];

    try {
      switch (command) {
        case 'assign':
          await this.handleAssign(args.slice(1));
          break;

        case 'release':
          await this.handleRelease();
          break;

        case 'status':
          await this.handleStatus();
          break;

        case 'available':
          await this.handleAvailable();
          break;

        case 'clear':
          await this.handleClear();
          break;

        case 'list-unmeasured':
          await this.handleListUnmeasured(args.slice(1));
          break;

        case 'add-character':
          await this.handleAddCharacter(args.slice(1));
          break;

        case 'measure':
          await this.handleMeasure(args.slice(1));
          break;

        default:
          await this.showUsage();
          process.exit(1);
      }
    } catch (error) {
      logger.error(`エラー: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async handleAssign(args: string[]): Promise<void> {
    const { characterId, style } = this.parseAssignArgs(args);
    await this.executeAssignment(characterId, style);
  }

  async handleRelease(): Promise<void> {
    const result: ReleaseResult = await this.manager!.releaseOperator();

    if (result.wasAssigned) {
      logger.info(`オペレータ返却: ${result.characterName}`);
    } else {
      logger.info('オペレータは割り当てられていません');
    }

    // 背景画像をクリア（オペレータの有無に関わらず実行）
    if (this.terminalBackground && await this.terminalBackground.isEnabled()) {
      await this.terminalBackground.clearBackground();
    }
  }

  async handleStatus(): Promise<void> {
    const result: StatusResult = await this.manager!.showCurrentOperator();
    logger.info(result.message);
  }

  async handleAvailable(): Promise<void> {
    const result = await this.manager!.getAvailableOperators();
    logger.info(`利用可能なオペレータ: ${result.available.join(', ')}`);
    if (result.busy.length > 0) {
      logger.info(`仕事中のオペレータ: ${result.busy.join(', ')}`);
    }
  }

  async handleClear(): Promise<void> {
    await this.manager!.clearAllOperators();
    logger.info('全てのオペレータ利用状況をクリアしました');
  }

  async handleListUnmeasured(args: string[]): Promise<void> {
    // --jsonフラグのチェック
    const jsonOutput = args.includes('--json');

    const result = await this.manager!.detectUnregisteredSpeakers();

    if (jsonOutput) {
      // JSON形式で出力
      logger.info(JSON.stringify(result, null, 2));
    } else {
      // 人間が読みやすい形式で出力
      logger.info('=== キャラクター登録状況 ===\n');

      // 完全未登録
      if (result.unregistered.length > 0) {
        logger.info('【未登録キャラクター】');
        for (const speaker of result.unregistered) {
          logger.info(`  ${speaker.speakerName} (${speaker.speakerId})`);
          logger.info(`    スタイル数: ${speaker.totalStyles}`);
          for (const style of speaker.styles) {
            logger.info(`      - ${style.styleName} (ID: ${style.styleId})`);
          }
        }
        logger.info('');
      }

      // 部分登録（未計測スタイルあり）
      if (result.partiallyRegistered.length > 0) {
        logger.info('【未計測スタイルがあるキャラクター】');
        for (const speaker of result.partiallyRegistered) {
          logger.info(`  ${speaker.speakerName} (characterId: ${speaker.characterId})`);
          logger.info(`    未計測スタイル: ${speaker.missingStyles.length}個`);
          for (const style of speaker.missingStyles) {
            logger.info(`      - ${style.styleName} (ID: ${style.styleId})`);
          }
        }
        logger.info('');
      }

      // 完全登録
      if (result.registered.length > 0) {
        logger.info('【登録・計測済みキャラクター】');
        for (const speaker of result.registered) {
          logger.info(`  ${speaker.speakerName} (characterId: ${speaker.characterId})`);
          logger.info(`    登録スタイル数: ${speaker.registeredStyles}/${speaker.totalStyles}`);
        }
        logger.info('');
      }

      // サマリー
      logger.info('=== サマリー ===');
      logger.info(`未登録: ${result.unregistered.length}キャラクター`);
      logger.info(`未計測スタイルあり: ${result.partiallyRegistered.length}キャラクター`);
      logger.info(`登録・計測済み: ${result.registered.length}キャラクター`);
    }
  }

  async handleAddCharacter(args: string[]): Promise<void> {
    if (args.length < 2) {
      logger.error('エラー: characterIdとspeakerNameが必要です');
      logger.error('使用法: operator-manager add-character <characterId> <speakerName>');
      process.exit(1);
    }

    const characterId = args[0];
    const speakerNameOrUuid = args[1];

    // SpeakerProviderからSpeaker情報を取得
    const { getSpeakerProvider } = await import('@coeiro-operator/core');
    const speakerProvider = getSpeakerProvider();
    const apiSpeakers = await speakerProvider.getSpeakers();

    // speakerNameOrUuidでSpeakerを検索（名前またはUUIDで）
    const speaker = apiSpeakers.find(
      s => s.speakerName === speakerNameOrUuid || s.speakerUuid === speakerNameOrUuid
    );

    if (!speaker) {
      logger.error(`エラー: Speaker '${speakerNameOrUuid}' が見つかりません`);
      process.exit(1);
    }

    // 最小限のCharacterConfigを作成
    const characterConfig = {
      speakerId: speaker.speakerUuid,
      name: speaker.speakerName,
      personality: '',
      speakingStyle: '',
      greeting: '',
      farewell: '',
      defaultStyleId: speaker.styles[0]?.styleId ?? 0,
      styles: {}, // 空のスタイル設定（話速測定は別途実施）
    };

    // ConfigManagerを使ってキャラクターを登録
    await this.configManager!.registerCharacter(characterId, characterConfig);

    logger.info(`キャラクター '${characterId}' を登録しました`);
    logger.info(`  Speaker: ${speaker.speakerName} (${speaker.speakerUuid})`);
    logger.info(`  デフォルトスタイル: ${speaker.styles[0]?.styleName ?? 'N/A'}`);
    logger.info('');
    logger.info('次のステップ:');
    logger.info('  1. config.jsonを編集してキャラクター設定を追加（personality, greeting, farewellなど）');
    logger.info(`  2. 話速を測定: operator-manager measure ${characterId}`);
  }

  async handleMeasure(args: string[]): Promise<void> {
    if (args.length < 1) {
      logger.error('エラー: characterIdが必要です');
      logger.error('使用法: operator-manager measure <characterId> [--style=スタイル名] [--dry-run]');
      process.exit(1);
    }

    // 引数をパース
    const characterId = args.find(arg => !arg.startsWith('--'));
    if (!characterId) {
      logger.error('エラー: characterIdが必要です');
      process.exit(1);
    }

    const styleArg = args.find(arg => arg.startsWith('--style='));
    const styleName = styleArg ? styleArg.substring(8) : undefined;
    const dryRun = args.includes('--dry-run');

    if (dryRun) {
      logger.info('[DRY RUN モード] 測定結果を表示しますが、設定は更新しません\n');
    }

    try {
      logger.info(`キャラクター '${characterId}' の話速を測定中...\n`);

      const result = await this.manager!.measureCharacterSpeechRate(
        characterId,
        styleName,
        dryRun
      );

      logger.info(`=== 測定結果 ===`);
      logger.info(`キャラクター: ${result.speakerName} (${result.characterId})`);
      logger.info(`Speaker UUID: ${result.speakerId}`);
      logger.info('');

      for (const measurement of result.measurements) {
        logger.info(`スタイル: ${measurement.styleName} (ID: ${measurement.styleId})`);
        logger.info(`  話速: ${measurement.morasPerSecond} モーラ/秒`);
      }
      logger.info('');

      if (dryRun) {
        logger.info('[DRY RUN] 設定は更新されませんでした');
        logger.info(`実際に更新する場合は --dry-run を外して再実行してください:`);
        logger.info(`  operator-manager measure ${characterId}${styleName ? ` --style=${styleName}` : ''}`);
      } else {
        logger.info('設定を更新しました');
        logger.info(`config.jsonの ${characterId}.styles に話速情報を追加・更新しました`);
      }
    } catch (error) {
      logger.error(`エラー: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}

// メイン実行
// import.meta.urlはコンパイル済みのJSファイルのURL
// process.argv[1]は実行されたファイルのパス（シンボリックリンク経由の場合もある）
// 直接実行された場合のみ実行する
const cli = new OperatorManagerCLI();
await cli.run(process.argv.slice(2));

export default OperatorManagerCLI;
