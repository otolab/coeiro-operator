/**
 * ターミナル背景設定のテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from './config-manager.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('ConfigManager - Terminal Background Config', () => {
  let configManager: ConfigManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `coeiro-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    configManager = new ConfigManager(tempDir);

    // コンソール警告をモック
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    try {
      const fs = await import('fs');
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // クリーンアップエラーは無視
    }
  });

  describe('新設定形式', () => {
    test('デフォルト設定を正しく返す', async () => {
      const config = await configManager.getTerminalBackgroundConfig();

      expect(config).toEqual({
        enabled: true,
        imagePaths: {},
        display: {
          opacity: 0.3,
          position: 'bottom-right',
          scale: 0.15,
        },
      });
    });

    test('imagePathsを正しく処理する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            imagePaths: {
              tsukuyomi: '/path/to/tsukuyomi.png',
              rilin: null,  // 明示的に無効
              angie: false,  // 明示的に無効（別の形式）
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.imagePaths).toEqual({
        tsukuyomi: '/path/to/tsukuyomi.png',
        rilin: null,
        angie: false,
      });
    });

    test('display設定を正しく処理する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            display: {
              opacity: 0.5,
              position: 'top-right',
              scale: 0.2,
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.display).toEqual({
        opacity: 0.5,
        position: 'top-right',
        scale: 0.2,
      });
    });
  });

  describe('旧設定からの移行', () => {
    test('backgroundImagesを新形式に移行する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            backgroundImages: {
              tsukuyomi: '/old/path/tsukuyomi.png',
              angie: '/old/path/angie.png',
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.imagePaths).toEqual({
        tsukuyomi: '/old/path/tsukuyomi.png',
        angie: '/old/path/angie.png',
      });

      expect(console.warn).toHaveBeenCalledWith(
        'config.terminal.background.backgroundImages は非推奨です。imagePaths を使用してください。'
      );
    });

    test('operatorImage.display: "none" をenabled: falseに移行する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            operatorImage: {
              display: 'none',
              opacity: 0.3,
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.enabled).toBe(false);

      expect(console.warn).toHaveBeenCalledWith(
        'config.terminal.background.operatorImage.display: "none" は非推奨です。enabled: false を使用してください。'
      );
    });

    test('operatorImage.filePathを警告とともに処理する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            operatorImage: {
              display: 'file',
              filePath: '/path/to/common.png',
              opacity: 0.4,
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.display?.opacity).toBe(0.4);

      expect(console.warn).toHaveBeenCalledWith(
        'config.terminal.background.operatorImage.filePath は非推奨です。imagePaths でキャラクターごとに設定してください。'
      );
    });

    test('新旧設定が混在する場合、新設定を優先する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            // 旧設定
            backgroundImages: {
              tsukuyomi: '/old/tsukuyomi.png',
              angie: '/old/angie.png',
            },
            // 新設定
            imagePaths: {
              tsukuyomi: '/new/tsukuyomi.png',  // 優先される
              rilin: null,
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.imagePaths).toEqual({
        tsukuyomi: '/new/tsukuyomi.png',  // 新設定が優先
        angie: '/old/angie.png',           // 旧設定から移行
        rilin: null,                       // 新設定
      });
    });

    test('operatorImageのopacityとpositionをdisplayに移行する', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: true,
            operatorImage: {
              display: 'api',
              opacity: 0.7,
              position: 'top-right',
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config.display).toEqual({
        opacity: 0.7,
        position: 'top-right',
        scale: 0.15,  // デフォルト値
      });
    });
  });

  describe('エッジケース', () => {
    test('空の設定でもデフォルト値を返す', async () => {
      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify({}),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config).toEqual({
        enabled: true,
        imagePaths: {},
        display: {
          opacity: 0.3,
          position: 'bottom-right',
          scale: 0.15,
        },
      });
    });

    test('部分的な設定でもデフォルト値とマージする', async () => {
      const testConfig = {
        terminal: {
          background: {
            enabled: false,
            // displayの一部のみ設定
            display: {
              opacity: 0.8,
            },
          },
        },
      };

      await writeFile(
        join(tempDir, 'config.json'),
        JSON.stringify(testConfig),
        'utf8'
      );

      const config = await configManager.getTerminalBackgroundConfig();

      expect(config).toEqual({
        enabled: false,
        imagePaths: {},
        display: {
          opacity: 0.8,
          position: 'bottom-right',  // デフォルト値
          scale: 0.15,                // デフォルト値
        },
      });
    });
  });
});