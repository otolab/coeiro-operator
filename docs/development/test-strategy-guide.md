# テスト戦略ガイド

COEIRO Operatorプロジェクトにおけるテスト設計の方針と実装ガイド

## テストの種類と役割分担

### 1. ユニットテスト
**目的**: 個々の関数・クラスの動作検証

- **対象**: 純粋関数、ユーティリティ、個別クラスメソッド
- **モック使用**: 外部依存は積極的にモック化
- **配置**: 実装ファイルと同じディレクトリに `*.test.ts`
- **実行**: `pnpm test`

```typescript
// 例: packages/core/src/utils/text-utils.test.ts
describe('splitText', () => {
  it('句読点で文章を分割する', () => {
    const result = splitText('こんにちは。元気ですか？');
    expect(result).toEqual(['こんにちは。', '元気ですか？']);
  });
});
```

### 2. 統合テスト
**目的**: 複数コンポーネント間の連携確認

- **対象**: サービス間連携、データフロー、設定システム
- **モック使用**: 外部API・ファイルシステムのみモック
- **配置**: `packages/*/src/integration-test/` または各モジュール内
- **実行**: `pnpm test`

```typescript
// 例: オペレータ管理とキャラクター情報の統合
describe('OperatorManager Integration', () => {
  it('アサイン時にキャラクター情報が正しく取得される', async () => {
    const manager = new OperatorManager();
    await manager.assign('tsukuyomi');
    expect(manager.getCurrentCharacter()).toBeDefined();
  });
});
```

### 3. E2Eテスト
**目的**: エンドツーエンドの主要経路検証

- **対象**: MCPツール起動、CLI実行、初期化処理
- **モック使用**: 外部サービス（COEIROINK API、音声再生）のみ
- **配置**: `packages/*/src/test/`、`packages/mcp-debug/src/test/`
- **実行**: `pnpm test:e2e`

## E2E テスト設計の原則

### 簡潔性を重視
```typescript
// ❌ 悪い例: 細かすぎるE2Eテスト
it('ボタンをクリックする', async () => { /* ... */ });
it('フォームに入力する', async () => { /* ... */ });
it('送信ボタンを押す', async () => { /* ... */ });
it('結果を確認する', async () => { /* ... */ });

// ✅ 良い例: 一連のフローをまとめる
it('初期化→アサイン→音声再生の一連フローが動作する', async () => {
  const assignResult = await tester.callTool('operator_assign', { operator: 'tsukuyomi' });
  expect(assignResult.success).toBe(true);
  
  const sayResult = await tester.callTool('say', { message: 'テスト' });
  expect(sayResult.success).toBe(true);
});
```

### 初期化処理の検証
```typescript
describe('MCP Server E2E', () => {
  it('サーバー起動時に必要なツールが登録される', async () => {
    const tester = new CoeirocoperatorMCPDebugTestRunner();
    await tester.startCOEIROOperatorWithDebug(['--debug']);
    
    const tools = tester.getAvailableTools();
    expect(tools.length).toBeGreaterThan(0);
    
    const status = tester.getStatus();
    expect(status.isReady).toBe(true);
  });
});
```

### 処理経路の確認
```typescript
it('長文の分割処理が正しく動作する', async () => {
  // 長文を入力して、分割処理が働くことを確認
  const longMessage = '長い文章のテストです。これは句読点で分割されます。最後の文です。';
  const result = await tester.callTool('say', { message: longMessage });
  
  expect(result.success).toBe(true);
  // 詳細な分割ロジックはユニットテストで検証
});
```

## テストレベルの使い分け

### E2Eテストで検証すべきもの

1. **ツールの起動・初期化**
   - MCPサーバーの起動
   - ツール登録の確認
   - 設定ファイルの読み込み

2. **主要な処理フロー**
   - オペレータアサイン→音声再生
   - 辞書登録→音声での利用
   - エラー時の復旧処理

3. **外部連携の基本動作**
   - COEIROINK APIとの通信（モック使用）
   - ファイル保存の成功確認（詳細はユニットテスト）

### ユニットテストで検証すべきもの

1. **詳細なビジネスロジック**
   - テキスト分割アルゴリズム
   - アクセント計算
   - キャッシュ管理

2. **エラーハンドリングの詳細**
   - 各種バリデーション
   - 例外処理の分岐
   - エラーメッセージの内容

3. **データ変換・整形**
   - API レスポンスの変換
   - 設定ファイルのパース
   - 音声データの処理

