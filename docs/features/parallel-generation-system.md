# 並行チャンク生成システムガイド

COEIRO Operatorに実装された並行チャンク生成システムについて説明します。

## 概要

並行チャンク生成システムは、音声合成の高速化を目的とした新機能です。従来の逐次生成（チャンクを順番に1つずつ生成）に対して、複数チャンクを並行生成することで体感レイテンシを大幅に削減します。

## アーキテクチャ

### 主要コンポーネント

#### 1. ChunkGenerationManager (`src/core/say/chunk-generation-manager.ts`)
並行チャンク生成の制御を担当します。

**主要機能**:
- 最大並行数制御（デフォルト: 2）
- リクエスト間隔制御（デフォルト: 50ms）
- 生成完了の管理とメモリ効率化
- 生成統計の収集

**使用例**:
```typescript
const manager = new ChunkGenerationManager(synthesizeFunction, {
  maxConcurrency: 2,
  delayBetweenRequests: 50
});

await manager.startGeneration(chunk0, voiceInfo, speed);
await manager.startGeneration(chunk1, voiceInfo, speed);

const result0 = await manager.getResult(0);
const result1 = await manager.getResult(1);
```

#### 2. AudioStreamController (`src/core/say/audio-stream-controller.ts`)
生成と再生の協調制御を行います。

**主要機能**:
- 逐次/並行モードの動的切り替え
- シリアル再生順序の保証
- 先読みバッファ制御
- 設定ベースの動作制御

**使用例**:
```typescript
const controller = new AudioStreamController(synthesizeFunction, {
  enableParallelGeneration: true,
  maxConcurrency: 2,
  bufferAheadCount: 1
});

for await (const result of controller.synthesizeStream(chunks, voice, speed)) {
  // 順序が保証された音声結果を再生
  await playAudio(result);
}
```

### 動作フロー

#### 従来の逐次生成
```
チャンク0: [生成] → [再生] → 完了
チャンク1:               [生成] → [再生] → 完了
チャンク2:                         [生成] → [再生] → 完了
```

#### 新しい並行生成
```
チャンク0: [生成] → [再生] → 完了
チャンク1:   [生成] → [待機] → [再生] → 完了
チャンク2:      [生成] → [待機] → [再生] → 完了
```

**効果**: チャンク0の再生開始時点で、チャンク1は既に生成完了済み

## 設定

### 設定ファイル

`~/.coeiro-operator/coeiroink-config.json`の`audio.parallelGeneration`セクション：

```json
{
  "audio": {
    "parallelGeneration": {
      "enabled": false,
      "maxConcurrency": 2,
      "delayBetweenRequests": 50,
      "bufferAheadCount": 1
    }
  }
}
```

### 設定項目

| 項目 | デフォルト | 範囲 | 説明 |
|------|------------|------|------|
| `enabled` | `false` | - | 並行生成の有効/無効 |
| `maxConcurrency` | `2` | 1-5 | 最大並行生成数 |
| `delayBetweenRequests` | `50` | 0-1000 | リクエスト間隔（ms） |
| `bufferAheadCount` | `1` | 0-3 | 先読みチャンク数 |

### 推奨設定

#### 高速重視
```json
{
  "enabled": true,
  "maxConcurrency": 3,
  "delayBetweenRequests": 30,
  "bufferAheadCount": 2
}
```

#### 安定性重視
```json
{
  "enabled": true,
  "maxConcurrency": 2,
  "delayBetweenRequests": 100,
  "bufferAheadCount": 1
}
```

#### 省メモリ
```json
{
  "enabled": true,
  "maxConcurrency": 2,
  "delayBetweenRequests": 50,
  "bufferAheadCount": 0
}
```

## MCPツールでの制御

### parallel_generation_control ツール

動的な設定変更が可能です：

#### 有効化
```json
{
  "name": "parallel_generation_control",
  "arguments": {
    "action": "enable"
  }
}
```

#### 設定確認
```json
{
  "name": "parallel_generation_control",
  "arguments": {
    "action": "status"
  }
}
```

#### オプション更新
```json
{
  "name": "parallel_generation_control",
  "arguments": {
    "action": "update_options",
    "options": {
      "maxConcurrency": 3,
      "delayBetweenRequests": 30
    }
  }
}
```

## パフォーマンス

### 測定結果

6チャンクのテスト文章での結果：

| モード | 初回再生開始 | 全体完了時間 | 体感レイテンシ |
|--------|--------------|--------------|----------------|
| 逐次生成 | 929ms | 8.2秒 | 高 |
| 並行生成 | 929ms | 8.1秒 | **低** |

**重要**: 並行生成の効果は主に体感レイテンシの削減にあります。次のチャンクが事前に準備されるため、再生の途切れがほぼゼロになります。

### メモリ使用量

- **最大並行数2**: 約2チャンク分の音声データをメモリに保持
- **完了後自動クリア**: 再生完了と同時にメモリ解放
- **統計監視**: `parallel_generation_control`で使用量確認可能

## 開発・デバッグ

### ログ出力

デバッグモードでは詳細なログが出力されます：

```bash
node dist/mcp/server.js --debug
```

**重要なログ**:
- `チャンクN の生成開始 (並行数: X)`
- `チャンクN 生成完了 (所要時間: Xms)`
- `並行生成: チャンクN 結果待機中`
- `並行生成: チャンクN 結果取得、yield開始`

### テスト方法

1. **並行生成無効でのテスト**:
```bash
echo '{"name":"parallel_generation_control","arguments":{"action":"disable"}}' | ...
```

2. **並行生成有効でのテスト**:
```bash
echo '{"name":"parallel_generation_control","arguments":{"action":"enable"}}' | ...
```

3. **パフォーマンス比較**:
複数チャンクを含む長文で体感レイテンシを確認

### トラブルシューティング

#### 問題: 並行生成が効果的でない
- **確認点**: チャンク数が少ない（2未満）場合は効果限定的
- **対策**: より長いテキストでテスト

#### 問題: メモリ使用量が多い
- **確認点**: `maxConcurrency`と`bufferAheadCount`の設定
- **対策**: 値を下げて調整

#### 問題: 音声の順序が乱れる
- **確認点**: AudioStreamControllerの順序制御
- **対策**: デバッグログで生成・再生順序を確認

## まとめ

並行チャンク生成システムは、COEIRO Operatorの音声合成体験を大幅に改善する機能です：

**主な利点**:
- 体感レイテンシの大幅削減
- レスポンシブな音声再生
- 設定ベースの柔軟な制御

**運用のポイント**:
- デフォルト無効で安全性重視
- MCPツールでの動的制御
- パフォーマンス統計での監視
- 用途に応じた設定調整

適切な設定により、音声合成システムの応答性を大幅に向上させることができます。