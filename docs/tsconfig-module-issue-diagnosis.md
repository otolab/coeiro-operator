# tsconfig.json module設定がts-jest実行時に効いていない問題の診断結果

## 📋 問題概要

**Issue #35 続き**: tsconfig.jsonで`module: "esnext"`を設定しているにも関わらず、ts-jest実行時にCommonJSモードで動作している問題。

## 🔍 調査方法

小さなテストを作成して、実際の設定値読み込み状況を確認：

- `src/config-detection.test.ts`: 基本的なモジュールシステム検出
- `src/ts-jest-config.test.ts`: ts-jest設定詳細調査
- `src/actual-tsconfig.test.ts`: TypeScript Compiler API使用
- `src/esm-verification.test.ts`: ESM特有機能の確認
- `src/final-diagnosis.test.ts`: 総合診断

## 📊 診断結果

### 設定ファイル vs 実際の動作

| 設定箇所 | 設定値 | 実際の動作 | 状態 |
|----------|--------|------------|------|
| `tsconfig.json` | `module: "esnext"` | CommonJS | ❌ 無効 |
| `package.json` | `"type": "module"` | CommonJS | ❌ 無効 |
| `jest.config.mjs` | `default-esm` preset | CommonJS | ❌ 無効 |

### 実行時環境の詳細確認

#### ✅ CommonJS特有の要素（存在している）
- `exports` オブジェクト
- `module` オブジェクト  
- `require` 関数
- `__filename` / `__dirname`

#### ❌ ESM特有の要素（利用不可）
- `import.meta` オブジェクト
- Top-level await
- Pure ESM モジュール解決

#### ⚠️ 部分的ESM動作（Hybrid状態）
- Dynamic import動作: ✅ 可能
- ESM的import構造: `default !== module` (ESM的特徴)
- Named import: 動作するがCommonJS的解決

## 🎯 根本原因の特定

### 1. ts-jest設定の限界
```javascript
// jest.config.mjs での設定
export default {
  preset: 'ts-jest/presets/default-esm',
  // ... ESM関連設定
}
```
ESM presetを使用してもCommonJS環境で実行されている。

### 2. Node.js実行コンテキスト
- Jest実行時にESMフラグが適用されていない
- `process.execArgv` に ESM関連フラグなし
- `NODE_OPTIONS` 環境変数に ESM設定なし

### 3. TypeScript Compiler設定の齟齬
```javascript
// tsconfig.jsonから読み込まれた設定
target: ES2022
module: ESNext          // ← 設定されているが無効
moduleResolution: Node10
```

実際のコンパイラ設定は正しく読み込まれているが、実行時環境がCommonJS。

## 💡 解決策の評価

### Option 1: 現状維持（推奨）
**メリット**:
- 設定変更不要
- 部分的ESM動作は確保済み
- Dynamic importは正常動作

**デメリット**:
- `import.meta` 利用不可
- Pure ESMの恩恵を受けられない

### Option 2: Jest代替ツール
**候補**: Vitest, Node.js built-in test runner
**メリット**: 完全なESM対応
**デメリット**: 移行コスト、設定の再構築

### Option 3: Node.js実行制御
```bash
NODE_OPTIONS="--experimental-default-type=module" npm test
```
**メリット**: 積極的ESM化
**デメリット**: Jest自体の互換性問題発生

### Option 4: CommonJS最適化
設定をCommonJSに統一して一貫性を確保。

## 🔬 技術的詳細

### 検証コード例
```typescript
// 実行時モジュールシステム検出
const runtimeEnvironment = {
  hasCommonJSObjects: typeof exports !== 'undefined',
  importMetaAvailable: false,
  dynamicImportWorks: true,
};

// 結果: CommonJS + 部分的ESM
```

### ts-jestバージョン情報
- Jest: 30.0.4
- ts-jest: 29.4.1
- TypeScript: 5.9.2
- Node.js: v22.11.0

## 📝 推奨アクション

1. **現状維持**: 部分的ESM動作で十分な場合
2. **ドキュメント化**: この状況を開発チームに共有
3. **将来的検討**: Vitest等への移行検討
4. **監視**: ts-jest/Jestの更新による改善確認

## 🎉 調査完了

この診断により、設定ファイルと実際の動作環境の間に明確な齟齬があることが科学的に証明されました。

**結論**: tsconfig.jsonのmodule設定は確かにts-jest実行時に完全には効いていないが、部分的にESMの特徴を示しており、実用上の問題は限定的。