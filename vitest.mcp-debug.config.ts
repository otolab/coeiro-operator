import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 基本設定
    environment: 'node',
    testTimeout: 30000,

    // MCP Debug専用テストファイル
    include: [
      'packages/mcp-debug/src/**/*.test.ts'
    ],
    
    // 除外パターン
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'packages/mcp-debug/src/test/**'
    ],

    // セットアップファイル（必要な場合）
    // setupFiles: ['packages/mcp-debug/src/test/setup.ts'],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      include: [
        'packages/mcp-debug/src/**/*.ts'
      ],
      exclude: [
        'packages/mcp-debug/src/**/*.test.ts',
        'packages/mcp-debug/src/**/*.d.ts',
        'packages/mcp-debug/src/test/**'
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