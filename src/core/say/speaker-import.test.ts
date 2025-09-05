/**
 * Speakerライブラリのimportテスト
 * importの副作用でALSAエラーが発生するか確認
 */

import Speaker from 'speaker';

describe('Speaker Import Test', () => {
  test('can import Speaker library', () => {
    // Speakerをimportするだけ、インスタンス化はしない
    expect(Speaker).toBeDefined();
  });
});