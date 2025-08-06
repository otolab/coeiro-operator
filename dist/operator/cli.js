#!/usr/bin/env node
/**
 * src/operator/cli.ts: オペレータ管理CLI
 * operator-managerスクリプトのJavaScript版
 */
import OperatorManager from './index.js';
class OperatorManagerCLI {
    manager;
    constructor() {
        this.manager = new OperatorManager();
    }
    parseAssignArgs(args) {
        let operatorId = null;
        let style = null;
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--style=')) {
                style = arg.substring(8);
            }
            else if (!arg.startsWith('--')) {
                operatorId = arg;
            }
        }
        return { operatorId, style };
    }
    async executeAssignment(operatorId, style) {
        if (operatorId) {
            const result = await this.manager.assignSpecificOperator(operatorId, style);
            console.log(`オペレータ決定: ${result.characterName} (${result.operatorId})`);
            if (result.currentStyle) {
                console.log(`スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`);
            }
        }
        else {
            const currentStatus = await this.manager.showCurrentOperator();
            if (currentStatus.operatorId) {
                console.log(currentStatus.message);
            }
            else {
                const result = await this.manager.assignRandomOperator(style);
                console.log(`オペレータ決定: ${result.characterName} (${result.operatorId})`);
                if (result.currentStyle) {
                    console.log(`スタイル: ${result.currentStyle.styleName} - ${result.currentStyle.personality}`);
                }
            }
        }
    }
    async showUsage() {
        console.log(`使用法: operator-manager {assign|release|status|available|clear}
  assign [オペレータID] [--style=スタイル名] - オペレータを割り当て（IDを指定しない場合はランダム）
  release                                    - 現在のオペレータを返却
  status                                     - 現在のオペレータを表示
  available                                  - 利用可能なオペレータを表示
  clear                                      - 全てのオペレータ利用状況をクリア`);
    }
    async run(args) {
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
        }
        catch (error) {
            console.error(`エラー: ${error.message}`);
            process.exit(1);
        }
    }
    async handleAssign(args) {
        const { operatorId, style } = this.parseAssignArgs(args);
        await this.executeAssignment(operatorId, style);
    }
    async handleRelease() {
        const result = await this.manager.releaseOperator();
        console.log(`オペレータ返却: ${result.characterName}`);
    }
    async handleStatus() {
        const result = await this.manager.showCurrentOperator();
        console.log(result.message);
    }
    async handleAvailable() {
        const available = await this.manager.getAvailableOperators();
        console.log(`利用可能なオペレータ: ${available.join(' ')}`);
    }
    async handleClear() {
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
//# sourceMappingURL=cli.js.map