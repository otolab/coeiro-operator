# 音声再生停止機能 調査レポート

## 調査日時
2025年1月16日

## 調査概要
COEIRO Operator音声システムにおける再生停止機能の実装可能性と必要な変更箇所の調査

## 現状分析

### 1. アーキテクチャの問題点

#### Speakerインスタンス管理の欠如
現在のAudioPlayerクラスは、Speakerインスタンスへの永続的な参照を保持していません：

1. **playPCMData()メソッド** (audio-player.ts:568-609)
   - 毎回新しいSpeakerインスタンスを作成
   - ローカル変数としてのみ保持
   - 再生完了後に自動的に破棄

2. **processAudioStreamPipeline()メソッド** (audio-player.ts:215-262)
   - ストリーミング処理でも同様の問題
   - パイプライン完了後に自動でclose

3. **cleanup()メソッド** (audio-player.ts:816-831)
   - Speaker関連の処理が実装されていない

### 2. 技術的可能性

#### node-speaker ライブラリの機能
- バージョン: 0.5.5
- WritableStreamベースの実装
- **destroy()メソッドが利用可能**
  - ストリームを即座に終了
  - リソースを解放
  - closeイベントを発火

#### 現在の制約
- queue_clearツール: 「現在再生中の音声は停止しません」と明記
- キュー管理と再生制御が独立
- 停止関連のテストコードが存在しない

## 実装提案

### Option A: 最小限の実装（推奨）

#### 概要
現在再生中のSpeakerインスタンスのみを管理し、停止機能を追加

#### 実装内容
```typescript
class AudioPlayer {
  private currentSpeaker: Speaker | null = null;

  private async playPCMData(...) {
    const speaker = await this.createSpeaker(...);
    this.currentSpeaker = speaker;

    speaker.once('close', () => {
      if (this.currentSpeaker === speaker) {
        this.currentSpeaker = null;
      }
      resolve();
    });

    speaker.end(Buffer.from(processedData));
  }

  async stopPlayback(): Promise<void> {
    if (this.currentSpeaker) {
      this.currentSpeaker.destroy();
      this.currentSpeaker = null;
    }
  }
}
```

#### メリット
- 実装が比較的シンプル
- 既存コードへの影響が最小限
- 後方互換性を維持

#### デメリット
- 複数のSpeakerインスタンスが同時に存在する場合の制御が困難
- ストリーミング処理での停止が不完全になる可能性

### Option B: 完全な実装

#### 概要
すべてのアクティブなSpeakerインスタンスを管理

#### 実装内容
```typescript
class AudioPlayer {
  private activeSpeakers: Set<Speaker> = new Set();

  private async playPCMData(...) {
    const speaker = await this.createSpeaker(...);
    this.activeSpeakers.add(speaker);

    speaker.once('close', () => {
      this.activeSpeakers.delete(speaker);
      resolve();
    });

    speaker.end(Buffer.from(processedData));
  }

  async stopAllPlayback(): Promise<void> {
    const promises = Array.from(this.activeSpeakers).map(speaker => {
      return new Promise<void>(resolve => {
        speaker.once('close', resolve);
        speaker.destroy();
      });
    });

    await Promise.all(promises);
    this.activeSpeakers.clear();
  }
}
```

#### メリット
- すべての再生中音声を確実に停止
- 並列再生やストリーミング処理にも対応
- より堅牢な実装

#### デメリット
- 実装が複雑
- メモリリークのリスク（適切な管理が必要）
- テストが複雑

## MCPツール実装案

### playback_stop ツール

```typescript
server.registerTool(
  'playback_stop',
  {
    description: '現在再生中の音声を停止します',
    inputSchema: {}
  },
  async (): Promise<ToolResponse> => {
    try {
      await sayCoeiroink.stopPlayback();

      return {
        content: [{
          type: 'text',
          text: '⏹️ 音声再生を停止しました'
        }]
      };
    } catch (error) {
      throw new Error(`再生停止エラー: ${(error as Error).message}`);
    }
  }
);
```

## 必要な変更箇所

### 1. packages/audio/src/audio-player.ts
- currentSpeaker(s)プロパティの追加
- playPCMData()でSpeaker管理の実装
- processAudioStreamPipeline()でSpeaker管理の実装
- stopPlayback()メソッドの追加
- cleanup()メソッドでSpeaker停止処理の追加

### 2. packages/audio/src/index.ts
- stopPlayback()メソッドのエクスポート

### 3. packages/mcp/src/server.ts
- playback_stopツールの追加

### 4. テストファイル
- audio-player.test.tsに停止機能のテスト追加
- モックSpeakerのdestroy呼び出し検証

## リスク評価

### 技術的リスク
- **中〜高**: Speakerインスタンス管理の追加は、メモリリークや予期しない動作を引き起こす可能性
- **対策**:
  - closeイベントでの確実なクリーンアップ
  - エラーハンドリングの徹底
  - 包括的なテストの実装

### 互換性リスク
- **低**: 新機能の追加のため、既存機能への影響は最小限
- **対策**: 既存のテストがすべてパスすることを確認

## 推奨実装方針

1. **Phase 1: Option Aの実装**
   - 最小限の実装で基本機能を提供
   - 単一のcurrentSpeaker管理
   - playback_stopツールの追加

2. **Phase 2: 改善とテスト**
   - エラーハンドリングの強化
   - 包括的なテストの追加
   - パフォーマンス検証

3. **Phase 3: Option Bへの拡張（必要に応じて）**
   - 複数Speaker管理への移行
   - ストリーミング処理の完全サポート

## 結論

音声再生停止機能の実装は技術的に可能ですが、現在のアーキテクチャでは大幅な改修が必要です。

**推奨事項**：
1. まずOption A（最小限の実装）で基本機能を実装
2. 実運用でのフィードバックを収集
3. 必要に応じてOption Bへ拡張

この段階的アプローチにより、リスクを最小限に抑えながら機能を提供できます。