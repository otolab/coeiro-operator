#!/usr/bin/env node
/**
 * src/operator/cli.ts: オペレータ管理CLI
 * operator-managerスクリプトのJavaScript版
 */
declare class OperatorManagerCLI {
    private manager;
    constructor();
    showUsage(): Promise<void>;
    run(args: string[]): Promise<void>;
    handleAssign(args: string[]): Promise<void>;
    handleRelease(): Promise<void>;
    handleStatus(): Promise<void>;
    handleAvailable(): Promise<void>;
    handleClear(): Promise<void>;
}
export default OperatorManagerCLI;
//# sourceMappingURL=cli.d.ts.map