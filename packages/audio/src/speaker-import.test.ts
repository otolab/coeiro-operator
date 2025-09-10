/**
 * Speakerライブラリのimportテスト
 * importの副作用でALSAエラーが発生するか確認
 */

import { describe, test, expect } from 'vitest';

describe.skipIf(process.env.CI === 'true')('Speaker Import Test', () => {
  test('can import Speaker library', async () => {
    // CI環境ではスキップ
    const Speaker = await import('speaker');
    expect(Speaker.default).toBeDefined();
  });
});