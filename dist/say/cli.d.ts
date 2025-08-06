#!/usr/bin/env node
/**
 * src/say/cli.ts: say-coeiroinkコマンドラインインターフェース
 * macOS sayコマンド互換のCLIツール
 */
import { SayCoeiroink } from './index.js';
declare class SayCoeiroinkCLI {
    private sayCoeiroink;
    constructor(sayCoeiroink: SayCoeiroink);
    showUsage(): Promise<void>;
    run(args: string[]): Promise<void>;
}
export default SayCoeiroinkCLI;
//# sourceMappingURL=cli.d.ts.map