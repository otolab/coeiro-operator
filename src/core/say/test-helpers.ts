/**
 * テスト用ヘルパー関数とモックファクトリ
 */

import { vi } from 'vitest';
import { ConfigManager } from '../operator/config-manager.js';
import type { Config } from './types.js';

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

/**
 * テスト用のConfigManagerモックを作成
 */
export function createMockConfigManager(overrides: Partial<Config> = {}): ConfigManager {
  const defaultConfig: Config = {
    connection: {
      host: 'localhost',
      port: '50032',
    },
    operator: {
      rate: 200,
      timeout: 14400000,
      assignmentStrategy: 'random',
    },
    audio: {
      latencyMode: 'balanced',
      splitMode: 'punctuation',
      bufferSize: 256,
      parallelGeneration: {
        maxConcurrency: 2,
        delayBetweenRequests: 50,
        bufferAheadCount: 1,
        pauseUntilFirstComplete: true,
      },
    },
    characters: {},
  };

  // overridesで深くマージ
  const mergedConfig = deepMerge(defaultConfig, overrides);

  // ConfigManagerのモックオブジェクトを作成
  const mockConfigManager = {
    getFullConfig: async () => mergedConfig,
    buildDynamicConfig: async () => {},
    getCharacterConfig: async (characterId: string) => {
      // テスト用のキャラクター設定を返す
      // test-speaker-1などのテスト用IDの場合は適切な設定を返す
      if (characterId === 'test-speaker-1' || characterId === 'test-speaker-uuid') {
        return {
          speakerId: 'test-speaker-1',  // テストのモックと一致させる
          name: 'テストスピーカー1',
          defaultStyle: 'ノーマル',
          availableStyles: ['ノーマル'],
        };
      }
      // tsukuyomiなど他のキャラクターも対応
      if (characterId === 'tsukuyomi') {
        return {
          speakerId: 'tsukuyomi-uuid',
          name: 'つくよみちゃん',
          defaultStyle: 'ノーマル',
          availableStyles: ['ノーマル'],
        };
      }
      // デフォルトのキャラクター設定
      return {
        speakerId: characterId + '-uuid',
        name: characterId,
        defaultStyle: 'ノーマル',
        availableStyles: ['ノーマル'],
      };
    },
    getAvailableCharacterIds: async () => ['test-speaker-1', 'tsukuyomi'],
    getOperatorTimeout: async () => mergedConfig.operator.timeout,
    getRate: async () => mergedConfig.operator.rate,
    getAudioConfig: async () => mergedConfig.audio,
    getConnectionConfig: async () => mergedConfig.connection,
  } as unknown as ConfigManager;

  return mockConfigManager;
}

/**
 * オブジェクトの深いマージ
 */
function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        result[key] = deepMerge(
          result[key] as any,
          source[key] as any
        );
      } else {
        result[key] = source[key] as any;
      }
    }
  }

  return result;
}