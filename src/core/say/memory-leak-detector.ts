/**
 * memory-leak-detector.ts
 * Node.js GC制御による精密なメモリリーク検出システム
 * Issue #50: メモリ測定不安定性の解決
 * 
 * Googleドキュメントガイド準拠:
 * https://docs.google.com/document/d/10q76k1UCX3cKBjS7eEnHSZ2dSDm2GrhsG26_5yKiUWA/edit?usp=sharing
 */

import { logger } from '../../utils/logger.js';

/**
 * メモリ測定結果
 */
export interface MemoryMeasurement {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

/**
 * メモリリーク検出結果
 */
export interface MemoryLeakDetectionResult {
  isLeakDetected: boolean;
  memoryGrowth: number;
  memoryGrowthPercentage: number;
  baselineMemory: number;
  finalMemory: number;
  thresholdBytes: number;
  measurements: MemoryMeasurement[];
  gcCycles: number;
}

/**
 * 精密メモリリーク検出器
 * 戦略1: テストスイートにおける自動差分測定の実装
 */
export class PreciseMemoryLeakDetector {
  private baselineMemory: number = 0;
  private measurements: MemoryMeasurement[] = [];
  private gcCycles: number = 0;
  private thresholdBytes: number;
  
  /**
   * @param thresholdMB メモリ増加の閾値（MB）
   */
  constructor(thresholdMB: number = 1) {
    this.thresholdBytes = thresholdMB * 1024 * 1024;
    
    // global.gcの存在確認
    if (!global.gc) {
      throw new Error(
        'Garbage Collection not exposed. ' +
        'Run Node.js with --expose-gc flag or set NODE_OPTIONS="--expose-gc"'
      );
    }
  }

