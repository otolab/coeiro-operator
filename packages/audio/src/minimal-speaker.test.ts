/**
 * Speakerのimportだけのテスト
 */

import { describe, test, expect } from 'vitest';

describe.skipIf(process.env.CI === 'true')('Minimal Speaker Import Test', () => {
  test('imports Speaker', async () => {
    // CI環境ではスキップ
    await import('speaker');
    expect(true).toBe(true);
  });
});