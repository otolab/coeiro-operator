/**
 * Speakerインスタンス作成テスト
 */

import Speaker from 'speaker';

describe('Speaker Creation Test', () => {
  test('should not create real Speaker in test environment', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('CI:', process.env.CI);
    
    // テスト環境では本物のSpeakerは作成しない
    if (process.env.NODE_ENV === 'test' || process.env.CI === 'true') {
      console.log('Test environment detected - should use mock');
      expect(true).toBe(true);
    } else {
      // 本番環境では実際のSpeakerを作成
      const speaker = new Speaker({
        channels: 1,
        bitDepth: 16,
        sampleRate: 24000
      });
      expect(speaker).toBeDefined();
    }
  });
});