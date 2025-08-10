# API リファレンス

COEIRO OperatorのMCPツール、CLIコマンド、JavaScript APIの完全リファレンスです。

## MCPツール

### operator_assign

オペレータの割り当てを行います。

#### パラメータ
```typescript
{
  operator?: string;  // 指定オペレータ名（英語表記、例: 'tsukuyomi'。省略時ランダム）
  style?: string;     // 指定スタイル名（例: 'normal', 'ura'。省略時デフォルト）
}
```

#### 使用例
```typescript
// ランダム割り当て
await mcp.call('operator_assign');

// 指定割り当て
await mcp.call('operator_assign', {
  operator: "tsukuyomi"
});
```

### operator_release

オペレータの解放を行います。

#### パラメータ
パラメータなし

### operator_status

現在のオペレータ状況を確認します。

#### パラメータ
パラメータなし

### operator_available

利用可能なオペレータ一覧を取得します。

#### パラメータ
パラメータなし

### say

音声合成・出力を行います（非同期キュー処理）。

#### パラメータ
```typescript
{
  text: string;               // 音声合成対象テキスト
  voice?: string;             // 音声ID（省略時オペレータ音声使用）
  rate?: number;              // 話速（50-400、デフォルト: 200）
  outputFile?: string;        // 出力ファイルパス（省略時再生）
  streamMode?: boolean;       // ストリーミング強制（デフォルト: 自動判定）
  style?: string;             // スタイルID指定
}
```

#### 戻り値
```typescript
{
  success: boolean;
  taskId?: number;            // キュータスクID
  queueLength?: number;       // キュー待ち数
  outputFile?: string;        // 出力ファイルパス
  latency?: number;           // 処理レイテンシ（ms）
  mode?: string;              // 処理モード
}
```

#### 使用例
```typescript
// 基本音声出力
await mcp.call('say', { 
  text: "こんにちは" 
});

// 詳細設定
await mcp.call('say', {
  text: "ゆっくり話します",
  rate: 150,
  style: "happy"
});

// ファイル出力
await mcp.call('say', {
  text: "ファイル保存テスト",
  outputFile: "/tmp/output.wav"
});
```

## CLIコマンド

### say-coeiroink

音声合成・出力のコマンドラインインターフェース。

#### 基本構文
```bash
say-coeiroink [options] "テキスト"
```

#### オプション
```bash
-r, --rate <number>          話速設定 (50-400)
-o, --output <file>          出力ファイル指定
-v, --voice <id>             音声ID指定
-s, --style <id>             スタイルID指定
    --stream                 ストリーミング強制
    --no-stream              バッチ処理強制
    --version                バージョン表示
    --help                   ヘルプ表示
```

#### 使用例
```bash
# 基本使用
say-coeiroink "こんにちは"

# 話速調整
say-coeiroink -r 150 "ゆっくり話します"

# ファイル出力
say-coeiroink -o output.wav "保存テスト"

# 音声・スタイル指定
say-coeiroink -v "cc213e6d-d847-45b5-a1df-415744c890f2" -s "happy" "楽しく話します"
```

### operator-manager

オペレータ管理のコマンドラインインターフェース。

#### 基本構文
```bash
operator-manager <command> [options]
```

#### コマンド
```bash
assign [options]             オペレータ割り当て
release [options]            オペレータ解放
status [options]             状況確認
available [options]          利用可能一覧
configure <operator> [opts]  キャラクター設定
config                       設定表示
reset                        設定リセット
```

#### assign オプション
```bash
-o, --operator <name>        指定オペレータ名
-s, --session <id>           セッションID
-f, --force                  強制再割り当て
-r, --random                 ランダム割り当て
```

#### configure オプション
```bash
--style-selection <mode>     スタイル選択モード (default/random/specified)
--default-style <id>         デフォルトスタイルID
--voice-id <id>              音声ID上書き
```

#### 使用例
```bash
# ランダム割り当て
operator-manager assign

# 指定割り当て
operator-manager assign --operator "tsukuyomi"

# スタイル設定
operator-manager configure "tsukuyomi" --style-selection random

# 状況確認
operator-manager status
```

## JavaScript API

### SayCoeiroink クラス

音声合成システムのメインクラス。

#### コンストラクタ
```typescript
constructor(config?: Config | null)
```

#### メソッド

##### initialize()
```typescript
async initialize(): Promise<void>
```
システム初期化を行います。

##### synthesizeText()
```typescript
async synthesizeText(
  text: string, 
  options?: SynthesizeOptions
): Promise<SynthesizeResult>
```
音声合成（同期処理）を行います。

