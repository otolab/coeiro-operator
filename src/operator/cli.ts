#!/usr/bin/env node

/**
 * src/operator/cli.ts: オペレータ管理CLI
 * operator-managerスクリプトのJavaScript版
 */

import OperatorManager from './index.js';

interface AssignResult {
    operatorId: string;
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
    characterName: string;
}

interface StatusResult {
    operatorId?: string;
    message: string;
}

interface ParsedArgs {
    operatorId: string | null;
    style: string | null;
}

class OperatorManagerCLI {
    private manager: OperatorManager;

    constructor() {
        this.manager = new OperatorManager();
    }

    private parseAssignArgs(args: string[]): ParsedArgs {
        let operatorId: string | null = null;
        let style: string | null = null;
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--style=')) {
                style = arg.substring(8);
            } else if (!arg.startsWith('--')) {
                operatorId = arg;
            }
        }
        
        return { operatorId, style };
    }

    private async executeAssignment(operatorId: string | null, style: string | null): Promise<void> {
        if (operatorId) {
            const result: AssignResult = await this.manager.assignSpecificOperator(operatorId, style);
            console.log(`オペレータ決定: ${result.characterName} (${result.operatorId})`);
            if (result.currentStyle) {
                console.log(`スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`);
            }
        } else {
            const currentStatus: StatusResult = await this.manager.showCurrentOperator();
            if (currentStatus.operatorId) {
                console.log(currentStatus.message);
            } else {
                const result: AssignResult = await this.manager.assignRandomOperator(style);
                console.log(`オペレータ決定: ${result.characterName} (${result.operatorId})`);
                if (result.currentStyle) {
                    console.log(`スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`);
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
        const { operatorId, style } = this.parseAssignArgs(args);
        await this.executeAssignment(operatorId, style);
    }

    async handleRelease(): Promise<void> {
        const result: ReleaseResult = await this.manager.releaseOperator();
        console.log(`オペレータ返却: ${result.characterName}`);
    }

    async handleStatus(): Promise<void> {
        const result: StatusResult = await this.manager.showCurrentOperator();
        console.log(result.message);
    }

    async handleAvailable(): Promise<void> {
        const available: string[] = await this.manager.getAvailableOperators();
        console.log(`利用可能なオペレータ: ${available.join(' ')}`);
    }

    async handleClear(): Promise<void> {
        await this.manager.clearAllOperators();
        console.log('全てのオペレータ利用状況をクリアしました');
    }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new OperatorManagerCLI();
    await cli.run(process.argv.slice(2));
}

export default OperatorManagerCLI;