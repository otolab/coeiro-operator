import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        // 基本設定
        environment: 'node',
        testTimeout: 30000,
        // MCP Debug専用テストファイル
        include: [
            'src/mcp-debug/test/**/*.test.ts'
        ],
        // 除外パターン
        exclude: [
            'node_modules/**',
            'dist/**',
            'coverage/**'
        ],
        // セットアップファイル
        setupFiles: ['src/mcp-debug/test/setup.ts'],
        // カバレッジ設定
        coverage: {
            provider: 'v8',
            include: [
                'src/mcp-debug/**/*.ts'
            ],
            exclude: [
                'src/mcp-debug/**/*.test.ts',
                'src/mcp-debug/**/*.d.ts'
            ],
            reportsDirectory: 'coverage/mcp-debug'
        },
        // ESM設定
        globals: true,
        // シングルスレッド実行（MCP Debug安定性のため）
        pool: 'threads',
        poolOptions: {
            threads: {
                singleThread: true
            }
        },
        // ファイル内での並行実行も無効化
        fileParallelism: false,
        maxConcurrency: 1
    }
});
//# sourceMappingURL=vitest.mcp-debug.config.js.map