import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 基本設定
    environment: 'node',
    testTimeout: 20000,
    
    // テスト環境変数の設定
    env: {
      NODE_ENV: 'test',
      CI: 'true'
    },
    
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
      'src/**/*.test.ts',
      'packages/**/*.test.ts'
    ],
    
    // 除外パターン
    exclude: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      'coverage/**',
      'packages/*/node_modules/**'
    ],

    // カバレッジはデフォルトで無効（CI環境でのみ有効化）
    // test:coverageコマンドまたはvitest.coverage.config.tsを使用

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