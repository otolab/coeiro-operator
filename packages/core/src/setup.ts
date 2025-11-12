/**
 * packages/core/src/setup.ts
 * OperatorManager、ConfigManager、CharacterInfoServiceの統一セットアップ関数
 */

import { getConfigDir } from './common/config-paths.js';
import ConfigManager from './operator/config-manager.js';
import CharacterInfoService from './operator/character-info-service.js';
import OperatorManager from './operator/index.js';

export interface SetupResult {
  configManager: ConfigManager;
  characterInfoService: CharacterInfoService;
  operatorManager: OperatorManager;
}

/**
 * OperatorManagerとその依存関係を初期化する
 *
 * @returns 初期化されたコンポーネント
 */
export async function setup(): Promise<SetupResult> {
  const configDir = await getConfigDir();

  // 1. ConfigManagerを初期化
  const configManager = new ConfigManager(configDir);
  await configManager.buildDynamicConfig();

  // 2. CharacterInfoServiceを初期化
  const characterInfoService = new CharacterInfoService();
  characterInfoService.initialize(configManager);

  // 3. OperatorManagerを生成（依存を注入）
  const operatorManager = new OperatorManager(configManager, characterInfoService);
  await operatorManager.initialize();

  return {
    configManager,
    characterInfoService,
    operatorManager,
  };
}
