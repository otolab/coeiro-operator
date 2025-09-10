/**
 * src/operator/file-operation-manager.ts: 汎用期限付きキーバリューストア
 * 任意のデータTを期限付きで管理する汎用ファイル操作システム
 */

import { readFile, writeFile, stat, unlink, rename, access } from 'fs/promises';
import { constants } from 'fs';

// 期限付きストレージ構造
interface StorageEntry<T> {
  data: T;
  updated_at: string; // ISO 8601形式
}

export interface TimedStorage<T> {
  storage: Record<string, StorageEntry<T>>;
}

export class FileOperationManager<T> {
  // ファイルロック設定
  private readonly maxLockRetries = 50;
  private readonly lockRetryDelay = 20; // ms
  private readonly lockTimeout = 2000; // ms

  constructor(
    private filePath: string,
    private key: string,
    private timeoutMs: number = 4 * 60 * 60 * 1000 // デフォルト4時間
  ) {}

  /**
   * JSONファイルを安全に読み込み
   */
  async readJsonFile<U>(filePath: string, defaultValue: U = {} as U): Promise<U> {
    try {
      await access(filePath, constants.F_OK);
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`ファイル読み込みエラー: ${filePath}, ${(error as Error).message}`);
      return defaultValue;
    }
  }

  /**
   * JSONファイルを安全に書き込み（アトミック操作）
   */
  async writeJsonFile<U = unknown>(filePath: string, data: U): Promise<void> {
    const tempFile = `${filePath}.tmp`;
    await writeFile(tempFile, JSON.stringify(data, null, 2), 'utf8');

    // ファイルが存在する場合のみ削除を試行
    try {
      await access(filePath, constants.F_OK);
      await unlink(filePath);
    } catch {
      // ファイルが存在しない場合は何もしない
    }

    await rename(tempFile, filePath);
  }

  /**
   * ファイルの存在確認
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイルを削除（存在しない場合はエラーを無視）
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * ファイルロックを取得してコールバック実行
   */
  async withFileLock<R>(callback: () => Promise<R>): Promise<R> {
    const lockFile = `${this.filePath}.lock`;

    for (let i = 0; i < this.maxLockRetries; i++) {
      try {
        // 古いロックファイルのクリーンアップ（タイムアウト処理）
        try {
          const stats = await stat(lockFile);
          const lockAge = Date.now() - stats.mtime.getTime();
          if (lockAge > this.lockTimeout) {
            console.warn(`Removing stale lock file: ${lockFile} (age: ${lockAge}ms)`);
            await this.deleteFile(lockFile);
          }
        } catch {
          // ロックファイルが存在しない場合は正常
        }

        // ロックファイル作成（排他的）
        await writeFile(lockFile, process.pid.toString(), { flag: 'wx' });

        try {
          // コールバック実行
          const result = await callback();
          return result;
        } finally {
          // ロック解除
          await this.deleteFile(lockFile);
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          // ロック競合 - 指数バックオフでリトライ
          const backoffDelay = this.lockRetryDelay * Math.min(Math.pow(1.5, i), 10);
          await new Promise(resolve => setTimeout(resolve, backoffDelay + Math.random() * 10));
          continue;
        }
        throw error;
      }
    }
    throw new Error(
      `Failed to acquire file lock after ${this.maxLockRetries} retries: ${this.filePath}`
    );
  }

  /**
   * ストレージの読み取り
   */
  private async read(defaultValue: TimedStorage<T>): Promise<TimedStorage<T>> {
    return this.readJsonFile<TimedStorage<T>>(this.filePath, defaultValue);
  }

  /**
   * ストレージの書き込み
   */
  private async write(data: TimedStorage<T>): Promise<void> {
    await this.writeJsonFile(this.filePath, data);
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  private cleanupExpired(state: TimedStorage<T>): TimedStorage<T> {
    const now = Date.now();
    const validStorage: Record<string, StorageEntry<T>> = {};

    for (const [k, entry] of Object.entries(state.storage)) {
      const age = now - new Date(entry.updated_at).getTime();
      if (age <= this.timeoutMs) {
        validStorage[k] = entry;
      }
    }

    return { storage: validStorage };
  }

  /**
   * ロック付きで操作を実行
   */
  private async withLock<R>(callback: (state: TimedStorage<T>) => Promise<R>): Promise<R> {
    return this.withFileLock(async () => {
      const state = await this.read({ storage: {} });
      return callback(state);
    });
  }

  /**
   * データの保存（期限付き）
   */
  async store(data: T): Promise<void> {
    await this.withLock(async state => {
      const cleaned = this.cleanupExpired(state);
      cleaned.storage[this.key] = {
        data,
        updated_at: new Date().toISOString(),
      };
      await this.write(cleaned);
    });
  }

  /**
   * データの復元
   */
  async restore(): Promise<T | null> {
    return this.withLock(async state => {
      const cleaned = this.cleanupExpired(state);
      await this.write(cleaned);
      const entry = cleaned.storage[this.key];
      return entry ? entry.data : null;
    });
  }

  /**
   * 期限の更新（現在時刻に延長）
   */
  async refresh(): Promise<boolean> {
    return this.withLock(async state => {
      const cleaned = this.cleanupExpired(state);
      const entry = cleaned.storage[this.key];
      if (entry) {
        entry.updated_at = new Date().toISOString();
        await this.write(cleaned);
        return true;
      }
      await this.write(cleaned);
      return false;
    });
  }

  /**
   * 自分以外の全データを取得
   */
  async getOtherEntries(): Promise<Record<string, T>> {
    return this.withLock(async state => {
      const cleaned = this.cleanupExpired(state);
      await this.write(cleaned);
      const result: Record<string, T> = {};
      for (const [k, entry] of Object.entries(cleaned.storage)) {
        if (k !== this.key) {
          result[k] = entry.data;
        }
      }
      return result;
    });
  }

  /**
   * 現在のキーのエントリを削除
   */
  async remove(): Promise<boolean> {
    return this.withLock(async state => {
      const cleaned = this.cleanupExpired(state);
      const existed = !!cleaned.storage[this.key];
      delete cleaned.storage[this.key];
      await this.write(cleaned);
      return existed;
    });
  }

  /**
   * 全データをクリア
   */
  async clear(): Promise<void> {
    await this.withLock(async () => {
      await this.write({ storage: {} });
    });
  }
}

export default FileOperationManager;