  /**
   * ベースライン測定の確立
   * クリーンなメモリ状態を保証するための初期化
   */
  establishBaseline(): void {
    logger.info('メモリリーク検出: ベースライン確立開始');
    
    // 複数回のフルGCでクリーンな状態を確保
    this.performMultipleGC(3);
    
    // 安定化のための待機
    this.waitForStabilization(100);
    
    // ベースライン測定
    const baseline = this.measureMemory();
    this.baselineMemory = baseline.heapUsed;
    this.measurements = [baseline];
    
    logger.info(`ベースライン確立完了: ${(this.baselineMemory / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 複数回のガベージコレクション実行
   * より確実なメモリ解放を保証
   */
  private performMultipleGC(cycles: number = 3): void {
    for (let i = 0; i < cycles; i++) {
      // フルGC実行（新旧両方の領域を対象）
      global.gc!(true);
      this.gcCycles++;
      
      // GC間の小さな待機
      this.waitForStabilization(50);
    }
    
    logger.debug(`${cycles}回のフルGC実行完了`);
  }

  /**
   * V8エンジンの安定化待機
   * GC後のメモリ状態安定化のための短時間待機
   */
  private waitForStabilization(ms: number): void {
    const start = Date.now();
    while (Date.now() - start < ms) {
      // ビジーウェイト（短時間のため許容）
    }
  }

  /**
   * 現在のメモリ使用量測定
   */
  private measureMemory(): MemoryMeasurement {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      timestamp: Date.now()
    };
  }

  /**
   * 中間測定ポイント記録
   * テスト実行中の任意のタイミングでメモリ状態を記録
   */
  recordMeasurement(): void {
    const measurement = this.measureMemory();
    this.measurements.push(measurement);
    
    logger.debug(`中間測定: ${(measurement.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  /**
   * 最終検出実行
   * テスト完了後のメモリリーク判定
   */
  detect(): MemoryLeakDetectionResult {
    logger.info('メモリリーク検出: 最終判定開始');
    
    // 最終測定前のクリーンアップ
    this.performMultipleGC(3);
    this.waitForStabilization(100);
    
    // 最終測定
    const finalMeasurement = this.measureMemory();
    this.measurements.push(finalMeasurement);
    
    // メモリ増加量計算
    const memoryGrowth = finalMeasurement.heapUsed - this.baselineMemory;
    const memoryGrowthPercentage = (memoryGrowth / this.baselineMemory) * 100;
    
    // リーク判定
    const isLeakDetected = memoryGrowth > this.thresholdBytes;
    
    const result: MemoryLeakDetectionResult = {
      isLeakDetected,
      memoryGrowth,
      memoryGrowthPercentage,
      baselineMemory: this.baselineMemory,
      finalMemory: finalMeasurement.heapUsed,
      thresholdBytes: this.thresholdBytes,
      measurements: [...this.measurements],
      gcCycles: this.gcCycles
    };
    
    // 結果ログ
    logger.info(`メモリリーク検出結果:`);
    logger.info(`- ベースライン: ${(result.baselineMemory / 1024 / 1024).toFixed(2)}MB`);
    logger.info(`- 最終メモリ: ${(result.finalMemory / 1024 / 1024).toFixed(2)}MB`);
    logger.info(`- メモリ増加: ${(result.memoryGrowth / 1024).toFixed(2)}KB (${result.memoryGrowthPercentage.toFixed(2)}%)`);
    logger.info(`- 閾値: ${(result.thresholdBytes / 1024).toFixed(2)}KB`);
    logger.info(`- リーク検出: ${isLeakDetected ? 'あり' : 'なし'}`);
    logger.info(`- GCサイクル: ${result.gcCycles}回`);
    
    return result;
  }

  /**
   * 詳細なメモリ統計情報の取得
   * V8固有の詳細データ（v8.getHeapStatistics()相当の情報）
   */
  getDetailedMemoryStats(): any {
    try {
      // v8モジュールが利用可能な場合は詳細統計を取得
      const v8 = require('v8');
      const heapStats = v8.getHeapStatistics();
      const heapSpaceStats = v8.getHeapSpaceStatistics();
      
      return {
        heap: heapStats,
        spaces: heapSpaceStats,
        memoryUsage: process.memoryUsage()
      };
    } catch (error) {
      // v8モジュールが利用できない場合は基本情報のみ
      return {
        memoryUsage: process.memoryUsage()
      };
    }
  }

  /**
   * ヒープスナップショット出力
   * Chrome DevTools分析用（開発・デバッグ時のみ使用）
   */
  writeHeapSnapshot(filename?: string): void {
    try {
      const v8 = require('v8');
      const fs = require('fs');
      
      const snapshotFile = filename || `heap-snapshot-${Date.now()}.heapsnapshot`;
      const snapshot = v8.writeHeapSnapshot(snapshotFile);
      
      logger.info(`ヒープスナップショット出力: ${snapshot}`);
    } catch (error) {
      logger.warn(`ヒープスナップショット出力失敗: ${(error as Error).message}`);
    }
  }

  /**
   * リセット
   * 同一インスタンスでの複数テスト実行時の状態クリア
   */
  reset(): void {
    this.baselineMemory = 0;
    this.measurements = [];
    this.gcCycles = 0;
    
    logger.debug('メモリリーク検出器リセット完了');
  }
}

/**
 * メモリプレッシャーテスト実行
 * 戦略3: メモリプレッシャーテスト（リークの強制）の実装
 */
export class MemoryPressureTester {
  private maxMemoryMB: number;
  
  constructor(maxMemoryMB: number = 50) {
    this.maxMemoryMB = maxMemoryMB;
  }

  /**
   * メモリプレッシャーテスト実行
   * 意図的にメモリ使用量を増加させ、リークの顕在化を試行
   */
  async runPressureTest(testFunction: () => Promise<void>): Promise<boolean> {
    logger.info(`メモリプレッシャーテスト開始 (上限: ${this.maxMemoryMB}MB)`);
    
    const detector = new PreciseMemoryLeakDetector(5); // 5MB閾値
    detector.establishBaseline();
    
    try {
      // プレッシャーループ
      let iteration = 0;
      while (iteration < 100) { // 最大100回まで
        await testFunction();
        iteration++;
        
        detector.recordMeasurement();
        
        const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        if (currentMemory > this.maxMemoryMB) {
          logger.warn(`メモリ上限到達: ${currentMemory.toFixed(2)}MB`);
          break;
        }
        
        // 10回ごとにGCを実行して、リークしているオブジェクトを確認
        if (iteration % 10 === 0) {
          global.gc!(true);
        }
      }
      
      const result = detector.detect();
      
      logger.info(`プレッシャーテスト完了: ${iteration}回実行`);
      return result.isLeakDetected;
      
    } catch (error) {
      logger.error(`プレッシャーテスト中にエラー: ${(error as Error).message}`);
      throw error;
    }
  }
}

/**
 * Node.js起動時の--expose-gc確認ユーティリティ
 */
export function checkGCExposure(): boolean {
  if (!global.gc) {
    console.warn('⚠️  global.gc() is not available');
    console.warn('Run Node.js with --expose-gc flag:');
    console.warn('  node --expose-gc script.js');
    console.warn('  npm test -- --node-options="--expose-gc"');
    console.warn('  NODE_OPTIONS="--expose-gc" npm test');
    return false;
  }
  
  console.log('✅ global.gc() is available');
  return true;
}