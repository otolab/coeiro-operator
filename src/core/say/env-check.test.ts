/**
 * 環境変数チェックのテスト
 */

describe('Environment Variables Test', () => {
  test('NODE_ENV should be test', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('CI:', process.env.CI);
    expect(process.env.NODE_ENV).toBe('test');
  });

  test('CI should be true', () => {
    expect(process.env.CI).toBe('true');
  });
});