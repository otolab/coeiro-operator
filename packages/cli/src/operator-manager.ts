#!/usr/bin/env node --no-deprecation

/**
 * src/operator/cli.ts: オペレータ管理CLI
 * operator-managerスクリプトのJavaScript版
 */

import { OperatorManager, ConfigManager, TerminalBackground, getConfigDir } from '@coeiro-operator/core';

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
  private manager: OperatorManager;
  private terminalBackground: TerminalBackground | null = null;
  private configManager: ConfigManager | null = null;

  constructor() {
    this.manager = new OperatorManager();
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
      const result: AssignResult = await this.manager.assignSpecificOperator(characterId, style);
      console.log(`オペレータ決定: ${result.characterName} (${result.characterId})`);
      if (result.currentStyle) {
        console.log(
          `スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`
        );
      }
      // 背景画像を切り替え
      if (this.terminalBackground && await this.terminalBackground.isEnabled()) {
        await this.terminalBackground.switchCharacter(result.characterId);
      }
    } else {
      const currentStatus: StatusResult = await this.manager.showCurrentOperator();
      if (currentStatus.characterId) {
        console.log(currentStatus.message);
      } else {
        const result: AssignResult = await this.manager.assignRandomOperator(style);
        console.log(`オペレータ決定: ${result.characterName} (${result.characterId})`);
        if (result.currentStyle) {
          console.log(
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
    console.log(`使用法: operator-manager {assign|release|status|available|clear}
  assign [オペレータID] [--style=スタイル名] - オペレータを割り当て（IDを指定しない場合はランダム）
  release                                    - 現在のオペレータを返却
  status                                     - 現在のオペレータを表示
  available                                  - 利用可能なオペレータを表示
  clear                                      - 全てのオペレータ利用状況をクリア`);
  }

  async run(args: string[]): Promise<void> {
    await this.manager.initialize();

    // ConfigManagerとTerminalBackgroundを初期化
    const configDir = await getConfigDir();
    this.configManager = new ConfigManager(configDir);
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

        default:
          await this.showUsage();
          process.exit(1);
      }
    } catch (error) {
      console.error(`エラー: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  async handleAssign(args: string[]): Promise<void> {
    const { characterId, style } = this.parseAssignArgs(args);
    await this.executeAssignment(characterId, style);
  }

  async handleRelease(): Promise<void> {
    const result: ReleaseResult = await this.manager.releaseOperator();

    if (result.wasAssigned) {
      console.log(`オペレータ返却: ${result.characterName}`);
    } else {
      console.log('オペレータは割り当てられていません');
    }

    // 背景画像をクリア（オペレータの有無に関わらず実行）
    if (this.terminalBackground && await this.terminalBackground.isEnabled()) {
      await this.terminalBackground.clearBackground();
    }
  }

  async handleStatus(): Promise<void> {
    const result: StatusResult = await this.manager.showCurrentOperator();
    console.log(result.message);
  }

  async handleAvailable(): Promise<void> {
    const result = await this.manager.getAvailableOperators();
    console.log(`利用可能なオペレータ: ${result.available.join(', ')}`);
    if (result.busy.length > 0) {
      console.log(`仕事中のオペレータ: ${result.busy.join(', ')}`);
    }
  }

  async handleClear(): Promise<void> {
    await this.manager.clearAllOperators();
    console.log('全てのオペレータ利用状況をクリアしました');
  }
}

// メイン実行
// import.meta.urlはコンパイル済みのJSファイルのURL
// process.argv[1]は実行されたファイルのパス（シンボリックリンク経由の場合もある）
// 直接実行された場合のみ実行する
const cli = new OperatorManagerCLI();
await cli.run(process.argv.slice(2));

export default OperatorManagerCLI;
