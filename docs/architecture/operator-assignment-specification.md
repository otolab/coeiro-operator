# オペレータアサイン状態管理仕様

## 概要

COEIRO Operatorにおけるオペレータアサイン状態の管理仕様。複数セッション間でのオペレータ重複防止と、時間切れによる自動解放機能を提供。

## 基本設計原則

### 1. 単一責任の原則
- 1つのオペレータは同時に1つのセッションのみが使用可能
- セッション間でのオペレータ重複は厳格に防止
- 時間切れオペレータは自動的に解放される

#### 他セッションでアサインされたオペレータの扱い
他のセッション（別のターミナル、別のClaude Code接続など）で既にアサインされているオペレータは：
- `operator available` コマンドの利用可能リストに表示されません
- `operator assign` で選択できません（ランダム選択からも除外）
- `operator status` で「他セッションで使用中」と表示されます

例：
```bash
# セッション1でつくよみちゃんをアサイン
$ operator-manager assign tsukuyomi
> つくよみちゃんを割り当てました

# セッション2で利用可能リストを確認
$ operator-manager available
> 利用可能なオペレータ: angie, alma, akane, dia, kana  # つくよみちゃんは表示されない

# セッション2でつくよみちゃんを指定してもエラー
$ operator-manager assign tsukuyomi
> エラー: つくよみちゃんは他のセッションで使用中です
```

### 2. 一貫性の保証
- 全ての状態変更はファイルロック経由で実行
- 時間切れチェックは状態変更の前に必ず実行
- 複数の実行経路で一貫した状態管理を保証

### 3. 復旧性の確保
- プロセス異常終了時の自動回復
- 古い予約の自動クリーンアップ（デフォルト4時間）
- セッション識別による正確な状態管理

## データ構造

### アサイン状態ファイル
**ファイルパス**: `/tmp/coeiroink-operators-{hostname}.json`

```typescript
interface TimedStorage<T> {
  storage: Record<string, {  // sessionId -> timed data
    data: T;                 // オペレータの場合はoperatorId (string)
    updated_at: string;      // 最終更新時刻（ISO 8601形式）
  }>;
}

// オペレータ管理での使用例
type OperatorState = TimedStorage<string>;  // string = operatorId
```

### Session と Process の関係

### セッション識別子の決定
優先順位に従って以下から選択：
1. `ITERM_SESSION_ID` (iTerm2環境)
2. `TERM_SESSION_ID` (ターミナル環境)
3. `process.ppid` (親プロセスID、フォールバック)

### Session vs Process
- **Session**: ターミナルセッション単位（ITERM_SESSION_ID等で識別）
- **Process**: セッション内で動作する個別プロセス
- **原則**: オペレータはSessionに紐づく（Processではない）

### 例
```
Session-ABC123
├── CLI Process (say-coeiroink コマンド)
├── MCP Process (Claude Desktop統合)
└── Manager Process (operator-manager コマンド)
```

同一セッション内の全プロセスが同じオペレータを共有する。

## 状態遷移

### 1. オペレータアサイン
```
[未使用] → [使用中] → [時間切れ] → [未使用]
```

### 2. 状態の判定条件

#### 使用中 (Busy)
- `operators` レコードに存在
- 予約時刻が有効期限内
- 異なるセッションから参照した場合

#### 利用可能 (Available) 
- `operators` レコードに未存在
- 時間切れにより自動解放済み
- 同一セッションから参照した場合（既存予約）

#### 時間切れ (Stale)
- 予約時刻 + タイムアウト期間 < 現在時刻
- 自動解放対象

## 主要操作

### 1. オペレータ予約 (Store)
```typescript
async store(data: T): Promise<void>
```

**処理流れ**:
1. ファイルロック取得
2. **時間切れクリーンアップ実行**
3. セッションデータの保存（現在時刻でupdated_at更新）
4. ファイル書き込み

