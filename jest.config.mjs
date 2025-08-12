export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  displayName: 'COEIRO Operator Core',
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '!<rootDir>/src/mcp-debug/**/*.test.ts'  // mcp-debugのテストを除外
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/mcp-debug/**/*'  // mcp-debugのカバレッジを除外
  ],
  coverageDirectory: '<rootDir>/coverage/coeiro-operator',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  testTimeout: 20000  // mcp-debug統合テスト用に延長
};