/**
 * テスト用ヘルパー関数とモックファクトリ
 */

import { vi } from 'vitest';

/**
 * Speakerモックインスタンスを作成
 * Node.js StreamのWritableインターフェースを完全に実装
 */
export function createMockSpeakerInstance() {
  const mockInstance: any = {
    write: vi.fn((chunk, encoding, callback) => {
      // 引数の数に応じて適切にコールバックを処理
      const cb = typeof encoding === 'function' ? encoding : callback;
      if (cb) cb();
      return true;
    }),
    end: vi.fn((chunk, encoding, callback) => {
      // 引数の数に応じて適切にコールバックを処理
      let cb;
      if (typeof chunk === 'function') {
        cb = chunk;
      } else if (typeof encoding === 'function') {
        cb = encoding;
      } else {
        cb = callback;
      }
      if (cb) setTimeout(cb, 10);
    }),
    on: vi.fn(function(this: any, event, callback) {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
    }),
    once: vi.fn(function(this: any, event, callback) {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
    }),
    emit: vi.fn(),
    removeListener: vi.fn(function(this: any) { return this; }),
    removeAllListeners: vi.fn(function(this: any) { return this; }),
    pipe: vi.fn(),
    unpipe: vi.fn(),
    destroy: vi.fn(),
    _writableState: { ended: false },
    writable: true,
    readable: false,
  };

  // thisバインディングを修正
  mockInstance.on = mockInstance.on.bind(mockInstance);
  mockInstance.once = mockInstance.once.bind(mockInstance);
  mockInstance.removeListener = mockInstance.removeListener.bind(mockInstance);
  mockInstance.removeAllListeners = mockInstance.removeAllListeners.bind(mockInstance);

  return mockInstance;
}

/**
 * エラーを発生させるSpeakerモックインスタンスを作成
 */
export function createErrorMockSpeakerInstance() {
  const mockInstance = createMockSpeakerInstance();
  
  mockInstance.on = vi.fn(function(this: any, event, callback) {
    if (event === 'error') {
      setTimeout(() => callback(new Error('Mock speaker error')), 10);
    }
    return this;
  }).bind(mockInstance);

  mockInstance.once = vi.fn(function(this: any, event, callback) {
    if (event === 'error') {
      setTimeout(() => callback(new Error('Mock speaker error')), 10);
    }
    return this;
  }).bind(mockInstance);

  return mockInstance;
}