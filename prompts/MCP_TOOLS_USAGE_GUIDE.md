# MCP Tools 使用ガイド

このプロジェクトで利用可能なMCP（Model Context Protocol）ツールの使い方とガイドです。

## COEIRO Operator MCPツール

COEIRO Operatorが提供するMCPツールは以下の通りです：

### operator_assign
オペレータの割り当てを行います。

**引数**:
- `operator`: 指定するオペレータ名（英語表記、例: 'tsukuyomi', 'alma'など。省略時または空文字列時はランダム選択。日本語表記は無効）
- `style`: 指定するスタイル名（例: 'normal', 'ura', 'sleepy'など。省略時はキャラクターのデフォルト設定に従う）

### operator_release
現在のオペレータを解放します。

### operator_status
現在のオペレータ状況を確認します。

### operator_available
利用可能なオペレータ一覧を表示します。

### operator_styles
現在のオペレータまたは指定したキャラクターの利用可能なスタイル一覧を表示します。

**引数**:
- `character`: キャラクターID（省略時は現在のオペレータのスタイル情報を表示）

### say
COEIROINK音声合成システムを使用して日本語音声を出力します（Queue統一実装による低レイテンシストリーミング対応）。

**引数**:
- `message`: 発話させるメッセージ（日本語）
- `rate`: 話速（WPM、デフォルト200）
- `style`: スタイルID（オペレータのスタイル選択を上書き）
- `voice`: 音声ID（省略時はオペレータ設定を使用）

**Queue統一実装による動作**:
- MCP呼び出し時は非同期キューイング（即座にレスポンス）
- 音声タスクは背景で順次実行
- レスポンス形式: `{ success: boolean, taskId: number }`
- 高速なClaude Code応答性を実現

### debug_logs
デバッグ用ログの取得と表示。ログレベル・時刻・検索条件による絞り込み、統計情報の表示が可能。

**引数**:
- `action`: 実行するアクション（'get'=ログ取得, 'stats'=統計表示, 'clear'=ログクリア）
- `level`: 取得するログレベル（複数選択可）
- `since`: この時刻以降のログを取得（ISO 8601形式）
- `limit`: 取得する最大ログエントリ数（1-1000）
- `search`: ログメッセージ内の検索キーワード
- `format`: 出力形式（'formatted'=整形済み, 'raw'=生データ）

### parallel_generation_control
チャンク並行生成機能の制御と設定管理を行います。音声合成の高速化を目的とした新機能です。

**引数**:
- `action`: 実行するアクション
  - `'enable'`: 並行生成を有効化
  - `'disable'`: 並行生成を無効化
  - `'status'`: 現在の設定と統計情報を表示
  - `'update_options'`: 並行生成オプションを更新
- `options`: 更新するオプション（action=update_optionsの場合）
  - `maxConcurrency`: 最大並行生成数（1-5）
  - `delayBetweenRequests`: リクエスト間隔（ms、0-1000）
  - `bufferAheadCount`: 先読みチャンク数（0-3）

**使用例**:
```json
// 並行生成を有効化
{"action": "enable"}

// 設定確認
{"action": "status"}

// オプション更新
{"action": "update_options", "options": {"maxConcurrency": 3, "delayBetweenRequests": 30}}
```

**効果**:
- 複数チャンクの同時生成により高速化
- レスポンシブな音声再生開始
- 体感的なレイテンシ削減

## MCPデバッグ環境

プロジェクトには包括的なMCPデバッグ環境が実装されています：

### Echo Back MCPサーバー
テスト用のMCPサーバー（`src/mcp-debug/test/echo-server.ts`）で、以下の機能を提供：

- **制御コマンド処理**: `CTRL:` プレフィックスによる制御機能
- **JSON-RPC処理**: 標準MCPプロトコル対応
- **出力チャネル分離**: MCP/Control/Debug/Error出力の分離
- **ログ蓄積機能**: 高性能ログ蓄積（0.01ms/ログ）

### 統合テストシステム
自動化されたMCP機能テスト（`src/mcp-debug/test/integration.test.ts`）：

- 継続的JSON処理テスト
- 出力チャネル分離テスト
- プロセス管理テスト
- 制御コマンドテスト
- ログ蓄積テスト
- エラーハンドリングテスト

