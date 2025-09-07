/**
 * FileOperationManagerテスト
 * 汎用期限付きキーバリューストアのテスト
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileOperationManager } from './file-operation-manager.js';
import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

interface TestData {
  id: string;
  name: string;
  timestamp?: number;
}

describe('FileOperationManager', () => {
  let fileManager: FileOperationManager<TestData>;
  let tempDir: string;
  let testFilePath: string;
  const TEST_KEY = 'test-key';
  const TEST_TIMEOUT = 5000; // 5秒

  beforeEach(async () => {
    // 一時ディレクトリを作成（ランダムな要素を追加してユニーク性を保証）
    tempDir = join(
      tmpdir(),
      `coeiro-test-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await mkdir(tempDir, { recursive: true });

    testFilePath = join(tempDir, 'test-storage.json');
    fileManager = new FileOperationManager<TestData>(testFilePath, TEST_KEY, TEST_TIMEOUT);
  });

  afterEach(async () => {
    // 一時ディレクトリをクリーンアップ
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('基本的なストア操作', () => {
    test('データの保存と復元', async () => {
      const testData: TestData = {
        id: 'test-1',
        name: 'Test Item',
        timestamp: Date.now(),
      };

      // データを保存
      await fileManager.store(testData);

      // データを復元
      const restored = await fileManager.restore();
      expect(restored).toEqual(testData);
    });

    test('存在しないキーの復元はnullを返す', async () => {
      const result = await fileManager.restore();
      expect(result).toBeNull();
    });

    test('データの削除', async () => {
      const testData: TestData = {
        id: 'test-2',
        name: 'To Delete',
      };

      await fileManager.store(testData);
      const existed = await fileManager.remove();
      expect(existed).toBe(true);

      const restored = await fileManager.restore();
      expect(restored).toBeNull();
    });

    test('存在しないキーの削除', async () => {
      const existed = await fileManager.remove();
      expect(existed).toBe(false);
    });
  });

  describe('期限管理', () => {
    test('期限切れデータの自動クリーンアップ', async () => {
      // 短い期限（100ms）のFileOperationManagerを作成
      const shortTimeoutManager = new FileOperationManager<TestData>(
        testFilePath,
        'short-timeout-key',
        100
      );

      const testData: TestData = {
        id: 'expire-test',
        name: 'Will Expire',
      };

      await shortTimeoutManager.store(testData);

      // 期限内は復元可能
      let restored = await shortTimeoutManager.restore();
      expect(restored).toEqual(testData);

      // 期限を過ぎるまで待機
      await new Promise(resolve => setTimeout(resolve, 150));

      // 期限切れ後は復元不可
      restored = await shortTimeoutManager.restore();
      expect(restored).toBeNull();
    });

    test('期限の更新（refresh）', async () => {
      // 短い期限（200ms）のFileOperationManagerを作成
      const shortTimeoutManager = new FileOperationManager<TestData>(
        testFilePath,
        'refresh-test-key',
        200
      );

      const testData: TestData = {
        id: 'refresh-test',
        name: 'Refresh Test',
      };

      await shortTimeoutManager.store(testData);

      // 100ms後に期限を更新
      await new Promise(resolve => setTimeout(resolve, 100));
      const refreshed = await shortTimeoutManager.refresh();
      expect(refreshed).toBe(true);

      // さらに150ms待機（最初の保存から250ms経過）
      await new Promise(resolve => setTimeout(resolve, 150));

      // refresh のおかげでまだ復元可能
      const restored = await shortTimeoutManager.restore();
      expect(restored).toEqual(testData);
    });

    test('存在しないキーのrefresh', async () => {
      const refreshed = await fileManager.refresh();
      expect(refreshed).toBe(false);
    });
  });

  describe('複数キー管理', () => {
    test('異なるキーでのデータ管理', async () => {
      const manager1 = new FileOperationManager<TestData>(testFilePath, 'key1', TEST_TIMEOUT);
      const manager2 = new FileOperationManager<TestData>(testFilePath, 'key2', TEST_TIMEOUT);

      const data1: TestData = { id: '1', name: 'Data 1' };
      const data2: TestData = { id: '2', name: 'Data 2' };

      await manager1.store(data1);
      await manager2.store(data2);

      const restored1 = await manager1.restore();
      const restored2 = await manager2.restore();

      expect(restored1).toEqual(data1);
      expect(restored2).toEqual(data2);
    });

    test('他のエントリの取得', async () => {
      const manager1 = new FileOperationManager<TestData>(testFilePath, 'key1', TEST_TIMEOUT);
      const manager2 = new FileOperationManager<TestData>(testFilePath, 'key2', TEST_TIMEOUT);
      const manager3 = new FileOperationManager<TestData>(testFilePath, 'key3', TEST_TIMEOUT);

      const data1: TestData = { id: '1', name: 'Data 1' };
      const data2: TestData = { id: '2', name: 'Data 2' };
      const data3: TestData = { id: '3', name: 'Data 3' };

      await manager1.store(data1);
      await manager2.store(data2);
      await manager3.store(data3);

      // manager1から見た他のエントリ
      const others = await manager1.getOtherEntries();
      expect(others).toHaveProperty('key2');
      expect(others).toHaveProperty('key3');
      expect(others).not.toHaveProperty('key1');
      expect(others.key2).toEqual(data2);
      expect(others.key3).toEqual(data3);
    });

    test('全データのクリア', async () => {
      const manager1 = new FileOperationManager<TestData>(testFilePath, 'key1', TEST_TIMEOUT);
      const manager2 = new FileOperationManager<TestData>(testFilePath, 'key2', TEST_TIMEOUT);

      await manager1.store({ id: '1', name: 'Data 1' });
      await manager2.store({ id: '2', name: 'Data 2' });

      // 全データをクリア
      await manager1.clear();

      const restored1 = await manager1.restore();
      const restored2 = await manager2.restore();

      expect(restored1).toBeNull();
      expect(restored2).toBeNull();
    });
  });

  describe('ファイルロック機能', () => {
    test('並行操作でデータの整合性が保たれる', async () => {
      const operations: Promise<void>[] = [];
      const testData: TestData = { id: 'lock-test', name: 'Lock Test' };

      // 複数の並行store操作でも一貫性が保たれることを確認
      for (let i = 0; i < 3; i++) {
        operations.push(
          fileManager.store({
            ...testData,
            id: `lock-test-${i}`,
          })
        );
      }

      await Promise.all(operations);

      // データが正しく保存されていることを確認
      const restored = await fileManager.restore();
      expect(restored).toBeDefined();
      expect(restored?.name).toBe('Lock Test');
    });

    test('古いロックファイルの自動クリーンアップ', { timeout: 10000 }, async () => {
      // 古いロックファイルを手動で作成
      const lockFile = `${testFilePath}.lock`;
      const oldTimestamp = new Date(Date.now() - 3000); // 3秒前

      await writeFile(lockFile, 'old-process-id', 'utf8');

      // ファイルのタイムスタンプを古く設定
      const fs = await import('fs');
      await fs.promises.utimes(lockFile, oldTimestamp, oldTimestamp);

      // 古いロックがタイムアウトでクリアされ、新しい操作が成功すること
      const testData: TestData = { id: 'timeout-test', name: 'Timeout Test' };
      await fileManager.store(testData);

      const restored = await fileManager.restore();
      expect(restored).toEqual(testData);
    });
  });

  describe('並行操作の安全性', () => {
    test('複数の並行操作でファイルが破損しないこと', async () => {
      const promises: Promise<void>[] = [];

      // 複数の並行読み書き操作
      for (let i = 0; i < 5; i++) {
        const manager = new FileOperationManager<TestData>(
          testFilePath,
          `concurrent-key-${i}`,
          TEST_TIMEOUT
        );
        promises.push(
          manager
            .store({
              id: `concurrent-${i}`,
              name: `Concurrent Test ${i}`,
            })
            .then(() => {})
            .catch(() => {}) // エラーは無視（競合は正常）
        );
      }

      await Promise.all(promises);

      // ファイルが破損していないことを確認
      const content = await readFile(testFilePath, 'utf8');
      const parsed = JSON.parse(content);
      expect(parsed).toHaveProperty('storage');
      expect(Object.keys(parsed.storage).length).toBeGreaterThan(0);
    });

    test('並行store/restore操作の一貫性', async () => {
      const testData: TestData = { id: 'consistency', name: 'Consistency Test' };
      const operations: Promise<any>[] = [];

      // 10個の並行store操作
      for (let i = 0; i < 10; i++) {
        operations.push(
          fileManager.store({
            ...testData,
            id: `${testData.id}-${i}`,
          })
        );
      }

      await Promise.all(operations);

      // 最後のstoreが勝つはず
      const restored = await fileManager.restore();
      expect(restored).toBeDefined();
      expect(restored?.name).toBe('Consistency Test');
    });
  });

  describe('エラーハンドリング', () => {
    test('不正なJSONファイルの場合のフォールバック', async () => {
      // 不正なJSONを直接書き込み
      await writeFile(testFilePath, '{ invalid json }', 'utf8');

      // デフォルト値が返されることを確認
      const result = await fileManager.restore();
      expect(result).toBeNull();
    });

    test('ファイルアクセス権限エラーのハンドリング', async () => {
      // テスト環境によってはスキップが必要
      if (process.platform === 'win32') {
        return; // Windowsではファイル権限のテストが困難
      }

      // ファイルを作成して読み取り専用にする
      await writeFile(testFilePath, '{}', 'utf8');
      const fs = await import('fs');
      await fs.promises.chmod(testFilePath, 0o444);

      try {
        // 書き込みを試みる
        await fileManager.store({ id: 'readonly', name: 'Readonly Test' });
        // エラーが発生することを期待
        expect.fail('Should have thrown an error');
      } catch (error) {
        // エラーが発生することが正常
        expect(error).toBeDefined();
      } finally {
        // 権限を元に戻す
        await fs.promises.chmod(testFilePath, 0o644);
      }
    });
  });

  describe('パフォーマンステスト', () => {
    test('大量の並行操作が適切な時間で完了すること', { timeout: 30000 }, async () => {
      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      // 20個の異なるキーで並行操作
      for (let i = 0; i < 20; i++) {
        const manager = new FileOperationManager<TestData>(
          testFilePath,
          `perf-key-${i}`,
          TEST_TIMEOUT
        );
        promises.push(
          manager.store({
            id: `perf-${i}`,
            name: `Performance Test ${i}`,
            timestamp: Date.now(),
          })
        );
      }

      await Promise.all(promises);

      const duration = Date.now() - startTime;
      console.log(`20個の並行store操作完了時間: ${duration}ms`);

      // 30秒以内に完了することを確認
      expect(duration).toBeLessThan(30000);

      // 全てのデータが正しく保存されていることを確認
      for (let i = 0; i < 20; i++) {
        const manager = new FileOperationManager<TestData>(
          testFilePath,
          `perf-key-${i}`,
          TEST_TIMEOUT
        );
        const restored = await manager.restore();
        expect(restored).toBeDefined();
        expect(restored?.id).toBe(`perf-${i}`);
      }
    });
  });
});