## モック戦略

### E2Eテストでのモック

```typescript
// packages/mcp-debug/src/test/mocks/coeiroink-mock.ts
export class COEIROINKMockServer {
  private app: express.Application;
  private synthesisCount = 0;
  
  constructor(options: { port: number }) {
    this.app = express();
    this.setupRoutes();
  }
  
  private setupRoutes() {
    // 最小限の動作確認用エンドポイント
    this.app.get('/v1/speakers', (req, res) => {
      res.json(this.getDefaultSpeakers());
    });
    
    this.app.post('/v1/synthesis', (req, res) => {
      this.synthesisCount++;
      res.send(this.generateDummyWav());
    });
  }
  
  getSynthesisCount() { return this.synthesisCount; }
}
```

### CLIテストの注意点

```typescript
// ⚠️ CLIテストは実際のプロセスを起動するため、モックを通らない
// E2Eテストには不向き → ユニットテストで検証

// ❌ 悪い例: CLI経由のE2Eテスト
it('say-coeiroinkコマンドが動作する', async () => {
  const result = await runCommand('say-coeiroink', ['テスト']);
  // モックを通らないため、実際のCOEIROINKが必要
});

// ✅ 良い例: MCP経由のE2Eテスト
it('sayツールが動作する', async () => {
  const result = await tester.callTool('say', { message: 'テスト' });
  // モックサーバーを使用できる
});
```

## テスト実行順序の最適化

```json
// package.json
{
  "scripts": {
    "test": "vitest",                    // ユニット・統合テスト（高速）
    "test:e2e": "pnpm test:mcp-debug:enhanced",  // E2Eテスト（低速）
    "test:all": "pnpm test && pnpm test:e2e",  // 全テスト
    "test:ci": "pnpm test:all --coverage"     // CI用（カバレッジ付き）
  }
}
```

## パフォーマンス考慮事項

### E2Eテストの高速化

1. **並行実行の活用**
```typescript
// 独立したテストは並行実行
const results = await Promise.all([
  tester.callTool('operator_status', {}),
  tester.callTool('operator_available', {}),
  tester.callTool('dictionary_list', {})
]);
```

2. **セットアップの共有**
```typescript
describe('MCP Tools E2E', () => {
  let tester: MCPServiceE2ETester;
  let mockServer: COEIROINKMockServer;
  
  beforeAll(async () => {
    // 重いセットアップは一度だけ
    mockServer = new COEIROINKMockServer({ port: 50032 });
    await mockServer.start();
  });
  
  beforeEach(async () => {
    // 軽いリセット処理
    mockServer.reset();
    tester = await createMCPTester({ /* ... */ });
  });
});
```

3. **タイムアウトの適切な設定**
```typescript
it('長時間処理のテスト', async () => {
  // 必要に応じてタイムアウトを調整
  const result = await tester.callTool('heavy_process', {}, { timeout: 30000 });
}, 35000);  // Jestのタイムアウトも調整
```

## テスト品質の指標

### カバレッジ目標
- **ユニットテスト**: 80%以上
- **統合テスト**: 主要な連携パスをカバー
- **E2Eテスト**: 主要な利用シナリオをカバー

### テストの保守性
- **DRY原則**: テストヘルパーの活用
- **明確な命名**: 日本語でのテスト名OK
- **独立性**: テスト間の依存を避ける
- **決定的**: ランダム要素の制御

## テストの独立性とグローバル状態管理

### 原則: テストは完全に独立すべき

**要求事項**:
- 実行順序に関係なく同じ結果
- 単独実行とまとめて実行で同じ結果
- 並列実行でも安定
- **0 failed以外は許容しない**

### グローバルシングルトンの問題と対策

**問題**: モジュールレベルのシングルトン変数がテスト間で共有

```typescript
// 本番コード（良い設計）
let globalSpeakerProvider: SpeakerProvider | null = null;

export function getSpeakerProvider(): SpeakerProvider {
  if (!globalSpeakerProvider) {
    globalSpeakerProvider = new SpeakerProvider();
  }
  return globalSpeakerProvider;
}
```

**症状**:
- テスト単独では成功、複数実行では失敗
- 実行順序で結果が変わる
- 前のテストの状態が次のテストに影響

**対策**: リセット関数の実装と利用

```typescript
// 本番コードにリセット関数を追加（テスト用でも構わない）
export function resetSpeakerProvider(): void {
  globalSpeakerProvider = null;
}
```

