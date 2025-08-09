/**
 * Module Reloader
 * 動的モジュール再読み込み機能（rewireの代替）
 */

import { promises as fs } from 'fs';
import path from 'path';
import { DebugLogManager } from '../logger/index.js';

export interface ModuleReloadOptions {
  /**
   * 監視対象のファイル拡張子
   */
  watchExtensions?: string[];
  
  /**
   * 除外するディレクトリ
   */
  excludeDirs?: string[];
  
  /**
   * 自動リロードを有効にする
   */
  autoReload?: boolean;
  
  /**
   * ファイル変更監視のデバウンス時間（ms）
   */
  debounceMs?: number;
}

export interface ReloadEvent {
  type: 'file-changed' | 'dependency-changed' | 'manual-reload';
  filePath?: string;
  timestamp: Date;
  success: boolean;
  error?: Error;
}

export class ModuleReloader {
  private options: Required<ModuleReloadOptions>;
  private logManager: DebugLogManager;
  private watchers: Map<string, any> = new Map();
  private reloadCallbacks: Set<(event: ReloadEvent) => void> = new Set();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private lastReloadTime: Map<string, number> = new Map();

  constructor(options: ModuleReloadOptions = {}) {
    this.options = {
      watchExtensions: options.watchExtensions || ['.ts', '.js', '.json'],
      excludeDirs: options.excludeDirs || ['node_modules', '.git', 'dist', 'build'],
      autoReload: options.autoReload ?? true,
      debounceMs: options.debounceMs || 200
    };

    this.logManager = DebugLogManager.getInstance();
    this.setupLogging();
  }

  private setupLogging(): void {
    const logger = this.logManager.getLogger('reloader');
    logger.info('ModuleReloader initialized', {
      options: this.options
    });
  }

  /**
   * リロードイベントリスナーを追加
   */
  onReload(callback: (event: ReloadEvent) => void): void {
    this.reloadCallbacks.add(callback);
  }

  /**
   * リロードイベントリスナーを削除
   */
  offReload(callback: (event: ReloadEvent) => void): void {
    this.reloadCallbacks.delete(callback);
  }

  private emitReloadEvent(event: ReloadEvent): void {
    const logger = this.logManager.getLogger('reloader');
    logger.debug('Emitting reload event', event);

    for (const callback of this.reloadCallbacks) {
      try {
        callback(event);
      } catch (error) {
        logger.error('Error in reload callback', error);
      }
    }
  }

  /**
   * モジュールとその依存関係をクリア
   */
  private clearModuleCache(modulePath: string): void {
    const logger = this.logManager.getLogger('reloader');
    
    try {
      const fullPath = require.resolve(modulePath);
      
      // メインモジュールをクリア
      if (require.cache[fullPath]) {
        delete require.cache[fullPath];
        logger.debug('Cleared module from cache', { path: fullPath });
      }

      // 依存関係もクリア（オプション）
      this.clearDependentModules(fullPath);

    } catch (error) {
      logger.warn('Failed to resolve module path for cache clearing', { 
        modulePath, 
        error: (error as Error).message 
      });
    }
  }

  /**
   * 依存モジュールも含めてキャッシュクリア
   */
  private clearDependentModules(targetPath: string): void {
    const logger = this.logManager.getLogger('reloader');
    const cleared = new Set<string>();

    const clearRecursive = (modulePath: string) => {
      if (cleared.has(modulePath)) {
        return;
      }

      cleared.add(modulePath);
      const module = require.cache[modulePath];
      
      if (!module) {
        return;
      }

      // この段階で子モジュールを保存
      const children = [...(module.children || [])];
      
      // キャッシュから削除
      delete require.cache[modulePath];
      
      // 子モジュールも再帰的にクリア（プロジェクト内のもののみ）
      for (const child of children) {
        if (this.isProjectModule(child.filename)) {
          clearRecursive(child.filename);
        }
      }
    };

    clearRecursive(targetPath);
    logger.debug('Cleared dependent modules', { 
      targetPath, 
      clearedCount: cleared.size 
    });
  }