### テスト実行方法
```bash
# MCPデバッグ統合テスト
./scripts/test-mcp-debug.sh

# COEIRO Operator統合テスト
./test-coeiro-mcp-debug.sh
```

## 外部MCPツール（code-bugs）

code-bugsが提供するMCP（Model Context Protocol）ツールの使い方と意味、Use-caseを説明します。
これらのツールはコード品質向上とプロジェクト分析のためのインターフェースです。

### 概要

code-bugsは以下の3つのMCPサーバーを提供しています：

- **code-bugs-analysis**: コード解析ツール群
- **code-bugs-depcruise**: 依存関係解析ツール
- **code-bugs-depcruise-analysis**: 高度な依存関係解析ツール

## code-bugs-analysis MCPサーバー

### getAnalysisResults

指定したファイルの事前解析結果を取得します。

**引数**:
- `analysis`: 取得したい解析タイプの配列
  - `name`: 解析名（"file-overview", "import-and-export-details"等）
  - `details`: 詳細情報が必要な場合はtrue（デフォルト: false）
- `targets`: 対象ファイルパスの配列（ワイルドカード不可）
- `baseDir`: ベースディレクトリパス

**Use-case**:
- 特定ファイルの詳細分析結果を確認したい
- 複数の解析タイプの結果を一括取得したい
- リファクタリング前の現状把握

### reverseLookupFindings

解析結果から特定の条件に該当するファイルを軽量検索します。

**引数**:
- `baseDir`: 検索対象のベースディレクトリ
- `analysisTypes`: 検索対象の解析タイプ配列
- `findingIndices`: 検索したい問題タイプのインデックス（省略可）
- `hasFindings`: 問題があるファイルのみ検索（デフォルト: true）
- `maxResults`: 最大結果数（デフォルト: 50）

**Use-case**:
- 特定の問題を持つファイル一覧を素早く取得
- 優先順位の高い問題から段階的に対処
- プロジェクト全体の問題傾向を把握

## code-bugs-depcruise MCPサーバー

### noDependents

参照されていないファイルを探します。

**引数**:
- `baseDir`: ソースツリーのルートディレクトリ
- `entries`: 依存性調査の起点となるモジュール（glob形式）
- `excludes`: 検出から除外するパターン
- `target`: 検出したいディレクトリ（baseDirからの相対パス）

**Use-case**:
- 不要なファイルの特定と削除
- デッドコードの検出
- エントリーポイントの妥当性確認

## code-bugs-depcruise-analysis MCPサーバー

### analyze

ファイルの依存関係の解析を行います。

**引数**:
- `baseDir`: ソースツリーのルートディレクトリ
- `entries`: 解析の起点となるエントリーポイントのファイルリスト

**Use-case**:
- プロジェクト全体の依存関係構造を分析
- アーキテクチャの健全性確認
- 循環依存の検出

### traverseImportPaths

指定したファイルからimportを辿り、潜在的に依存しているファイルのリストを作成します。

**引数**:
- `target`: 参照を辿る起点となる単一のファイル
- `baseDir`: baseDirとtargetの組み合わせで有効なパスを構成
- `depth`: 辿る最大深さ（デフォルト: 4）

**Use-case**:
- 特定ファイルの影響範囲調査
- リファクタリング時の影響分析
- 依存関係の可視化

### followExportTrails

指定したファイルに対するimportを辿り、潜在的に依存されているファイルのリストを作成します。

**引数**:
- `target`: 被参照を辿る起点となる単一のファイル
- `baseDir`: baseDirとtargetの組み合わせで有効なパスを構成
- `depth`: 辿る最大深さ（デフォルト: 4）

**Use-case**:
- ファイル変更時の影響範囲調査
- API変更の影響分析
- 下位互換性の検証

## 利用可能な解析タイプ

### file-overview
ファイルの基本情報と概要分析を行います。

**解析内容**:
- ファイルの大分類（プログラム、ドキュメント、設定ファイル等）
- 記述言語・技術、ファイルタイプ・用途
- 内容の要約とファイルの目的推定
- 改善案・修正点の数値レベル付き評価

**Use-case**:
- 新しいプロジェクトの概要把握
- ファイル構成の妥当性確認
- 品質レベルの初期評価

### import-and-export-details
対象ファイルの依存関係についての詳細を調査します。