```typescript
// vitest.setup.ts でグローバルに適用
import { beforeEach } from 'vitest';
import { resetSpeakerProvider } from './path/to/service.js';

beforeEach(() => {
  resetSpeakerProvider();
});
```

### 一時リソースの命名戦略

**問題**: `Date.now()`のみでは並列実行時に衝突

```typescript
// ❌ 悪い例: 並列実行で衝突する可能性
tempDir = join(tmpdir(), `test-${Date.now()}`);
```

**対策**: ランダム要素の追加

```typescript
// ✅ 良い例: 衝突を回避
tempDir = join(
  tmpdir(),
  `test-${Date.now()}-${Math.random().toString(36).substring(7)}`
);
```

### グローバルモックのライフサイクル

**Vitest 4の設定**:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    unstubGlobals: true,  // グローバルモックを自動クリーンアップ
  }
});
```

**推奨パターン**: beforeEach内でのモック設定

```typescript
// ❌ 悪い例: モジュールレベル
vi.stubGlobal('fetch', vi.fn());

describe('MyTest', () => {
  // ...
});
```

```typescript
// ✅ 良い例: beforeEach内
describe('MyTest', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  // ...
});
```

### テスト独立性の検証方法

**1. 連続実行テスト**
```bash
# 10回連続で実行して結果が一致することを確認
for i in {1..10}; do
  echo "=== Run $i ===";
  pnpm vitest --run 2>&1 | grep "Test Files";
done
```

**期待される結果**: 全ての実行で同一の結果
- ✅ 全て "29 passed (29)"
- ❌ "26 passed | 3 failed" や結果が変動

**2. 単独実行との比較**
```bash
# 特定のテストファイル単独
pnpm vitest --run packages/core/src/config/*.test.ts

# 全テストまとめて
pnpm vitest --run
```

**確認ポイント**:
- 単独で成功、まとめると失敗 → グローバル状態汚染または実行順序依存
- 常に失敗 → テスト自体の問題
- ランダムに失敗 → 並列実行の衝突またはタイミング依存

**3. 並列度の変更**
```bash
# ワーカー数を変えて挙動を確認
pnpm vitest --run --maxWorkers=1
pnpm vitest --run --maxWorkers=4
```

### Vitest 4固有の注意点

**Automocked Gettersの挙動**: `fs.promises`などのgetterプロパティは`undefined`を返す

```typescript
// ❌ 動作しない
import fs from 'fs';
vi.mock('fs');
vi.mocked(fs.promises).writeFile = vi.fn();  // fs.promisesがundefined

// ✅ 正しい方法
import * as fsPromises from 'fs/promises';
vi.mock('fs/promises');
vi.mocked(fsPromises).writeFile = vi.fn();
```

**コンストラクタモックの厳格化**: アロー関数は使用不可

```typescript
// ❌ Vitest 4ではエラー
vi.mocked(MyClass).mockImplementation(() => mockInstance);

// ✅ function キーワードを使用
vi.mocked(MyClass).mockImplementation(function() {
  return mockInstance;
});
```

詳細は `prompts/recipes/vitest4-migration.md` を参照。

## まとめ

### テスト作成のチェックリスト

- [ ] **テストレベルの選択は適切か？**
  - 詳細ロジック → ユニットテスト
  - コンポーネント連携 → 統合テスト
  - エンドツーエンド → E2Eテスト

- [ ] **E2Eテストは簡潔か？**
  - 1テスト = 1シナリオ
  - 詳細検証は下位テストに委譲

- [ ] **モックの使用は適切か？**
  - 外部サービスのみモック化
  - 内部ロジックは実装を使用

- [ ] **パフォーマンスは考慮されているか？**
  - 並行実行の活用
  - セットアップの最適化

- [ ] **保守性は確保されているか？**
  - テストコードの可読性
  - 変更に強い構造

- [ ] **独立性は保証されているか？** ⬅ NEW
  - グローバルシングルトンのリセット
  - 一時リソース名にランダム要素
  - グローバルモックはbeforeEach内
  - 連続10回実行で同じ結果

- [ ] **Vitest 4の仕様に準拠しているか？** ⬅ NEW
  - getter経由アクセスを直接インポートに変更
  - コンストラクタモックで`function`キーワード使用
  - `unstubGlobals: true`を設定

このガイドラインに従うことで、効率的で保守性の高いテストスイートを構築できます。

**更新履歴**:
- 2026-01-14: テストの独立性とVitest 4対応を追記