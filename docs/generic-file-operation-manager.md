# 汎用FileOperationManager<T>仕様

## 概要

FileOperationManager<T>は、期限付きKey-Valueストレージとしての汎用的なファイル操作システムです。ジェネリクス対応により任意のデータ型をサポートし、自動的な期限切れ管理機能を提供します。

## 設計原則

### 1. 汎用性の追求
- **ジェネリクス対応**: `FileOperationManager<T>` で任意のデータ型をサポート
- **型安全性**: TypeScriptの型システムを活用した安全なAPI
- **シンプルなAPI**: 最小限のメソッドで最大限の機能

### 2. 期限管理の自動化
- **タイムアウト管理**: 自動的な期限切れ処理
- **オンデマンドクリーンアップ**: 操作時に自動実行
- **設定可能な期限**: 用途に応じたタイムアウト設定

### 3. アトミック操作
- **ファイルロック**: 並行アクセス時の整合性保証
- **アトミック更新**: 一時ファイルを使用した安全な書き込み
- **例外安全性**: エラー発生時の状態保証

## 基本構造

### データ構造

```typescript
interface TimedStorage<T> {
  storage: Record<string, {  // key -> timed data
    data: T;                 // 格納データ
    updated_at: string;      // 最終更新時刻（ISO 8601形式）
  }>;
}
```

### クラス定義

```typescript
class FileOperationManager<T> {
  constructor(
    filePath: string,      // ストレージファイルパス
    key: string,          // このインスタンスが管理するキー
    timeoutMs: number = 4 * 60 * 60 * 1000  // タイムアウト期間（デフォルト4時間）
  )
}
```

## 主要API

### 1. データ保存 (store)

```typescript
async store(data: T): Promise<void>
```

**処理内容:**
1. ファイルロック取得
2. 期限切れデータのクリーンアップ
3. データの保存（現在時刻でupdated_at更新）
4. ファイル書き込み

**用途例:**
```typescript
const operatorStorage = new FileOperationManager<string>('/tmp/operators.json', 'sessionId');
await operatorStorage.store('tsukuyomi');
```

### 2. データ取得 (restore)

```typescript
async restore(): Promise<T | null>
```

**処理内容:**
1. ファイルロック取得
2. 期限切れデータのクリーンアップ
3. 自分のキーのデータを取得
4. 期限内であればデータを返却、期限切れならnull

**用途例:**
```typescript
const operatorId = await operatorStorage.restore();
if (operatorId) {
  console.log(`Current operator: ${operatorId}`);
}
```

### 3. 期限延長 (refresh)

```typescript
async refresh(): Promise<boolean>
```

**処理内容:**
1. ファイルロック取得
2. 期限切れデータのクリーンアップ
3. 自分のキーのupdated_atを現在時刻に更新
4. 成功時はtrue、データが存在しない場合はfalse

**用途例:**
```typescript
const refreshed = await operatorStorage.refresh();
console.log(`Timeout extended: ${refreshed}`);
```

### 4. データ削除 (remove)

```typescript
async remove(): Promise<boolean>
```

**処理内容:**
1. ファイルロック取得
2. 期限切れデータのクリーンアップ
3. 自分のキーのデータを削除
4. 成功時はtrue、データが存在しない場合はfalse

### 5. 他のエントリ取得 (getOtherEntries)

```typescript
async getOtherEntries(): Promise<Record<string, T>>
```

**処理内容:**
1. ファイルロック取得
2. 期限切れデータのクリーンアップ
3. 自分以外のキーのデータを取得
4. 有効なデータのみを返却

**用途例:**
```typescript
const otherOperators = await operatorStorage.getOtherEntries();
console.log('Other sessions:', Object.keys(otherOperators));
```

## 実装例

### オペレータ管理での使用

```typescript
// OperatorManagerでの使用例
class OperatorManager {
  private dataStore: FileOperationManager<string>;

  constructor() {
    const sessionId = this.getSessionId();
    const filePath = '/tmp/coeiroink-operators-' + hostname() + '.json';
    this.dataStore = new FileOperationManager<string>(filePath, sessionId, 4 * 60 * 60 * 1000);
  }

  async reserveOperator(operatorId: string): Promise<boolean> {
    // 他のセッションが同じオペレータを使用していないかチェック
    const otherEntries = await this.dataStore.getOtherEntries();
    const busyOperators = Object.values(otherEntries);
    
    if (busyOperators.includes(operatorId)) {
      return false; // 使用中
    }

    // オペレータを予約
    await this.dataStore.store(operatorId);
    return true;
  }

  async getCurrentOperatorId(): Promise<string | null> {
    return await this.dataStore.restore();
  }

  async releaseOperator(): Promise<boolean> {
    return await this.dataStore.remove();
  }

  async refreshReservation(): Promise<boolean> {
    return await this.dataStore.refresh();
  }
}
```

