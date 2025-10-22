import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    include: ['packages/**/*integration*.test.ts'],
    exclude: [
      'node_modules/**',
      '**/node_modules/**',
      'dist/**',
      'build/**',
      '.git/**',
    ],
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    isolate: true,
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    logHeapUsage: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@coeiro-operator/common': path.resolve(__dirname, './packages/common/src'),
      '@coeiro-operator/core': path.resolve(__dirname, './packages/core/src'),
      '@coeiro-operator/audio': path.resolve(__dirname, './packages/audio/src'),
      '@coeiro-operator/cli': path.resolve(__dirname, './packages/cli/src'),
      '@coeiro-operator/mcp': path.resolve(__dirname, './packages/mcp/src'),
      '@coeiro-operator/mcp-debug': path.resolve(__dirname, './packages/mcp-debug/src'),
      '@coeiro-operator/term-bg': path.resolve(__dirname, './packages/term-bg/src'),
    },
  },
});