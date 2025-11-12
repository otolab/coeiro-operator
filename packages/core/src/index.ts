/**
 * @coeiro-operator/core - Core utilities and shared functionality
 */

// Config and paths
export * from './common/config-paths.js';

// Common types
export * from './types.js';

// Logger (re-export from common)
export { logger, LoggerPresets } from '@coeiro-operator/common';

// Dictionary
export * from './dictionary/dictionary-service.js';
export * from './dictionary/dictionary-client.js';
export * from './dictionary/dictionary-persistence.js';
export * from './dictionary/default-dictionaries.js';

// Operator
export * from './operator/index.js';
export * from './operator/character/character-info-service.js';
export * from './operator/character/character-defaults.js';
export { default as ConfigManager, TerminalBackgroundConfig } from './operator/config/config-manager.js';
export * from './operator/file-operation-manager.js';

// Setup
export * from './setup.js';

// Environment (Speakerは除外してcharacter-info-serviceから使用)
export {
  VoiceStyle,
  ConnectionConfig,
  getSpeakerProvider,
  type SpeakerProvider
} from './environment/speaker-provider.js';

// Terminal
export { TerminalBackground } from './terminal/terminal-background.js';

// Test utilities
export * from './test-utils/test-env.js';