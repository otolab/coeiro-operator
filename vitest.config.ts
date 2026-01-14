import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // グローバルセットアップ
    setupFiles: ['./vitest.setup.ts'],

    // 基本設定
    environment: 'node',
    testTimeout: 20000,

    // テスト環境変数の設定
    env: {
      NODE_ENV: 'test',
      CI: 'true'
    },

    // グローバルモックを各テスト後に自動クリーンアップ
    unstubGlobals: true,

    // テスト出力制御
    // 環境変数TEST_VERBOSEが設定されていない限りサイレントモード
    silent: process.env.TEST_VERBOSE !== 'true',
    reporters: process.env.TEST_VERBOSE === 'true' ? 'verbose' : 'default',
    
    // Issue #50: メモリリーク検出のためのNode.jsオプション
    // Vitest 4.0ではsingleForkが廃止され、代わりにmaxWorkers/isolateを使用
    pool: 'forks',

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
      'packages/*/node_modules/**',
      'packages/**/*integration*.test.ts',  // 統合テストを除外
      'packages/**/test/**',  // E2Eテストディレクトリを除外
      'src/e2e-test/**'  // E2Eテストディレクトリを除外
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