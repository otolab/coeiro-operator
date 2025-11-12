/**
 * オペレータのタイムアウト時の動作をテストする
 * Issue #93: アサインが時間切れした端末でsay-coeiroinkコマンドを実行すると音声が出ない
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperatorManager } from './index.js';
import ConfigManager from './config-manager.js';
import CharacterInfoService from './character-info-service.js';
import { FileOperationManager } from './file-operation-manager.js';
import * as fs from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

describe('オペレータタイムアウト時の動作', () => {
  let operatorManager: OperatorManager;
  let testFilePath: string;
  let tempDir: string;
  const testSessionId = 'test-session-123';

  beforeEach(async () => {
    // テスト用の一時ファイルパス
    testFilePath = join(tmpdir(), `test-operators-${Date.now()}.json`);

    // 一時ディレクトリを作成
    tempDir = join(tmpdir(), `coeiro-test-timeout-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(tempDir, { recursive: true });

    // .coeiro-operatorサブディレクトリを作成
    const configSubDir = join(tempDir, '.coeiro-operator');
    await fs.mkdir(configSubDir, { recursive: true });

    // 統一設定ファイルのモックを作成
    const config = {
      connection: { host: 'localhost', port: '50032' },
      operator: { timeout: 14400000, assignmentStrategy: 'random' },
      characters: {
        'tsukuyomi': {
          name: 'つくよみちゃん',
          personality: 'テスト用',
          speakingStyle: 'テスト',
          greeting: 'こんにちは',
          farewell: 'さようなら',
          defaultStyleId: 0,
          speakerId: 'test-speaker-id',
          styles: {
            0: { styleName: 'れいせい' }
          }
        }
      },
    };
    await fs.writeFile(join(configSubDir, 'config.json'), JSON.stringify(config), 'utf8');

    // ConfigManagerを初期化
    const configManager = new ConfigManager(configSubDir);
    await configManager.buildDynamicConfig();

    // CharacterInfoServiceを初期化
    const characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(configManager);

    // OperatorManagerを生成（DI）
    operatorManager = new OperatorManager(configManager, characterInfoService);
    await operatorManager.initialize();
  });

  afterEach(async () => {
    // テストファイルのクリーンアップ
    try {
      await fs.unlink(testFilePath);
    } catch {
      // ファイルが存在しない場合は無視
    }

    // 一時ディレクトリをクリーンアップ
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  test('タイムアウトしたアサインは自動的にクリアされる', async () => {
    // 短いタイムアウト（100ms）でFileOperationManagerを作成
    const shortTimeoutStore = new FileOperationManager(
      testFilePath,
      testSessionId,
      100 // 100ms
    );

    // データを保存
    await shortTimeoutStore.store({
      characterId: 'tsukuyomi',
      styleId: 0,
      styleName: 'れいせい',
    });

    // 即座に読み込むと存在する
    let result = await shortTimeoutStore.restore();
    expect(result).not.toBeNull();
    expect(result?.characterId).toBe('tsukuyomi');

    // 150ms待機（タイムアウトを超える）
    await new Promise(resolve => setTimeout(resolve, 150));

    // タイムアウト後は自動的にクリアされている
    result = await shortTimeoutStore.restore();
    expect(result).toBeNull();
  });

  test('getCurrentOperatorSessionはタイムアウト後にnullを返す', async () => {
    // モックデータストアを使用するためのテスト用セットアップ
    const mockDataStore = {
      restore: vi.fn(),
      store: vi.fn(),
      remove: vi.fn(),
      refresh: vi.fn(),
      getOtherEntries: vi.fn(),
    };

    // 最初はオペレータが存在
    mockDataStore.restore.mockResolvedValueOnce({
      characterId: 'tsukuyomi',
      styleId: 0,
      styleName: 'れいせい',
    });

    // OperatorManagerのdataStoreをモックに置き換え
    (operatorManager as any).dataStore = mockDataStore;

    // 最初の呼び出しではオペレータが存在
    let session = await operatorManager.getCurrentOperatorSession();
    expect(session).not.toBeNull();
    expect(session?.characterId).toBe('tsukuyomi');

    // タイムアウト後はnullを返すように設定
    mockDataStore.restore.mockResolvedValueOnce(null);

    // タイムアウト後の呼び出しではnullが返される
    session = await operatorManager.getCurrentOperatorSession();
    expect(session).toBeNull();
  });

  test('showCurrentOperatorはタイムアウト後に「割り当てなし」メッセージを返す', async () => {
    // モックデータストアを使用
    const mockDataStore = {
      restore: vi.fn().mockResolvedValue(null), // タイムアウトでnullを返す
      store: vi.fn(),
      remove: vi.fn(),
      refresh: vi.fn(),
      getOtherEntries: vi.fn(),
    };

    (operatorManager as any).dataStore = mockDataStore;

    const status = await operatorManager.showCurrentOperator();
    expect(status.message).toBe('オペレータは割り当てられていません');
    expect(status.characterId).toBeUndefined();
  });

  test('タイムアウト境界での動作確認', async () => {
    const timeoutMs = 200;
    const boundaryStore = new FileOperationManager(
      testFilePath,
      testSessionId,
      timeoutMs
    );

    // データを保存
    await boundaryStore.store({
      characterId: 'dia',
      styleId: 3,
      styleName: 'のーまる',
    });

    // タイムアウトギリギリまで待機（180ms）
    await new Promise(resolve => setTimeout(resolve, 180));

    // まだ有効
    let result = await boundaryStore.restore();
    expect(result).not.toBeNull();
    expect(result?.characterId).toBe('dia');

    // さらに50ms待機（合計230ms > 200ms）
    await new Promise(resolve => setTimeout(resolve, 50));

    // タイムアウト
    result = await boundaryStore.restore();
    expect(result).toBeNull();
  });

  test('refreshでタイムアウトを延長できる', async () => {
    const timeoutMs = 200;
    const refreshStore = new FileOperationManager(
      testFilePath,
      testSessionId,
      timeoutMs
    );

    // データを保存
    await refreshStore.store({
      characterId: 'alma',
      styleId: 1,
      styleName: 'のーまる',
    });

    // 150ms待機
    await new Promise(resolve => setTimeout(resolve, 150));

    // タイムアウトを延長
    const refreshed = await refreshStore.refresh();
    expect(refreshed).toBe(true);

    // さらに150ms待機（リフレッシュなしなら合計300msでタイムアウト）
    await new Promise(resolve => setTimeout(resolve, 150));

    // リフレッシュしたのでまだ有効
    const result = await refreshStore.restore();
    expect(result).not.toBeNull();
    expect(result?.characterId).toBe('alma');
  });
});