**解析内容**:
- 依存関係の詳細（名前付きインポート、全体インポート等）
- 動的インポートの検出（実行時に決まる依存関係）
- グローバル変数・定数の利用
- Prototype Pollutionの可能性
- モジュールインターフェース（exports）の構造

**Use-case**:
- 依存関係の可視化と整理
- 動的インポートによるリスク評価
- モジュール設計の妥当性確認

### refactoring-suggestion-1
型定義、モジュールスタイルの修正など、モダン化に焦点を当てた分析です。

**解析内容**:
- 型定義が曖昧なexportの特定
- 定数への`as const`付与推奨
- ESM方式でのexport推奨
- 名前付きインポートの使用推奨

**Use-case**:
- TypeScript・ESMスタイルの現代化
- 型安全性の向上
- モジュールシステムの統一

### refactoring-suggestion-2
潜在的なバグ、非推奨のメソッド呼び出しについての調査です。

**解析内容**:
- importされたオブジェクトの変更検出
- モジュール内部への不正な参照
- 引数に対する意図しない副作用
- 非推奨の`new Buffer()`使用検出
- タイミング攻撃脆弱性（crypto比較）

**Use-case**:
- セキュリティリスクの早期発見
- 潜在的バグの予防
- 非推奨API使用の特定

### refactoring-suggestion-3
曖昧で高次な改善項目の調査。メソッドの分割や機能ファイルの切り出し、マージ、テスト状況について検討します。

**解析内容**:
- 単一の参照元しか持たないファイルの特定
- 多すぎるexportの検出
- 長すぎるメソッドの特定
- callbackメソッドのasync/await移行提案
- **テストすべき関数の未テスト状態**（新機能）

**新機能 - テスト状況分析**:
関連ファイル機能により、同ディレクトリのテストファイルを自動検出し、以下の基準でテスト不足を評価：
- 「簡単にテストできる関数」: 純粋関数、文字列処理、数値計算等
- 「テストに重要性がある関数」: エクスポートされたAPI、複雑なロジック等

**Use-case**:
- アーキテクチャレベルの改善
- コードの構造化と整理
- 保守性の向上
- **テストカバレッジの改善**（新機能）
- **品質保証の強化**（新機能）

### database-accesses
外部ライブラリを利用したDBアクセスを行っている箇所を探します。

**解析内容**:
- MongoDB（mongoose, mongodb等）
- BigQuery（@google-cloud/bigquery等）
- Redis（redis, ioredis等）
- その他各種データベースライブラリ

**Use-case**:
- データアクセス層の可視化
- DB依存性の整理
- パフォーマンス改善ポイントの特定

## 典型的なワークフロー

### 1. プロジェクト全体の品質調査
```
1. reverseLookupFindings で問題があるファイルを特定
2. getAnalysisResults で詳細な問題内容を確認
3. 優先度の高い問題から順次対処
```

### 2. 特定ファイルの詳細分析
```
1. getAnalysisResults で複数の解析タイプを一括取得
2. file-overview で基本情報を把握
3. import-and-export-details で依存関係を確認
4. refactoring-suggestion で改善点を特定
```

### 3. リファクタリング影響範囲調査
```
1. traverseImportPaths で影響範囲を調査
2. followExportTrails で被影響ファイルを特定
3. analyze で依存関係の健全性を確認
```

### 4. 不要ファイルの整理
```
1. noDependents で参照されていないファイルを特定
2. analyze で依存関係を再確認
3. 安全に削除可能なファイルを選別
```

## ベストプラクティス

### 効率的な使い方
- reverseLookupFindingsで概要を把握してからgetAnalysisResultsで詳細確認
- findingIndicesを活用して特定の問題タイプに絞り込み
- maxResultsで段階的に結果を取得

### 注意点
- 解析結果は事前にキャッシュされたデータを使用
- 最新の結果が必要な場合は事前に`code-bugs analysis`コマンドで解析実行
- baseDirとtargetの組み合わせでパスが正しく構成されることを確認

### 効果的な分析順序
1. 全体的な問題傾向の把握（reverseLookupFindings）
2. 重要度の高い問題の詳細確認（getAnalysisResults）
3. 依存関係の健全性確認（analyze, traverseImportPaths等）
4. 個別ファイルの詳細分析（getAnalysisResults with details=true）

このガイドを参考に、プロジェクトの品質向上と効率的なコード分析を行ってください。