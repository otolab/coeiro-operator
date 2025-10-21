# キャラクター別話速設定 調査メモ

## 調査日時
2025-01-20

## 調査目的
句読点ポーズ機能実装において、キャラクター毎の基準話速（モーラ/秒）を設定可能にするため、既存のconfig管理システムを調査

## 調査範囲
- ConfigManager の実装
- CharacterConfig の型定義
- 設定ファイルの構造
- VoiceConfig との関係

## 現在の設定システム構造

### 1. 設定ファイル階層
```
~/.coeiro-operator/
├── config.json              # 統一設定ファイル
└── active-operators.json    # セッション状態
```

### 2. 設定の優先順位
1. 内蔵デフォルト設定（BUILTIN_CHARACTER_CONFIGS）
2. 動的音声検出（COEIROINKサーバーから）
3. ユーザー設定（config.json）

### 3. 型定義の現状

#### BaseCharacterConfig (character-defaults.ts:7-15)
```typescript
export interface BaseCharacterConfig {
  speakerId: string;       // COEIROINKのspeakerUuid
  name: string;            // 表示名
  personality: string;     // 性格設定
  speakingStyle: string;   // 話し方の特徴
  greeting: string;        // 挨拶メッセージ
  farewell: string;        // お別れメッセージ
  defaultStyle: string;    // デフォルトスタイル名
}
```

#### CharacterConfig (character-defaults.ts:18-21)
```typescript
export interface CharacterConfig extends BaseCharacterConfig {
  availableStyles?: string[];  // 利用可能なスタイル一覧
  disabled?: boolean;          // キャラクター無効化フラグ
}
```

### 4. ConfigManager の実装

#### config-manager.ts の設定型 (38-56)
```typescript
interface Config {
  connection: { host: string; port: string; };
  audio: AudioConfig;
  operator: {
    rate: number;         // 現在は全体の話速（WPM）
    timeout: number;
    assignmentStrategy: 'random';
  };
  terminal: { background: TerminalBackgroundConfig; };
  characters: Record<
    string,
    Partial<BaseCharacterConfig> & { speakerId?: string; disabled?: boolean }
  >;
}
```

### 5. VoiceConfig (audio/src/types.ts:43-46)
```typescript
export interface VoiceConfig {
  speaker: Speaker;          // COEIROINKのSpeaker情報
  selectedStyleId: number;   // 選択されたスタイルID
}
```

## 発見事項

### 現状の問題点
1. **話速設定が全体設定のみ**: `operator.rate`として全キャラクター共通
2. **キャラクター個別の話速設定なし**: BaseCharacterConfigに話速フィールドなし
3. **VoiceConfigに話速情報なし**: 音声合成時に使用される設定に話速が含まれていない

### 設定ファイルの現在の構造（configuration-guide.md より）
```json
{
  "operator": {
    "rate": 200  // 全体の話速（WPM）
  },
  "characters": {
    "tsukuyomi": {
      "greeting": "カスタマイズされた挨拶"
      // baseMorasPerSecond のような個別話速設定はない
    }
  }
}
```

## 三位一体の観点での確認

### ドキュメント
- configuration-guide.md: キャラクター個別の話速設定に言及なし
- CHARACTERS.md: 未確認

### コード
- BaseCharacterConfig: 話速フィールドなし
- CharacterConfig: 話速フィールドなし
- VoiceConfig: 話速フィールドなし

### テスト
- config-manager.test.ts: 話速テストは全体設定のみ

## 実装方針案

### 案1: BaseCharacterConfigに追加
```typescript
export interface BaseCharacterConfig {
  // ... 既存フィールド ...
  baseMorasPerSecond?: number;  // キャラクター固有の基準話速
}
```

### 案2: CharacterConfigに追加
```typescript
export interface CharacterConfig extends BaseCharacterConfig {
  // ... 既存フィールド ...
  baseMorasPerSecond?: number;  // 実測値を保存
}
```

### 案3: VoiceConfigに追加（推奨）
```typescript
export interface VoiceConfig {
  speaker: Speaker;
  selectedStyleId: number;
  baseMorasPerSecond?: number;  // 動的に設定される実測値
}
```

## 推奨される実装

1. **VoiceConfigに`baseMorasPerSecond`を追加**
   - 理由: 音声合成時に直接使用される設定
   - 実測値を動的に設定可能

2. **BaseCharacterConfigにもオプショナルで追加**
   - 理由: 事前に測定した値を設定ファイルで指定可能
   - config.jsonでオーバーライド可能

3. **優先順位**
   - VoiceConfig.baseMorasPerSecond（最優先、実測値）
   - BaseCharacterConfig.baseMorasPerSecond（設定値）
   - システムデフォルト（7.5モーラ/秒）

## 次のステップ
1. CharacterInfoServiceの実装確認
2. ConfigManagerの設定読み込み処理確認
3. 実測値の保存場所の決定（メモリ？ファイル？）