import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // E2Eテスト用の設定
    environment: 'node',
    
    // シングルスレッド実行
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },

    // E2Eテストのみ
    include: [
      'src/e2e-test/**/*.test.ts',
      'src/**/e2e/**/*.test.ts'
    ],
    
    // 除外パターン
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**'
    ],

    // カバレッジは無効
    coverage: {
      enabled: false
    },

    // グローバル設定
    globals: true,
    
    // ログ出力設定
    logHeapUsage: false,
    silent: false
  },

  // TypeScript解決設定
  resolve: {
    alias: {
      '@/core/operator': new URL('./src/core/operator', import.meta.url).pathname,
      '@/core/say': new URL('./src/core/say', import.meta.url).pathname
    }
  }
});