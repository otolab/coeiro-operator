/**
 * Jest Configuration for MCP Debug Environment Tests
 * MCPデバッグ環境専用テスト設定
 */

export default {
  displayName: 'MCP Debug Environment',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: [
    '<rootDir>/src/mcp-debug/test/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false,
      tsconfig: '<rootDir>/tsconfig.json'
    }]
  },
  collectCoverageFrom: [
    'src/mcp-debug/**/*.ts',
    '!src/mcp-debug/**/*.test.ts',
    '!src/mcp-debug/**/*.d.ts'
  ],
  coverageDirectory: '<rootDir>/coverage/mcp-debug',
  testTimeout: 25000,
  setupFilesAfterEnv: []
};