### 2. オペレータ解放 (Remove)
```typescript
async remove(): Promise<boolean>
```

**処理流れ**:
1. ファイルロック取得
2. 時間切れクリーンアップ実行
3. 自分のセッションデータを削除
4. ファイル書き込み

### 3. 他セッションデータ取得 (Get Other Entries)
```typescript
async getOtherEntries(): Promise<Record<string, T>>
```

**処理流れ**:
1. ファイルロック取得
2. **時間切れクリーンアップ実行**
3. 自分以外のセッションデータを取得
4. ファイル書き込み（クリーンアップ結果を反映）

### 4. 現在のデータ取得 (Restore)
```typescript
async restore(): Promise<T | null>
```

**処理流れ**:
1. ファイルロック取得
2. 時間切れクリーンアップ実行
3. 自分のセッションデータを取得
4. ファイル書き込み（クリーンアップ結果を反映）

### 5. 期限の更新 (Refresh)
```typescript
async refresh(): Promise<boolean>
```

**処理流れ**:
1. ファイルロック取得
2. 時間切れクリーンアップ実行
3. 自分のセッションのupdated_atを現在時刻に更新
4. ファイル書き込み

## タイムアウト管理

### デフォルトタイムアウト
- **4時間** (14,400,000ミリ秒)
- 設定ファイルで変更可能

### タイムアウト期間の設定
```json
{
  "operatorTimeout": 14400000
}
```

### 時間切れクリーンアップ
- 予約・取得時に自動実行
- バックグラウンドでの定期実行なし
- オンデマンド方式でパフォーマンス重視

## エラーハンドリング

### 1. ファイルアクセスエラー
- ファイル不存在時は自動作成
- 権限エラー時は適切なエラーメッセージ
- 破損ファイル時はデフォルト状態で復旧

### 2. ロック競合
- リトライ機構なし（シンプル性重視）
- ロック取得失敗時は適切なエラー報告
- デッドロック回避のための短時間処理

### 3. プロセス監視
- `process.kill(pid, 0)` によるプロセス存在チェック
- プロセス不存在時は自動的に予約削除

## パフォーマンス考慮

### 1. ファイルアクセス最適化
- 必要最小限のファイルアクセス
- 時間切れクリーンアップの効率化
- 不要な読み書きの削減

### 2. ロック期間の最小化
- ロック取得から解放まで最短経路
- 重い処理のロック外実行
- 並行性の最大化

## セキュリティ考慮

### 1. セッション分離
- セッション間での状態の完全分離
- 他セッション情報への不正アクセス防止

### 2. ファイル権限
- ユーザーディレクトリ内のファイル管理
- 適切なファイル権限設定

## 互換性

### 既存システムとの互換性
- MCPサーバー: 完全対応
- CLIツール: 完全対応
- 既存設定ファイル: 下位互換性維持

### 将来拡張性
- 新しいセッション識別子の追加可能
- タイムアウト設定の詳細化
- 監視・ロギング機能の拡張

---

**作成日**: 2025年8月18日  
**バージョン**: 1.0  
**関連ファイル**:
- `src/core/operator/index.ts` (OperatorManager統合クラス)
- `src/core/operator/file-operation-manager.ts` (汎用期限付きKVストレージ)
- `src/core/operator/character-info-service.ts` (キャラクター情報管理)
- `src/core/operator/config-manager.ts` (設定管理)

## 実装アーキテクチャ

### 統合管理構造 (2025年8月更新)

```
OperatorManager (統合管理クラス)
├── FileOperationManager<string> (内部状態管理)
├── CharacterInfoService (キャラクター情報)
└── ConfigManager (設定管理)
```

### 旧構造からの変更点
- **OperatorStateManager**: OperatorManagerに統合
- **VoiceSelectionService**: CharacterInfoServiceに名前変更・機能整理
- **FileOperationManager**: 汎用的な期限付きKVストレージ `FileOperationManager<T>` に再設計