### 設定管理での使用

```typescript
// ユーザ設定管理での使用例
interface UserConfig {
  theme: string;
  language: string;
  preferences: Record<string, any>;
}

const userConfigStorage = new FileOperationManager<UserConfig>(
  '~/.myapp/user-config.json',
  'config',
  24 * 60 * 60 * 1000  // 24時間
);

// 設定保存
await userConfigStorage.store({
  theme: 'dark',
  language: 'ja',
  preferences: { autoSave: true }
});

// 設定取得
const config = await userConfigStorage.restore();
```

### キャッシュ管理での使用

```typescript
// キャッシュデータ管理での使用例
interface CacheData {
  value: any;
  computedAt: string;
  hits: number;
}

const cache = new FileOperationManager<CacheData>(
  '/tmp/app-cache.json',
  'cache-key-123',
  60 * 60 * 1000  // 1時間
);

// キャッシュ保存
await cache.store({
  value: computedResult,
  computedAt: new Date().toISOString(),
  hits: 0
});

// キャッシュ取得
const cachedData = await cache.restore();
if (cachedData) {
  return cachedData.value;
}
```

## パフォーマンス特性

### 1. ファイルアクセス最適化
- **最小限のファイルアクセス**: 必要な操作のみ実行
- **効率的なクリーンアップ**: 操作時に自動実行
- **バッチ処理**: 複数操作を一回のファイルアクセスで実行

### 2. ロック期間の最小化
- **短時間ロック**: ロック取得から解放まで最短経路
- **並行性確保**: 重い処理のロック外実行
- **デッドロック回避**: シンプルなロック戦略

### 3. メモリ効率
- **遅延読み込み**: 必要時のみファイル読み込み
- **最小限の保持**: 操作完了後は即座にメモリ解放

## エラーハンドリング

### 1. ファイルアクセスエラー
- **ファイル不存在**: 自動的にデフォルト構造で作成
- **権限エラー**: 適切なエラーメッセージで報告
- **破損ファイル**: デフォルト状態で復旧

### 2. ロック競合
- **リトライなし**: シンプル性を重視
- **迅速な失敗**: ロック取得失敗時は即座にエラー報告
- **明確なエラー**: デバッグに役立つエラーメッセージ

### 3. データ整合性
- **原子性保証**: 一時ファイルを使用したアトミック更新
- **ロールバック**: 失敗時の状態復旧
- **検証**: データ構造の妥当性チェック

## セキュリティ考慮

### 1. ファイル権限
- **適切な権限設定**: ユーザーのみアクセス可能
- **ディレクトリ分離**: アプリケーション専用ディレクトリ使用
- **一時ファイル管理**: 適切な一時ファイルの削除

### 2. データ保護
- **機密情報の暗号化**: 必要に応じて実装
- **ログ出力制限**: 機密データのログ出力防止
- **アクセス制御**: 適切な権限チェック

## 拡張性

### 1. カスタマイズポイント
- **タイムアウト設定**: 用途に応じた期限設定
- **クリーンアップ戦略**: 自動/手動の選択
- **ファイル形式**: JSON以外の形式への対応

### 2. 将来的な拡張
- **圧縮サポート**: 大きなデータの圧縮保存
- **バックアップ機能**: 自動バックアップとリストア
- **監視機能**: アクセス状況のモニタリング

## 旧実装からの移行

### 移行前 (統一ファイル管理)
```typescript
// 複雑な統一ファイル操作
await fileManager.reserveOperatorUnified(operatorId, sessionId);
await fileManager.getAvailableOperatorsUnified(allOperators, sessionId);
await fileManager.cleanupStaleOperators(sessionId);
```

### 移行後 (汎用KVストレージ)
```typescript
// シンプルなKVストレージ操作
const storage = new FileOperationManager<string>(filePath, sessionId, timeoutMs);
await storage.store(operatorId);
const operatorId = await storage.restore();
await storage.refresh();
```

### 移行の利点
- **コード量削減**: 約300行 → 150行 (50%削減)
- **型安全性向上**: ジェネリクスによる型チェック
- **再利用性向上**: 他のユースケースでも使用可能
- **テスト容易性**: シンプルなAPIでテストが簡単

---

**作成日**: 2025年8月18日  
**バージョン**: 1.0  
**関連ファイル**: `src/core/operator/file-operation-manager.ts`