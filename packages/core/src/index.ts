/**
 * @coeiro-operator/core - Core utilities and shared functionality
 */

// Config and paths
export * from './common/config-paths.js';

// Logger (re-export from common)
export { logger, LoggerPresets } from '@coeiro-operator/common';

// Dictionary
export * from './dictionary/dictionary-service.js';
export * from './dictionary/dictionary-client.js';
export * from './dictionary/dictionary-persistence.js';
export * from './dictionary/default-dictionaries.js';

// Operator
export * from './operator/index.js';
export * from './operator/character-info-service.js';
export * from './operator/character-defaults.js';
export * from './operator/config-manager.js';
export * from './operator/file-operation-manager.js';

// Environment (Speakerは除外してcharacter-info-serviceから使用)
export { 
  VoiceStyle,
  ConnectionConfig,
  getSpeakerProvider,
  type SpeakerProvider
} from './environment/speaker-provider.js';

// Test utilities
export * from './test-utils/test-env.js';