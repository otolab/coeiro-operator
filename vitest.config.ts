import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 基本設定
    environment: 'node',
    testTimeout: 20000,

    // テストファイルパターン
    include: [
      'src/**/*.test.ts',
      '!src/mcp-debug/**/*.test.ts'  // mcp-debugのテストを除外
    ],
    
    // 除外パターン
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**'
    ],

    // カバレッジ設定
    coverage: {
      provider: 'v8',
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/mcp-debug/**/*'  // mcp-debugのカバレッジを除外
      ],
      reportsDirectory: 'coverage/coeiro-operator'
    },

    // ESM設定（Vitestはネイティブ対応）
    globals: true,
    
    // パラレル実行設定
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false
      }
    }
  },

  // TypeScript解決設定
  resolve: {
    alias: {
      // 必要に応じて追加
    }
  }
});