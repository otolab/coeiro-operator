import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config.js';
// CI環境でのカバレッジ計測用設定
export default defineConfig({
    ...baseConfig,
    test: {
        ...baseConfig.test,
        // カバレッジ設定を追加
        coverage: {
            enabled: true,
            provider: 'v8',
            include: [
                'src/**/*.ts'
            ],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.d.ts',
                'src/mcp-debug/**',
                'src/e2e-test/**'
            ],
            reportsDirectory: 'coverage/coeiro-operator',
            reporter: ['text', 'json', 'html'],
            thresholds: {
            // カバレッジ閾値（将来的に設定可能）
            // branches: 80,
            // functions: 80,
            // lines: 80,
            // statements: 80
            }
        }
    }
});
//# sourceMappingURL=vitest.coverage.config.js.map