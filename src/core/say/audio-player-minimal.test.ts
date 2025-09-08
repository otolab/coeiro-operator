/**
 * AudioPlayer最小限のテスト
 */

import { AudioPlayer } from './audio-player.js';

describe('AudioPlayer Minimal Test', () => {
  test('should create AudioPlayer instance', () => {
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('CI:', process.env.CI);
    
    const config = {
      connection: { host: 'localhost', port: '50032' },
      voice: { rate: 200 },
      audio: { latencyMode: 'balanced' }
    };
    
    const audioPlayer = new AudioPlayer(config);
    expect(audioPlayer).toBeDefined();
  });

  test('should initialize without Speaker in test environment', async () => {
    const config = {
      connection: { host: 'localhost', port: '50032' },
      voice: { rate: 200 },
      audio: { latencyMode: 'balanced' }
    };
    
    const audioPlayer = new AudioPlayer(config);
    const result = await audioPlayer.initialize();
    
    // テスト環境では初期化は成功するはず
    expect(result).toBe(true);
  });
});