##### synthesizeTextAsync()
```typescript
async synthesizeTextAsync(
  text: string, 
  options?: SynthesizeOptions
): Promise<SynthesizeResult>
```
音声合成（非同期キュー処理）を行います。

##### getCurrentOperatorVoice()
```typescript
async getCurrentOperatorVoice(): Promise<OperatorVoice | null>
```
現在のオペレータ音声情報を取得します。

##### listVoices()
```typescript
async listVoices(): Promise<void>
```
利用可能音声一覧を表示します。

#### 使用例
```typescript
import SayCoeiroink from 'coeiro-operator/say';

const say = new SayCoeiroink();
await say.initialize();

// 音声出力
await say.synthesizeText("こんにちは");

// 非同期キュー
await say.synthesizeTextAsync("キューに追加", {
  rate: 150
});
```

### OperatorManager クラス

オペレータ管理システムのメインクラス。

#### メソッド

##### assignOperator()
```typescript
async assignOperator(
  operatorName?: string,
  sessionId?: string,
  forceReassign?: boolean
): Promise<OperatorAssignResult>
```

##### releaseOperator()
```typescript
async releaseOperator(sessionId?: string): Promise<OperatorReleaseResult>
```

##### showCurrentOperator()
```typescript
async showCurrentOperator(sessionId?: string): Promise<OperatorStatus>
```

##### listAvailableOperators()
```typescript
async listAvailableOperators(sessionId?: string): Promise<AvailableOperators>
```

#### 使用例
```typescript
import { OperatorManager } from 'coeiro-operator/operator';

const manager = new OperatorManager();
await manager.initialize();

// オペレータ割り当て
const result = await manager.assignOperator("tsukuyomi");

// 状況確認
const status = await manager.showCurrentOperator();
```

## 型定義

### Config
```typescript
interface Config {
  host: string;
  port: string;
  rate: number;
  voice_id?: string;
  style_id?: number;
  synthesisRate?: number;      // 音声生成時サンプルレート
  playbackRate?: number;       // 再生時サンプルレート
  defaultBufferSize?: number;
  noiseReduction?: boolean;
  lowpassFilter?: boolean;
  lowpassCutoff?: number;
}
```

### SynthesizeOptions
```typescript
interface SynthesizeOptions {
  voice?: string | OperatorVoice | null;
  rate?: number;
  outputFile?: string | null;
  streamMode?: boolean;
  style?: string;
}
```

### OperatorVoice
```typescript
interface OperatorVoice {
  voice_id: string;
  character?: {
    available_styles?: Record<string, StyleInfo>;
    style_selection: string;
    default_style: string;
  };
}
```

### CharacterInfo
```typescript
interface CharacterInfo {
  name: string;
  voice_id: string;
  description: string;
  personality: string[];
  available_styles: Record<string, StyleInfo>;
  style_selection: string;
  default_style: string;
}
```

## エラーハンドリング

### 一般的なエラー

#### COEIROINK接続エラー
```typescript
{
  error: "ECONNREFUSED",
  message: "Cannot connect to COEIROINK server (http://localhost:50032)"
}
```

#### オペレータ割り当てエラー
```typescript
{
  error: "OPERATOR_UNAVAILABLE", 
  message: "Operator 'tsukuyomi' is already assigned"
}
```

#### 音声合成エラー
```typescript
{
  error: "SYNTHESIS_FAILED",
  message: "HTTP 400: Invalid voice_id"
}
```

### エラー処理例
```typescript
try {
  await mcp.call('say', { text: "テスト" });
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    console.error('COEIROINKサーバーが起動していません');
  } else if (error.code === 'SYNTHESIS_FAILED') {
    console.error('音声合成に失敗しました:', error.message);
  } else {
    console.error('予期しないエラー:', error);
  }
}
```

## イベント・フック

### 音声出力完了イベント
```typescript
say.on('synthesis_complete', (result) => {
  console.log(`音声出力完了: ${result.latency}ms`);
});
```

### オペレータ変更イベント
```typescript
manager.on('operator_assigned', (operator) => {
  console.log(`新しいオペレータ: ${operator.name}`);
});
```

## レート制限・クォータ

### 並列処理制限
- **同時音声合成**: 最大3並列
- **キュー待ち**: 最大100タスク
- **タイムアウト**: 30秒/タスク

### リソース制限
- **最大音声長**: 10分
- **メモリ使用量**: 最大500MB
- **ファイルサイズ**: 最大100MB