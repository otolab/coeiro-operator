#!/usr/bin/env node
export default OperatorManagerCLI;
declare class OperatorManagerCLI {
    manager: OperatorManager;
    showUsage(): Promise<void>;
    run(args: any): Promise<void>;
    handleAssign(args: any): Promise<void>;
    handleRelease(): Promise<void>;
    handleStatus(): Promise<void>;
    handleAvailable(): Promise<void>;
    handleClear(): Promise<void>;
}
import OperatorManager from './index.js';
//# sourceMappingURL=cli.d.ts.map