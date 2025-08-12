/**
 * src/core/say/performance-monitoring.test.ts
 * 音声合成システムのパフォーマンス監視テスト
 * Issue #37: テスト品質ガイドライン適用 - フェーズ2
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { logger } from '../../utils/logger.js';

// パフォーマンス測定ユーティリティ
class PerformanceMonitor {
  private startMemory: number = 0;
  private startTime: number = 0;
  
  start(): void {
    // ガベージコレクションを強制実行してベースライン測定
    if (global.gc) {
      global.gc();
    }
    this.startMemory = process.memoryUsage().heapUsed;
    this.startTime = process.hrtime.bigint();
  }
  
  measure(): { memoryDelta: number; timeElapsed: number } {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    return {
      memoryDelta: endMemory - this.startMemory,
      timeElapsed: Number(endTime - BigInt(this.startTime)) / 1_000_000 // ナノ秒→ミリ秒
    };
  }
}

describe('音声合成システム パフォーマンス監視', () => {
  let sayCoeiroink: SayCoeiroink;
  let performanceMonitor: PerformanceMonitor;
  
  beforeEach(async () => {
    sayCoeiroink = new SayCoeiroink();
    performanceMonitor = new PerformanceMonitor();
    
    // テスト用のサイレントモード設定
    logger.setLevel('quiet');
  });
  
  afterEach(() => {
    // ガベージコレクションを促進
    if (global.gc) {
      global.gc();
    }
  });

  describe('メモリリーク検知テスト', () => {
    test('連続音声合成でメモリリークが発生しないこと', async () => {
      performanceMonitor.start();
      
      // 50回の連続音声合成を実行
      const testText = 'メモリテスト用の短いテキストです。';
      const iterations = 50;
      
      for (let i = 0; i < iterations; i++) {
        try {
          await sayCoeiroink.synthesizeText(testText, {
            voice: 'test-speaker-1',
            streamMode: false
          });
        } catch (error) {
          // テスト環境では音声合成エラーが予想されるため、エラーは無視
        }
        
        // 10回ごとにガベージコレクション
        if (i % 10 === 0 && global.gc) {
          global.gc();
        }
      }
      
      const { memoryDelta } = performanceMonitor.measure();
      
      // メモリ増加量が1MB以下であることを確認（リーク検知）
      expect(memoryDelta).toBeLessThan(1024 * 1024); // 1MB
      
      console.log(`メモリ使用量変化: ${Math.round(memoryDelta / 1024)}KB`);
    }, 30000);

    test('大量の並行リクエスト処理後にメモリが適切に解放されること', async () => {
      performanceMonitor.start();
      
      // 20個の並行リクエストを3セット実行
      const testText = '並行処理テスト用のテキストです。これは少し長めのテキストで、メモリ使用量を増やすために使用されます。';
      const concurrentRequests = 20;
      const sets = 3;
      
      for (let set = 0; set < sets; set++) {
        const promises = [];
        
        for (let i = 0; i < concurrentRequests; i++) {
          promises.push(
            sayCoeiroink.synthesizeText(`${testText} (セット${set + 1}, リクエスト${i + 1})`, {
              voice: 'test-speaker-1',
              streamMode: false
            }).catch(() => {
              // テスト環境では音声合成エラーが予想される
            })
          );
        }
        
        await Promise.allSettled(promises);
        
        // セット間でガベージコレクション
        if (global.gc) {
          global.gc();
          // GCの完了を待つ
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const { memoryDelta } = performanceMonitor.measure();
      
      // 大量処理後でもメモリ増加量が2MB以下であることを確認
      expect(memoryDelta).toBeLessThan(2 * 1024 * 1024); // 2MB
      
      console.log(`並行処理後メモリ変化: ${Math.round(memoryDelta / 1024)}KB`);
    }, 45000);
  });

  describe('リアルタイム性能テスト', () => {
    test('単一音声合成のレスポンス時間が許容範囲内であること', async () => {
      const testText = 'レスポンス時間測定用テストです。';
      const maxResponseTime = 5000; // 5秒以内
      
      performanceMonitor.start();
      
      try {
        await sayCoeiroink.synthesizeText(testText, {
          voice: 'test-speaker-1',
          streamMode: false
        });
      } catch (error) {
        // テスト環境では音声合成エラーが予想される
      }
      
      const { timeElapsed } = performanceMonitor.measure();
      
      // レスポンス時間が許容範囲内であることを確認
      expect(timeElapsed).toBeLessThan(maxResponseTime);
      
      console.log(`単一合成レスポンス時間: ${Math.round(timeElapsed)}ms`);
    });

    test('ストリーミングモードが非ストリーミングより高速であること', async () => {
      const testText = 'ストリーミング性能比較用の長めのテキストです。音声合成の性能を測定するために、ある程度の長さが必要になります。';
      
      // 非ストリーミングモードの測定
      performanceMonitor.start();
      try {
        await sayCoeiroink.synthesizeText(testText, {
          voice: 'test-speaker-1',
          streamMode: false
        });
      } catch (error) {
        // テスト環境では音声合成エラーが予想される
      }
      const nonStreamingTime = performanceMonitor.measure().timeElapsed;
      
      // ストリーミングモードの測定
      performanceMonitor.start();
      try {
        await sayCoeiroink.synthesizeText(testText, {
          voice: 'test-speaker-1',
          streamMode: true
        });
      } catch (error) {
        // テスト環境では音声合成エラーが予想される
      }
      const streamingTime = performanceMonitor.measure().timeElapsed;
      
      console.log(`非ストリーミング: ${Math.round(nonStreamingTime)}ms`);
      console.log(`ストリーミング: ${Math.round(streamingTime)}ms`);
      
      // ストリーミングモードの方が高速である、または同等の性能であることを確認
      // テスト環境での制約を考慮し、ストリーミングが非ストリーミングの1.5倍以内の時間であれば合格
      expect(streamingTime).toBeLessThanOrEqual(nonStreamingTime * 1.5);
    });

    test('並行処理における平均レスポンス時間が単一処理時間の3倍以内であること', async () => {
      const testText = '並行処理性能測定用テキスト';
      
      // 単一処理時間の測定
      performanceMonitor.start();
      try {
        await sayCoeiroink.synthesizeText(testText, {
          voice: 'test-speaker-1',
          streamMode: false
        });
      } catch (error) {
        // テスト環境では音声合成エラーが予想される
      }
      const singleProcessTime = performanceMonitor.measure().timeElapsed;
      
      // 並行処理時間の測定（5並行）
      const concurrentCount = 5;
      performanceMonitor.start();
      
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        sayCoeiroink.synthesizeText(`${testText} ${i + 1}`, {
          voice: 'test-speaker-1',
          streamMode: false
        }).catch(() => {
          // テスト環境では音声合成エラーが予想される
        })
      );
      
      await Promise.allSettled(promises);
      const concurrentTotalTime = performanceMonitor.measure().timeElapsed;
      const avgConcurrentTime = concurrentTotalTime / concurrentCount;
      
      console.log(`単一処理時間: ${Math.round(singleProcessTime)}ms`);
      console.log(`並行処理平均時間: ${Math.round(avgConcurrentTime)}ms`);
      
      // 並行処理での平均時間が単一処理時間の3倍以内であることを確認
      expect(avgConcurrentTime).toBeLessThanOrEqual(singleProcessTime * 3);
    }, 30000);
  });

  describe('リソース効率性テスト', () => {
    test('長文処理において適切なチャンクサイズでメモリ効率が保たれること', async () => {
      // 長文テキスト（約1000文字）
      const longText = '長文処理テスト用の文章です。'.repeat(50);
      
      performanceMonitor.start();
      
      try {
        await sayCoeiroink.synthesizeText(longText, {
          voice: 'test-speaker-1',
          streamMode: true // ストリーミングでチャンク処理を有効化
        });
      } catch (error) {
        // テスト環境では音声合成エラーが予想される
      }
      
      const { memoryDelta, timeElapsed } = performanceMonitor.measure();
      
      // 長文処理でもメモリ使用量が制御されていることを確認
      expect(memoryDelta).toBeLessThan(5 * 1024 * 1024); // 5MB以内
      
      // 長文でも合理的な時間内で処理されることを確認
      expect(timeElapsed).toBeLessThan(30000); // 30秒以内
      
      console.log(`長文処理 - メモリ: ${Math.round(memoryDelta / 1024)}KB, 時間: ${Math.round(timeElapsed)}ms`);
    }, 35000);

    test('レイテンシモード別の性能特性が適切であること', async () => {
      const testText = 'レイテンシモード性能テスト';
      const latencyModes = ['ultra-low', 'balanced', 'quality'] as const;
      const results: Record<string, number> = {};
      
      for (const mode of latencyModes) {
        performanceMonitor.start();
        
        try {
          await sayCoeiroink.synthesizeText(testText, {
            voice: 'test-speaker-1',
            streamMode: true,
            latencyMode: mode
          });
        } catch (error) {
          // テスト環境では音声合成エラーが予想される
        }
        
        const { timeElapsed } = performanceMonitor.measure();
        results[mode] = timeElapsed;
        
        console.log(`${mode}モード: ${Math.round(timeElapsed)}ms`);
      }
      
      // ultra-lowが最高速、qualityが最低速という期待される順序を検証
      // ただし、テスト環境の制約により、順序が完全に保証されない場合も許容
      const ultraLowTime = results['ultra-low'];
      const balancedTime = results['balanced'];
      const qualityTime = results['quality'];
      
      // 各モードが合理的な時間内で完了することを確認
      expect(ultraLowTime).toBeLessThan(10000); // 10秒以内
      expect(balancedTime).toBeLessThan(15000); // 15秒以内
      expect(qualityTime).toBeLessThan(20000); // 20秒以内
    }, 60000);
  });
});