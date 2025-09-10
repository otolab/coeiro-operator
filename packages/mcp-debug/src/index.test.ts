/**
 * MCP Debug パッケージのテスト
 */

import { describe, test, expect } from 'vitest';
import { createMCPTester, MCPServiceE2ETester } from './index.js';

describe('MCP Debug Package', () => {
  test('createMCPTester関数がエクスポートされていること', () => {
    expect(createMCPTester).toBeDefined();
    expect(typeof createMCPTester).toBe('function');
  });

  test('MCPServiceE2ETesterクラスがエクスポートされていること', () => {
    expect(MCPServiceE2ETester).toBeDefined();
    expect(typeof MCPServiceE2ETester).toBe('function');
  });
});