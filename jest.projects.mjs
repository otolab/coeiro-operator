/**
 * Jest Projects Configuration
 * COEIRO OperatorとMCP Debug環境の分離されたテスト設定
 */

export default {
  projects: [
    // COEIRO Operator Core Tests
    {
      displayName: 'COEIRO Operator Core',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      rootDir: '.',
      testMatch: [
        '<rootDir>/src/**/*.test.ts',
        '!<rootDir>/src/mcp-debug/**/*.test.ts',
        '!<rootDir>/dist/**/*'
      ],
      testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/'
      ],
      transformIgnorePatterns: [
        'node_modules/(?!(echogarden|@google-cloud|dsp\\.js|node-libsamplerate)/)'
      ],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
        '!src/**/*.d.ts',
        '!src/mcp-debug/**/*'
      ],
      coverageDirectory: '<rootDir>/coverage/coeiro-operator',
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          useESM: true,
          tsconfig: '<rootDir>/tsconfig.json'
        }]
      },
      testTimeout: 20000
    },

    // MCP Debug Environment Tests
    {
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
      transformIgnorePatterns: [
        'node_modules/(?!(echogarden|@google-cloud|dsp\\.js|node-libsamplerate)/)'
      ],
      collectCoverageFrom: [
        'src/mcp-debug/**/*.ts',
        '!src/mcp-debug/**/*.test.ts',
        '!src/mcp-debug/**/*.d.ts'
      ],
      coverageDirectory: '<rootDir>/coverage/mcp-debug',
      extensionsToTreatAsEsm: ['.ts'],
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', {
          useESM: true,
          tsconfig: '<rootDir>/tsconfig.json'
        }]
      },
      testTimeout: 25000,
      setupFilesAfterEnv: ['<rootDir>/src/mcp-debug/test/setup.ts']
    }
  ]
};