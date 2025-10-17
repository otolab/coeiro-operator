# アーキテクチャ改善提案

## 現在の課題

### 1. 呼び出し階層が深い
```
TaskQueue
  └→ SynthesisProcessor.process()
      └→ AudioPlayer.playStreamingAudio()
          └→ AudioSynthesizer.synthesizeStream()
```

### 2. 責務の混在
- SynthesisProcessorが合成と再生の両方を制御
- Queueが処理実行まで担当
- 各コンポーネントが密結合

### 3. テスタビリティの低さ
- モックが困難
- エラー伝播が複雑
- 非同期処理の連鎖

## 改善提案

### Phase 1: 最小限の修正（現在のテスト修正）
現在の構造を維持しつつ、テストを通す

### Phase 2: 責務の整理
```typescript
// フラットな処理フロー
class SayCoeiroink {
  private async processSpeechTask(task: SpeechTask) {
    // 1. 音声合成（データ生成のみ）
    const audioData = await this.synthesize(task);

    // 2. 音声再生（再生のみ）
    await this.play(audioData);
  }

  private async synthesize(task: SpeechTask): Promise<AudioData[]> {
    // 純粋な音声合成
    return this.synthesizer.synthesize(task.text, task.options);
  }

  private async play(audioData: AudioData[]): Promise<void> {
    // 純粋な音声再生
    return this.player.play(audioData);
  }
}
```

### Phase 3: アーキテクチャの再設計

#### 理想的な構造
```
[Orchestrator]
    ├── [TaskQueue]      - タスク管理、abort、retry
    ├── [Synthesizer]    - 音声合成のみ
    └── [Player]         - 音声再生のみ
```

#### インターフェース定義
```typescript
interface ITaskQueue<T> {
  enqueue(task: T): Promise<void>;
  abort(taskId: number): void;
  getErrors(): Error[];
}

interface ISynthesizer {
  synthesize(text: string, options: Options): Promise<AudioData[]>;
}

interface IPlayer {
  play(audioData: AudioData[]): Promise<void>;
}
```

#### 利点
1. **単一責任**: 各コンポーネントが明確な責務
2. **テスタブル**: 独立してモック可能
3. **保守性**: 変更の影響範囲が限定的
4. **拡張性**: 新機能追加が容易

## 移行戦略

### Step 1: SynthesisProcessorの分解
- processFileOutput → FileSynthesizer
- processStreamingOutput → StreamingSynthesizer
- 各メソッドを独立したクラスへ

### Step 2: 依存関係の整理
- コンストラクタインジェクション
- インターフェース導入
- 循環依存の解消

### Step 3: Queueの簡素化
- processCallbackをフラットに
- タスク管理に専念
- ライフサイクル管理の強化

## リスクと対策

### リスク
1. 既存コードの大規模変更
2. 後方互換性の喪失
3. バグ導入の可能性

### 対策
1. 段階的な移行
2. 包括的なテスト追加
3. 旧APIのラッパー提供

## タイムライン

- **Phase 1**: 1日（即座の問題解決）
- **Phase 2**: 1週間（責務の整理）
- **Phase 3**: 2-3週間（完全な再設計）

## 結論

現在の設計は機能しているが、複雑性が高い。
段階的な改善により、よりシンプルで保守性の高いアーキテクチャへ移行可能。