# 音声アーキテクチャ仕様書

COEIRO Operatorにおける音声関連の型定義と概念の詳細説明

## 📋 概要

COEIRO Operatorは、COEIROINKの音声合成機能を拡張し、キャラクター性や性格を付与した音声オペレータシステムを提供します。このドキュメントでは、システムの中核となる型定義とその関係性について説明します。

## 🎯 主要な型定義

### 1. Speaker（音声モデル）

```typescript
/**
 * Speaker: COEIROINKの声の単位（純粋な音声モデル）
 * COEIROINK APIから取得される情報を含む
 * 音声合成時に必要な最小限の情報
 */
export interface Speaker {
    speakerId: string;      // COEIROINK APIのspeakerUuid（UUID形式）
    speakerName: string;    // COEIROINK APIのspeakerName（表示名）
    styles: Style[];        // 利用可能なスタイル一覧（COEIROINK APIから）
}
```

**特徴:**
- COEIROINKサーバーから直接取得される純粋な音声情報
- 音声合成エンジンが必要とする技術的な情報のみを含む
- 性格や口調などの付加情報は含まない

### 2. Style（音声スタイル）

```typescript
/**
 * Style: Speakerの声のバリエーション
 * 同一Speakerの異なる話し方・感情表現
 */
export interface Style {
    styleId: number;        // COEIROINK APIのstyleId
    styleName: string;      // スタイル名（例: "のーまる", "あんぬい"）
}
```

**特徴:**
- 各Speakerが持つ声のバリエーション
- 感情表現や話し方の違いを表現
- styleIdは音声合成APIの呼び出し時に使用

### 3. Character（キャラクター）

```typescript
/**
 * Character: Speakerに性格や口調の情報を付与したもの
 * ユーザーとのインタラクションに必要な全情報を含む
 */
export interface Character {
    id: string;                    // キャラクター識別子
    name: string;                  // キャラクター名
    personality: string;           // 性格設定
    speaking_style: string;        // 話し方の特徴
    greeting: string;             // 挨拶メッセージ
    farewell: string;             // 別れの挨拶
    defaultStyle: string;         // デフォルトスタイル名
    speaker: Speaker | null;      // 関連付けられたSpeaker情報
}
```

**特徴:**
- Speakerに人格・性格を付与したもの
- ユーザーフレンドリーな設定情報を含む
- デフォルトのスタイル選択を含む

### 4. VoiceConfig（音声設定）

```typescript
/**
 * VoiceConfig: 音声合成に必要な最小限の情報
 * Speaker情報と選択されたスタイルIDを含む
 */
export interface VoiceConfig {
    speaker: Speaker;           // COEIROINKのSpeaker情報
    selectedStyleId: number;    // 選択されたスタイルID
}
```

**特徴:**
- 実際の音声合成処理で使用される最終的な設定
- AudioSynthesizerが受け取る唯一の音声情報型
- CharacterからdefaultStyleを使用して生成される

## 🔄 型の変換フロー

```
ユーザー入力
    ↓
CharacterId (string)
    ↓
Character取得 (CharacterInfoService)
    ↓
VoiceConfig生成 (Speaker + selectedStyleId)
    ↓
音声合成 (AudioSynthesizer)
```

### 変換の詳細

1. **ユーザー入力 → CharacterId**
   - CLIコマンドやMCPツールからCharacterIdを受け取る
   - 例: `"tsukuyomi"`, `"alma"`

2. **CharacterId → Character**
   - CharacterInfoServiceからCharacter情報を取得
   - ConfigManagerの設定とCOEIROINKサーバーの情報を統合

3. **Character → VoiceConfig**
   - CharacterのdefaultStyleまたは指定されたスタイルを使用
   - Speaker情報とstyleIdを組み合わせてVoiceConfigを生成

4. **VoiceConfig → 音声合成**
   - AudioSynthesizerがVoiceConfigのみを受け取る
   - 純粋な音声合成処理に必要な情報のみを使用

## 🏗️ アーキテクチャの利点

### 1. 責任の分離
- **Speaker**: 音声モデルの技術的情報
- **Character**: ユーザー体験とインタラクション
- **VoiceConfig**: 音声合成の実行情報

### 2. 型安全性
- string型のIDが深い層まで伝播しない
- 各層で適切な型を使用
- コンパイル時の型チェックで誤りを防止

### 3. 拡張性
- 新しいSpeakerの追加が容易
- Character設定のカスタマイズが独立
- スタイル選択ロジックの変更が局所的

### 4. パフォーマンス
- 不要なAPI呼び出しの削減
- 入力層での一度の変換で完了
- キャッシュの複雑性を排除

## 🔌 統合ポイント

### ConfigManager
- COEIROINKサーバーから動的にSpeaker情報を取得
- ユーザー設定でCharacterをカスタマイズ
- Speaker情報とCharacter設定を統合

### CharacterInfoService
- Character情報の管理と取得
- スタイル選択ロジックの実装
- defaultStyleの管理

### OperatorManager
- セッション単位のCharacter割り当て
- オペレータの状態管理
- CharacterとSessionの関連付け

## 📝 実装例

### CharacterIdからVoiceConfigへの変換

```typescript
// index.ts内の実装
private async resolveCharacterToConfig(
    characterId: string, 
    styleName?: string | null
): Promise<VoiceConfig> {
    // CharacterInfoServiceからCharacter情報を取得
    const character = await this.operatorManager.getCharacterInfo(characterId);
    
    if (!character || !character.speaker) {
        throw new Error(`Character '${characterId}' not found or has no speaker`);
    }
    
    // スタイル選択（指定があればそれを、なければdefaultStyle）
    const selectedStyle = this.operatorManager.selectStyle(character, styleName);
    
    return {
        speaker: character.speaker,
        selectedStyleId: selectedStyle.styleId
    };
}
```

### 音声合成の実行

```typescript
// AudioSynthesizer内の実装
async synthesizeChunk(
    chunk: Chunk, 
    voiceConfig: VoiceConfig, 
    speed: number
): Promise<AudioResult> {
    // VoiceConfigから必要な情報を取得
    const voiceId = voiceConfig.speaker.speakerId;
    const styleId = voiceConfig.selectedStyleId;
    
    // COEIROINK APIを呼び出し
    const synthesisParam = {
        text: chunk.text,
        speakerUuid: voiceId,
        styleId: styleId,
        speedScale: speed,
        // ... その他のパラメータ
    };
    
    // 音声合成を実行
    // ...
}
```

## 📚 関連ドキュメント

- [CharacterInfoService仕様](./character-info-service.md)
- [VoiceProviderシステム](./voice-provider-system.md)
- [設定ガイド](./configuration-guide.md)
- [キャラクター一覧](./CHARACTERS.md)