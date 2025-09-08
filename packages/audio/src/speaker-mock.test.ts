/**
 * Speakerモック化のテスト
 */

// Speakerをモック化
vi.mock('speaker', () => ({
  default: vi.fn(() => {
    console.log('Mock Speaker created');
    return {
      write: vi.fn(),
      end: vi.fn((chunk, encoding, callback) => {
        if (typeof chunk === 'function') callback = chunk;
        if (typeof encoding === 'function') callback = encoding;
        if (callback) setImmediate(callback);
      }),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      removeListener: vi.fn()
    };
  })
}));

describe('Speaker Mock Test', () => {
  test('should use mock Speaker', async () => {
    // モックされたSpeakerを動的インポート
    const SpeakerModule = await import('speaker');
    const Speaker = SpeakerModule.default;
    
    const speaker = new (Speaker as unknown)({
      channels: 1,
      bitDepth: 16,
      sampleRate: 24000
    });
    
    expect(speaker).toBeDefined();
    expect(speaker.write).toBeDefined();
    expect(speaker.end).toBeDefined();
  });
});