  /**
   * プロジェクト内のモジュールかどうかを判定
   */
  private isProjectModule(filePath: string): boolean {
    // node_modules 内のモジュールは除外
    if (filePath.includes('node_modules')) {
      return false;
    }

    // 除外ディレクトリのチェック
    for (const excludeDir of this.options.excludeDirs) {
      if (filePath.includes(excludeDir)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 手動でモジュールをリロード
   */
  async reloadModule(modulePath: string): Promise<any> {
    const logger = this.logManager.getLogger('reloader');
    const startTime = Date.now();

    try {
      logger.info('Manual module reload', { modulePath });

      // キャッシュクリア
      this.clearModuleCache(modulePath);

      // モジュールを再インポート
      const reloadedModule = await import(`${modulePath}?t=${Date.now()}`);
      
      const reloadEvent: ReloadEvent = {
        type: 'manual-reload',
        filePath: modulePath,
        timestamp: new Date(),
        success: true
      };

      this.lastReloadTime.set(modulePath, Date.now());
      this.emitReloadEvent(reloadEvent);

      logger.info('Module reloaded successfully', {
        modulePath,
        duration: Date.now() - startTime,
        exports: Object.keys(reloadedModule)
      });

      return reloadedModule;

    } catch (error) {
      const reloadEvent: ReloadEvent = {
        type: 'manual-reload',
        filePath: modulePath,
        timestamp: new Date(),
        success: false,
        error: error as Error
      };

      this.emitReloadEvent(reloadEvent);
      logger.error('Module reload failed', error);
      throw error;
    }
  }

  /**
   * ファイル監視を開始
   */
  async startWatching(targetPath: string): Promise<void> {
    if (!this.options.autoReload) {
      return;
    }

    const logger = this.logManager.getLogger('reloader');
    
    try {
      const stats = await fs.stat(targetPath);
      
      if (stats.isFile()) {
        await this.watchFile(targetPath);
      } else if (stats.isDirectory()) {
        await this.watchDirectory(targetPath);
      }

      logger.info('Started watching', { targetPath });

    } catch (error) {
      logger.error('Failed to start watching', { targetPath, error });
      throw error;
    }
  }

  /**
   * ファイル監視
   */
  private async watchFile(filePath: string): Promise<void> {
    const logger = this.logManager.getLogger('reloader');
    
    if (this.watchers.has(filePath)) {
      return;
    }

    try {
      const chokidar = await import('chokidar' as any).catch(() => null);
      if (chokidar) {
        const watcher = chokidar.watch(filePath, {
          ignoreInitial: true,
          persistent: true
        });

        watcher.on('change', (path: string) => {
          this.handleFileChange(path);
        });

        watcher.on('error', (error: Error) => {
          logger.error('File watcher error', { filePath, error });
        });

        this.watchers.set(filePath, watcher);
        logger.debug('Started watching file', { filePath });
      } else {
        throw new Error('chokidar not available');
      }

    } catch (error) {
      // chokidar が利用できない場合は fs.watchFile を使用
      logger.warn('chokidar not available, using fs.watchFile', { filePath });
      
      (await import('fs')).watchFile(filePath, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          this.handleFileChange(filePath);
        }
      });
    }
  }

  /**
   * ディレクトリ監視
   */
  private async watchDirectory(dirPath: string): Promise<void> {
    const logger = this.logManager.getLogger('reloader');
    
    try {
      const chokidar = await import('chokidar' as any).catch(() => null);
      if (chokidar) {
        const watcher = chokidar.watch(dirPath, {
          ignored: this.options.excludeDirs.map(dir => `**/${dir}/**`),
          ignoreInitial: true,
          persistent: true
        });

        watcher.on('change', (path: string) => {
          if (this.shouldWatchFile(path)) {
            this.handleFileChange(path);
          }
        });

        watcher.on('error', (error: Error) => {
          logger.error('Directory watcher error', { dirPath, error });
        });

        this.watchers.set(dirPath, watcher);
        logger.debug('Started watching directory', { dirPath });
      } else {
        logger.warn('chokidar not available, directory watching disabled', { dirPath });
      }

    } catch (error) {
      logger.error('Failed to watch directory', { dirPath, error });
    }
  }

  /**
   * ファイルが監視対象かどうかを判定
   */
  private shouldWatchFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return this.options.watchExtensions.includes(ext);
  }

  /**
   * ファイル変更ハンドラー
   */
  private handleFileChange(filePath: string): void {
    const logger = this.logManager.getLogger('reloader');
    
    // デバウンス処理
    const existingTimer = this.debounceTimers.get(filePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(filePath);
      
      // 最近リロードされた場合はスキップ
      const lastReload = this.lastReloadTime.get(filePath) || 0;
      if (Date.now() - lastReload < this.options.debounceMs) {
        return;
      }

      try {
        logger.info('File changed, triggering reload', { filePath });
        
        // キャッシュクリア
        this.clearModuleCache(filePath);

        const reloadEvent: ReloadEvent = {
          type: 'file-changed',
          filePath,
          timestamp: new Date(),
          success: true
        };

        this.lastReloadTime.set(filePath, Date.now());
        this.emitReloadEvent(reloadEvent);

      } catch (error) {
        const reloadEvent: ReloadEvent = {
          type: 'file-changed',
          filePath,
          timestamp: new Date(),
          success: false,
          error: error as Error
        };

        this.emitReloadEvent(reloadEvent);
        logger.error('Auto-reload failed', error);
      }
    }, this.options.debounceMs);

    this.debounceTimers.set(filePath, timer);
  }

  /**
   * 監視を停止
   */
  async stopWatching(): Promise<void> {
    const logger = this.logManager.getLogger('reloader');
    
    for (const [path, watcher] of this.watchers) {
      try {
        if (typeof watcher.close === 'function') {
          await watcher.close();
        } else if (typeof watcher.unwatch === 'function') {
          watcher.unwatch();
        }
        logger.debug('Stopped watching', { path });
      } catch (error) {
        logger.error('Error stopping watcher', { path, error });
      }
    }

    this.watchers.clear();
    
    // デバウンスタイマーをクリア
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    logger.info('Stopped all watchers');
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    watchedPaths: string[];
    reloadCounts: { [path: string]: number };
    lastReloadTimes: { [path: string]: Date };
  } {
    const reloadCounts: { [path: string]: number } = {};
    const lastReloadTimes: { [path: string]: Date } = {};

    for (const [path, time] of this.lastReloadTime.entries()) {
      lastReloadTimes[path] = new Date(time);
      reloadCounts[path] = (reloadCounts[path] || 0) + 1;
    }

    return {
      watchedPaths: Array.from(this.watchers.keys()),
      reloadCounts,
      lastReloadTimes
    };
  }

  /**
   * クリーンアップ
   */
  async cleanup(): Promise<void> {
    await this.stopWatching();
    this.reloadCallbacks.clear();
    this.lastReloadTime.clear();
  }
}