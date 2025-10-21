/**
 * テスト用ヘルパー関数とモックファクトリ
 */

import { vi } from 'vitest';
import { ConfigManager } from '@coeiro-operator/core';
import type { Config } from './types.js';

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
          speakerId: '3c37646f-3881-5374-2a83-149267990abc', // 実際のtsukuyomiのspeakerId
          name: 'つくよみちゃん',
          defaultStyle: 'れいせい',
          availableStyles: ['れいせい', 'おしとやか', 'げんき'],
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
    getOperatorConfig: async () => mergedConfig.operator,
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