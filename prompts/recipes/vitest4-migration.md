# Vitest 4 移行ガイド

## 概要
Vitest 3.x から 4.x への移行における仕様変更と対応方法。Node.js ESMローダーとの互換性向上、プールシステムの刷新が主な変更点。

## 主要な仕様変更

### 1. Tinypool依存の完全削除とプールシステム刷新
**背景**: Vitest 4ではTinypoolへの依存を完全に削除し、独自のプールシステムに移行

**影響**:
- `singleFork`オプションが廃止
- `poolOptions.forks.singleFork`は使用不可
- モジュール分離の挙動が変更

**対応**:
- `singleFork: true`を設定から削除
- `pool: 'forks'`のみを使用（必要に応じて）
- `maxWorkers`や`isolate`でワーカー制御を行う

**理由**:
- Tinypoolのメンテナンス問題
- Node.js v22以降のESMローダーとの互換性向上
- より安定したテスト実行環境の実現

### 2. ESMローダーの挙動変更
**背景**: Node.js v22のESMローダーフックとの互換性が改善

**Vitest 3での問題**:
- `singleFork: true` + Node.js v22で交互失敗パターン発生
- ESMローダーの`load`フックが`undefined`を返すエラー（ERR_INVALID_RETURN_PROPERTY_VALUE）
- テストが成功と失敗を交互に繰り返す不安定な挙動

**Vitest 4での改善**:
- プールシステムの刷新により、ESMローダーエラーが解消
- テスト実行の安定性が向上
- モジュール分離がより確実に動作

### 3. Automocked Gettersの挙動変更
**背景**: vi.mock()によるオートモックのgetter処理が変更

**Vitest 3の挙動**:
- automocked gettersは元のgetterを呼び出していた
- `vi.mock('fs')`後も`fs.promises`（getter）にアクセス可能

**Vitest 4の挙動**:
- automocked gettersは`undefined`を返す
- `fs.promises`のような getterプロパティは直接アクセス不可

**対応方法**:
- getterプロパティを含むモジュールは直接インポート
- `import fs from 'fs'` → `import fs from 'fs'; import * as fsPromises from 'fs/promises'`
- テストコードで`fs.promises`の代わりに`fsPromises`を使用

**該当するケース**:
- `fs.promises`（Node.jsの標準モジュール）
- カスタムクラスのgetterプロパティ
- Proxyベースのモジュール

### 4. コンストラクタモックの厳格化
**背景**: クラスコンストラクタのモック時の型チェックが厳格化

**Vitest 3の挙動**:
- アロー関数でもコンストラクタとして扱われていた
- `() => mockInstance`が動作

**Vitest 4の挙動**:
- `function`キーワードまたは`class`キーワードが必須
- アロー関数は「not a constructor」エラー

**対応方法**:
- アロー関数を`function`キーワードに変更
- `() => mockInstance` → `function() { return mockInstance; }`
- またはクラス構文を使用

**JavaScript仕様との整合性**:
- ES6仕様上、アロー関数は`[[Construct]]`内部メソッドを持たない
- Vitest 4はこの仕様により忠実に従うよう変更

### 5. グローバルモックのクリーンアップ
**背景**: `vi.stubGlobal()`のライフサイクル管理の明確化

**新機能**: `unstubGlobals`設定オプション
- デフォルト: `false`
- `true`に設定すると、各テストファイル後に自動的にグローバルモックをクリーンアップ

**使用上の注意**:
- `unstubGlobals: true`を有効化した場合、モジュールレベルの`vi.stubGlobal()`は次のテストファイルに影響しない
- グローバルモックは`beforeEach`内で設定することを推奨
- テストファイル間でのグローバル状態汚染を防止

**典型的な問題パターン**:
```
// モジュールレベル（各テストファイル）
vi.stubGlobal('fetch', vi.fn());  // unstubGlobals: trueで次のファイルに影響しない
```

**推奨パターン**:
```
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());  // 各テストで明示的に設定
});
```

## テストの独立性確保

### グローバルシングルトンの扱い
**問題**: モジュールレベルのシングルトン変数がテスト間で共有される

**症状**:
- テスト単独では成功するが、複数テスト実行時に失敗
- 実行順序によって結果が変わる
- 前のテストの状態が次のテストに影響

**対応パターン1: リセット関数の提供**
```
// 実装側でリセット関数を用意
let globalInstance: SomeService | null = null;

export function resetGlobalInstance(): void {
  globalInstance = null;
}
```

