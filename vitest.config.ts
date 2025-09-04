import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 基本設定
    environment: 'node',
    testTimeout: 20000,
    
    // Issue #50: メモリリーク検出のためのNode.jsオプション
    // シングルスレッド実行でGCフラグ対応
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },

    // テストファイルパターン
    include: [
      'src/**/*.test.ts'
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
        'src/**/*.d.ts'
      ],
      reportsDirectory: 'coverage/coeiro-operator'
    },

    // ESM設定（Vitestはネイティブ対応）
    globals: true
  },

  // TypeScript解決設定
  resolve: {
    alias: {
      // ESMパス解決のためのエイリアス
      '@/core/operator': new URL('./src/core/operator', import.meta.url).pathname,
      '@/core/say': new URL('./src/core/say', import.meta.url).pathname
    }
  }
});