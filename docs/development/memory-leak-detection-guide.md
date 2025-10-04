# メモリリーク検出ガイド

Issue #50の解決: Node.js GC制御による精密なメモリ測定手法

## 概要

従来のメモリリーク検出テストは、Node.jsのガベージコレクション（GC）仕様による不安定性で信頼性に欠けていました。本ガイドでは、Google Docsで提供された包括的なGC制御手法に基づく、精密なメモリリーク検出システムを実装しています。

## 問題の背景

### Issue #50: メモリ測定の不安定性

```
expected 14596008 to be less than 5242880
```

- **実測値**: 14.6MB
- **期待値**: 5MB以下  
- **問題**: 約3倍のメモリ使用量

### 根本原因

1. **Node.js GC仕様**: `process.memoryUsage().heapUsed`は累積使用量で、GCタイミングに依存
2. **テスト環境特性**: 他テストとの干渉、V8エンジンのメモリ管理戦略
3. **測定手法限界**: 単純な差分計算では正確なメモリリーク検知が困難

## 解決策: 精密メモリリーク検出システム

### 1. PreciseMemoryLeakDetector クラス

Google Docsガイドの「戦略1: テストスイートにおける自動差分測定」に基づく実装。

#### 主要機能

- **複数回フルGC**: `global.gc(true)`を複数回実行してクリーンなベースライン確立
- **安定化待機**: GC後のV8エンジン安定化のための短時間待機
- **詳細統計**: `v8.getHeapStatistics()`による低レベルメモリ情報取得
- **ヒープスナップショット**: Chrome DevTools分析用のスナップショット出力

#### 使用例

```typescript
import { PreciseMemoryLeakDetector } from './memory-leak-detector.js';

const detector = new PreciseMemoryLeakDetector(1); // 1MB閾値

// ベースライン確立
detector.establishBaseline();

// テスト処理実行
for (let i = 0; i < 100; i++) {
  await someOperation();
  if (i % 10 === 0) {
    detector.recordMeasurement();
  }
}

// 最終検出
const result = detector.detect();
// result.isLeakDetected でリークの有無を確認
// result.memoryGrowth でメモリ増加量を取得
```

### 2. MemoryPressureTester クラス

Google Docsガイドの「戦略3: メモリプレッシャーテスト」に基づく実装。

#### 機能

- **メモリ上限制御**: 指定したメモリ使用量上限での強制的リーク検出
- **段階的負荷**: 徐々にメモリ使用量を増加させてリークを顕在化
- **自動GC制御**: 定期的なGC実行でリークしているオブジェクトの確認

#### 使用例

```typescript
import { MemoryPressureTester } from './memory-leak-detector.js';

const tester = new MemoryPressureTester(30); // 30MB上限

const hasLeak = await tester.runPressureTest(async () => {
  await yourTestFunction();
});
// hasLeak がtrueの場合メモリリークが検出された
```

## 実行方法

### 1. 通常のテスト実行

```bash
# GCフラグ付きでテスト実行
NODE_OPTIONS="--expose-gc" pnpm test

# メモリリーク検出専用テスト
pnpm test:memory
```

### 2. 環境設定確認

```typescript
import { checkGCExposure } from './memory-leak-detector.js';

if (!checkGCExposure()) {
  throw new Error('GC not exposed - add --expose-gc flag');
}
```

### 3. Vitestでの自動GC有効化

`vitest.config.ts`でGCフラグが自動設定されます：

```typescript
export default defineConfig({
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        execArgv: ['--expose-gc']  // 自動的にGCを有効化
      }
    }
  }
});
```

## テスト実装パターン

### 基本的なメモリリークテスト

```typescript
test('メモリリークが発生しないこと', async () => {
  const detector = new PreciseMemoryLeakDetector(2); // 2MB閾値
  detector.establishBaseline();
  
  // テスト対象の処理
  for (let i = 0; i < 50; i++) {
    await targetFunction();
    if (i % 10 === 0) {
      detector.recordMeasurement();
    }
  }
  
  const result = detector.detect();
  expect(result.isLeakDetected).toBe(false);
});
```

### 既存テストの改善例

従来の手法：
```typescript
// ❌ 不安定な測定手法
const initialMemory = process.memoryUsage().heapUsed;
// ... テスト処理 ...
if (global.gc) global.gc(); // 1回のみGC
const finalMemory = process.memoryUsage().heapUsed;
expect(finalMemory - initialMemory).toBeLessThan(threshold);
```

改善された手法：
```typescript
// ✅ 精密な測定手法
if (!global.gc) return; // GCが利用できない場合はスキップ

// 複数回フルGCでベースライン確立
for (let i = 0; i < 3; i++) {
  global.gc(true);
  await new Promise(resolve => setTimeout(resolve, 50));
}

const initialMemory = process.memoryUsage().heapUsed;
// ... テスト処理 ...

// 最終的な複数回GC実行
for (let i = 0; i < 3; i++) {
  global.gc(true);
  await new Promise(resolve => setTimeout(resolve, 100));
}

const finalMemory = process.memoryUsage().heapUsed;
```

## Chrome DevTools連携

### ヒープスナップショット分析

```typescript
const detector = new PreciseMemoryLeakDetector(1);
detector.establishBaseline();

// テスト前のスナップショット
detector.writeHeapSnapshot('before-test.heapsnapshot');

// テスト処理
await runTest();

// テスト後のスナップショット  
detector.writeHeapSnapshot('after-test.heapsnapshot');

const result = detector.detect();
```

Chrome DevToolsでの分析手順：
1. `chrome://inspect` → Memory タブ
2. Load ボタンでスナップショットを読み込み
3. Comparison ビューで before/after を比較
4. Retained Size でメモリリークしているオブジェクトを特定

## パフォーマンス最適化

### テスト実行時間の短縮

- **反復回数削減**: 50回 → 30回
- **中間GC**: 10回ごとに実行
- **タイムアウト調整**: 15秒以内

### CI/CD環境での考慮事項

- **GCフラグ自動設定**: `vitest.config.ts`で制御
- **ログ出力**: 詳細な分析情報を出力
- **環境チェック**: GC利用不可時の適切なスキップ

## トラブルシューティング

### よくある問題

1. **GCが利用できない**
   ```
   Error: Garbage Collection not exposed
   ```
   **解決**: `--expose-gc`フラグを追加

2. **メモリ増加が検出される**
   ```
   Memory leak detected: 2.5MB increase
   ```
   **調査**: ヒープスナップショットで根本原因を分析

3. **テストの不安定性**
   **解決**: より多くのGCサイクル、長い安定化時間

### デバッグ用コマンド

```bash
# 詳細なGCログ付きでテスト実行
NODE_OPTIONS="--expose-gc --trace-gc" pnpm test:memory

# メモリ使用量上限を設定
NODE_OPTIONS="--expose-gc --max-old-space-size=100" pnpm test
```

## 関連リソース

- [Google Docs: Node.js GC制御ガイド](https://docs.google.com/document/d/10q76k1UCX3cKBjS7eEnHSZ2dSDm2GrhsG26_5yKiUWA/edit?usp=sharing)
- [Issue #50: パフォーマンステストでのメモリ測定が不安定](https://github.com/otolab/coeiro-operator/issues/50)
- [Chrome DevTools Memory タブ](https://developer.chrome.com/docs/devtools/memory/)

## まとめ

Issue #50の解決により、COEIRO Operatorプロジェクトは信頼性の高いメモリリーク検出システムを導入しました。この精密な測定手法により、メモリ関連の品質問題を早期発見し、長期稼働での安定性を確保できます。