**対応パターン2: vitest.setup.tsでの自動リセット**
```
import { beforeEach } from 'vitest';
import { resetGlobalInstance } from './path/to/service.js';

beforeEach(() => {
  resetGlobalInstance();
});
```

**重要な原則**:
- グローバル変数は本番コードでは有用だが、テストでは分離が必要
- リセット関数は常に用意する（テスト専用でも構わない）
- `beforeEach`で実行して、各テストが新しい状態から開始できるようにする

### 一時ファイル/ディレクトリの衝突回避
**問題**: `Date.now()`のみでは並列実行時に同じ名前が生成される

**症状**:
- ファイル操作のENOENTエラー
- rename、writeFile などでの衝突
- 並列テスト実行での不安定性

**対応方法**:
- `Date.now()`に加えてランダム要素を追加
- `Date.now() + Math.random().toString(36).substring(7)`
- または`crypto.randomUUID()`を使用

**適用箇所**:
- 一時ディレクトリ名
- 一時ファイル名
- テストごとに異なるリソース名が必要な全ての場所

## モジュール分離の検証

### Vitest 4での自動分離
**機能**: Vitest 4はデフォルトで各ワーカーがモジュールを分離

**確認方法**:
- `vi.resetModules()`の明示的な呼び出しは不要
- ただし、グローバルシングルトンは別途リセットが必要
- `vitest.setup.ts`でのグローバル状態管理を推奨

**注意点**:
- モジュールレベルの変数はワーカー間では分離される
- しかし同一ワーカー内のテスト間では共有される可能性
- `beforeEach`でのリセットは依然として重要

## テスト安定性の検証方法

### 連続実行テスト
```bash
for i in {1..10}; do
  echo "=== Run $i ===";
  pnpm vitest --run 2>&1 | grep "Test Files";
done
```

**期待される結果**:
- 全ての実行で同じ結果（例: "29 passed"）
- failed数が変動する場合は不安定性あり
- 0 failed以外は許容しない

### 単独実行との比較
```bash
# 単独実行
pnpm vitest --run path/to/test.ts

# まとめて実行
pnpm vitest --run
```

**確認ポイント**:
- 単独では成功するがまとめると失敗 → 実行順序依存またはグローバル状態汚染
- 常に失敗 → テスト自体の問題
- ランダムに失敗 → タイミング依存や非同期処理の問題

## 移行チェックリスト

### 設定ファイル（vitest.config.ts）
- [ ] `singleFork`オプションを削除
- [ ] `poolOptions.forks.singleFork`を削除
- [ ] `unstubGlobals: true`を追加検討
- [ ] `setupFiles`にグローバルセットアップファイルを指定

### グローバルセットアップ（vitest.setup.ts）
- [ ] グローバルシングルトンのリセット関数を`beforeEach`で呼び出し
- [ ] モジュールレベルのグローバルモックを避ける

### テストコード
- [ ] `fs.promises`などのgetter経由アクセスを直接インポートに変更
- [ ] アロー関数のコンストラクタモックを`function`キーワードに変更
- [ ] モジュールレベルの`vi.stubGlobal()`を`beforeEach`内に移動
- [ ] 一時ファイル/ディレクトリ名にランダム要素を追加

### 実装コード
- [ ] グローバルシングルトンにリセット関数を追加
- [ ] リセット関数を`export`してテストから使用可能に

### 検証
- [ ] 連続10回実行で全て同じ結果になることを確認
- [ ] 単独実行とまとめて実行で結果が一致することを確認
- [ ] CI環境でのテスト成功を確認

## トラブルシューティング

### 交互失敗パターン
**症状**: fail-pass-fail-pass...と交互に成功/失敗
**原因**: Vitest 3 + Node.js v22のESMローダー問題
**対応**: Vitest 4へのアップグレード

### "not a constructor" エラー
**症状**: TypeError: () => ... is not a constructor
**原因**: コンストラクタモックでのアロー関数使用
**対応**: `function`キーワードまたは`class`構文に変更

### "Cannot set properties of undefined"
**症状**: fs.promisesなどへのプロパティ設定失敗
**原因**: automocked getterが`undefined`を返す
**対応**: `import * as fsPromises from 'fs/promises'`で直接インポート

### 実行順序依存の失敗
**症状**: 単独では成功、まとめると失敗
**原因**: グローバルシングルトンの共有または一時ファイル名の衝突
**対応**: リセット関数の実装とランダム要素の追加

---
**作成日**: 2026年1月14日
**対象バージョン**: Vitest 3.2.4 → 4.0.17
**Node.js**: v22.11.0以降を想定
