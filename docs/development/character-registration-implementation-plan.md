# 実装計画: キャラクター登録支援機能

## 概要

operator-managerに、未登録のSpeaker/Styleの検出と話速測定→キャラクタ登録する機能を追加します。
この機能はoperator-managerに直接統合し、既存の型定義を整理・改善しながら実装します。

**重要な設計方針**:
- MCPツールは作成しない（頻繁に使う機能ではないため）
- 別クラスは作らず、OperatorManagerに直接統合
- 既存の型定義（特にCharacter型）をリファクタリング
- すべてのAPI stylesを利用可能にする（morasPerSecondはオプショナル）

## 現状の理解

### 既存のコンポーネント構成

```
OperatorManager
├── ConfigManager: 設定ファイル管理
│   ├── buildDynamicConfig(): COEIROINK APIから動的設定を構築
│   ├── getCharacterConfig(): キャラクター設定を取得
│   └── loadConfig(): ユーザー設定を読み込み
├── CharacterInfoService: キャラクター情報管理
│   ├── getCharacterInfo(): Character情報を取得
│   └── selectStyle(): スタイルを選択
└── FileOperationManager: セッション情報管理

SpeakerProvider: COEIROINK APIクライアント
└── getSpeakers(): Speaker一覧を取得

measure-speech-rate.ts: 話速測定スクリプト
└── measureSpeechRate(): 全Speaker/Style測定
```

### データフロー

```
COEIROINK API (speakers)
    ↓
SpeakerProvider.getSpeakers()
    ↓
ConfigManager.buildDynamicConfig()
    ↓ (マージ)
├── BUILTIN_CHARACTER_CONFIGS (character-defaults.ts)
└── ユーザー定義キャラクター (config.json)
    ↓
CharacterInfoService.getCharacterInfo()
    ↓
OperatorManager (オペレーター割り当て)
```

### 現在の型定義の問題点

1. **Character型にspeakerオブジェクトが含まれている**
   - packages/core/src/types.ts: Character.speaker
   - 不要な冗長性（speakerIdとspeakerNameだけで十分）

2. **morasPerSecondが必須のように扱われている**
   - すべてのAPI stylesを利用可能にすべき
   - morasPerSecondはオプショナルな付加情報

3. **API型、設定型、実行時型が混在**
   - 明確に分離すべき

## 新機能の要件

### 機能1: 未登録のSpeaker/Style検出

**目的**: COEIROINKで利用可能だが、設定ファイルに登録されていないSpeaker/Styleを特定する

**処理フロー**:
```
1. COEIROINK APIからSpeaker一覧を取得
2. ConfigManagerから登録済みキャラクター一覧を取得
3. speakerIdで突合
4. 各Speakerについて分類:
   - 完全未登録（speakerIdがどこにもない）
   - 部分登録（speakerIdは登録済みだが、一部のstyleのmorasPerSecondがない）
   - 完全登録（すべてのstyleにmorasPerSecondがある）
5. 結果を返す
```

### 機能2: 話速測定→キャラクタ登録

**目的**: 未登録のSpeaker/Styleの話速を測定し、設定ファイルに追加する

**処理フロー**:
```
1. 指定されたSpeaker/Styleを検証
2. 話速測定機能で測定
3. 測定結果を表示
4. config.json形式で設定データを生成
5. ConfigManager.updateCharacterConfig()で登録
6. 結果を返す
```

## 設計: 型定義のリファクタリング

### 新しい型定義

```typescript
// ============================================================
// API型（COEIROINK APIから取得されるデータ）
// ============================================================

interface StyleFromAPI {
  styleId: number;
  styleName: string;
}

interface SpeakerFromAPI {
  speakerUuid: string;
  speakerName: string;
  styles: StyleFromAPI[];
}

// ============================================================
// 設定型（config.jsonに保存されるデータ）
// ============================================================

interface StyleConfigData {
  styleName: string;
  morasPerSecond?: number;  // オプショナル！
  personality?: string;
  speakingStyle?: string;
}

interface CharacterConfigData {
  speakerId: string;  // COEIROINK speakerUuid
  name: string;
  personality: string;
  speakingStyle: string;
  greeting: string;
  farewell: string;
  defaultStyleId: number;
  styles: Record<number, StyleConfigData>;  // styleId → config
}

// ============================================================
// 実行時型（マージされた結果）
// ============================================================

interface Style {
  styleId: number;
  styleName: string;
  morasPerSecond?: number;  // オプショナル！
  personality?: string;
  speakingStyle?: string;
}

interface Character {
  characterId: string;
  speakerId: string;      // COEIROINK speakerUuid
  speakerName: string;    // Display name
  personality: string;
  speakingStyle: string;
  greeting: string;
  farewell: string;
  defaultStyleId: number;
  styles: Record<number, Style>;  // すべてのstyles（API + config merged）
}
```

### mergeStyles関数

すべてのAPI stylesを利用可能にするためのマージ関数:

```typescript
/**
 * API stylesとconfig stylesをマージ
 * - すべてのAPI stylesが利用可能
 * - morasPerSecondなどの付加情報はconfigから追加
 */
function mergeStyles(
  apiStyles: StyleFromAPI[],
  configStyles: Record<number, StyleConfigData> = {},
  characterPersonality: string,
  characterSpeakingStyle: string
): Record<number, Style> {
  const merged: Record<number, Style> = {};

  for (const apiStyle of apiStyles) {
    const config = configStyles[apiStyle.styleId];

    merged[apiStyle.styleId] = {
      styleId: apiStyle.styleId,
      styleName: apiStyle.styleName,
      morasPerSecond: config?.morasPerSecond,  // undefined if not configured
      personality: config?.personality || characterPersonality,
      speakingStyle: config?.speakingStyle || characterSpeakingStyle,
    };
  }

  return merged;
}
```

## 実装計画

### Phase 1: 型定義のリファクタリング

**目的**: Character型をフラット化し、すべてのAPI stylesを利用可能にする

**ファイル**: `packages/core/src/types.ts`, `packages/core/src/operator/character-defaults.ts`

**実装内容**:

1. **型定義の更新**:
   ```typescript
   // packages/core/src/types.ts

   // Character型からspeakerフィールドを削除
   export interface Character {
     characterId: string;
     speakerId: string;      // 追加
     speakerName: string;    // 追加
     personality: string;
     speakingStyle: string;
     greeting: string;
     farewell: string;
     defaultStyleId: number;
     styles: Record<number, Style>;  // 実行時型
   }

   // Style型のmorasPerSecondをオプショナルに
   export interface Style {
     styleId: number;
     styleName: string;
     morasPerSecond?: number;  // オプショナル化
     personality?: string;
     speakingStyle?: string;
   }

   // StyleConfigDataも同様に
   export interface StyleConfigData {
     styleName: string;
     morasPerSecond?: number;  // オプショナル化
     personality?: string;
     speakingStyle?: string;
   }
   ```

2. **mergeStyles関数の実装**:
   ```typescript
   // packages/core/src/operator/config-manager.ts
   // または新規 packages/core/src/operator/style-merger.ts

   export function mergeStyles(
     apiStyles: StyleFromAPI[],
     configStyles: Record<number, StyleConfigData> = {},
     characterPersonality: string,
     characterSpeakingStyle: string
   ): Record<number, Style> {
     // 上記の実装
   }
   ```

3. **ConfigManager.buildDynamicConfig()の更新**:
   ```typescript
   // packages/core/src/operator/config-manager.ts (lines 169-270)

   async buildDynamicConfig(): Promise<void> {
     // ...

     // ビルトインキャラクターの処理
     for (const [characterId, builtinConfig] of Object.entries(BUILTIN_CHARACTER_CONFIGS)) {
       const speaker = availableSpeakers.find(s => s.speakerUuid === builtinConfig.speakerId);
       if (!speaker) continue;

       const userCharacterConfig = config.characters?.[characterId] || {};
       if (userCharacterConfig.disabled) continue;

       // mergeStyles()を使用
       dynamicCharacters[characterId] = {
         ...builtinConfig,
         ...userCharacterConfig,
         speakerId: speaker.speakerUuid,     // 追加
         speakerName: speaker.speakerName,   // 追加
         styles: mergeStyles(
           speaker.styles,
           {
             ...builtinConfig.styles,
             ...userCharacterConfig.styles,
           },
           userCharacterConfig.personality || builtinConfig.personality,
           userCharacterConfig.speakingStyle || builtinConfig.speakingStyle
         ),
       };
     }

     // ユーザー定義キャラクターも同様に更新
   }
   ```

4. **CharacterInfoService.selectStyle()の更新**:
   ```typescript
   // packages/core/src/operator/character-info-service.ts (lines 140-169)

   selectStyle(character: Character, specifiedStyle: string | null = null): Style {
     // character.speaker.styles → character.styles に変更
     if (!character.styles || Object.keys(character.styles).length === 0) {
       throw new Error(`キャラクター '${character.characterId}' に利用可能なスタイルがありません`);
     }

     const styles = Object.values(character.styles);

     if (specifiedStyle) {
       const style = styles.find(s => s.styleName === specifiedStyle);
       if (!style) {
         throw new Error(`スタイル '${specifiedStyle}' が見つかりません`);
       }
       return style;
     }

     // デフォルトスタイルを返す
     const defaultStyle = character.styles[character.defaultStyleId];
     if (!defaultStyle) {
       return styles[0];
     }
     return defaultStyle;
   }
   ```

5. **既存機能の動作確認**:
   - ビルド: `pnpm run build`
   - テスト: `pnpm test`
   - 型チェック: `pnpm run typecheck`

### Phase 2: ConfigManagerの拡張

**目的**: キャラクター設定を更新できるメソッドを追加

**ファイル**: `packages/core/src/operator/config-manager.ts`

**実装内容**:

1. **updateCharacterConfig()メソッドの追加**:
   ```typescript
   // packages/core/src/operator/config-manager.ts

   /**
    * キャラクター設定を更新
    * - 既存キャラクターの場合: stylesはマージ、他のフィールドは上書き
    * - 新規キャラクターの場合: 新規追加
    */
   async updateCharacterConfig(
     characterId: string,
     updates: Partial<CharacterConfigData>
   ): Promise<void> {
     // 1. 既存のconfig.jsonを読み込み
     const currentConfig = await this.loadConfig();

     // 2. 既存キャラクターの取得
     const existingCharacter = currentConfig.characters?.[characterId];

     // 3. マージロジック
     const updatedCharacter = existingCharacter
       ? {
           // 既存: stylesはマージ、他は上書き
           ...existingCharacter,
           ...updates,
           styles: {
             ...existingCharacter.styles,
             ...updates.styles,
           },
         }
       : {
           // 新規: そのまま追加
           ...updates,
         };

     // 4. config.jsonに書き込み
     const updatedConfig = {
       ...currentConfig,
       characters: {
         ...currentConfig.characters,
         [characterId]: updatedCharacter,
       },
     };

     await this.writeJsonFile(this.configFile, updatedConfig);

     // 5. 動的設定を再構築
     await this.buildDynamicConfig();
   }
   ```

2. **動作確認**:
   - ビルド: `pnpm run build`
   - テスト追加（オプション）

### Phase 3: OperatorManagerへの統合

**目的**: 検出・測定・登録機能をOperatorManagerに統合

**ファイル**: `packages/core/src/operator/index.ts`

**実装内容**:

1. **detectUnregisteredSpeakers()メソッドの追加**:
   ```typescript
   // packages/core/src/operator/index.ts

   /**
    * 未登録のSpeaker/Styleを検出
    */
   async detectUnregisteredSpeakers(): Promise<{
     registered: Array<{
       speakerId: string;
       speakerName: string;
       characterId: string;
       registeredStyles: number;
       totalStyles: number;
       allStylesHaveSpeechRate: boolean;
     }>;
     partiallyRegistered: Array<{
       speakerId: string;
       speakerName: string;
       characterId: string;
       missingStyles: Array<{
         styleId: number;
         styleName: string;
       }>;
     }>;
     unregistered: Array<{
       speakerId: string;
       speakerName: string;
       totalStyles: number;
       styles: Array<{
         styleId: number;
         styleName: string;
       }>;
     }>;
   }> {
     // 1. API Speakersを取得
     const speakerProvider = getSpeakerProvider();
     const apiSpeakers = await speakerProvider.getSpeakers();

     // 2. 登録済みキャラクターを取得
     const mergedConfig = this.configManager.getMergedConfig();
     const characters = mergedConfig?.characters || {};

     const registered = [];
     const partiallyRegistered = [];
     const unregistered = [];

     // 3. 各Speakerを分類
     for (const speaker of apiSpeakers) {
       const registeredChar = Object.entries(characters).find(
         ([_, config]) => config.speakerId === speaker.speakerUuid
       );

       if (!registeredChar) {
         // 完全未登録
         unregistered.push({
           speakerId: speaker.speakerUuid,
           speakerName: speaker.speakerName,
           totalStyles: speaker.styles.length,
           styles: speaker.styles.map(s => ({
             styleId: s.styleId,
             styleName: s.styleName,
           })),
         });
         continue;
       }

       const [characterId, characterConfig] = registeredChar;

       // スタイルの登録状況をチェック
       const missingStyles = speaker.styles.filter(apiStyle => {
         const styleConfig = characterConfig.styles?.[apiStyle.styleId];
         return !styleConfig || styleConfig.morasPerSecond === undefined;
       });

       if (missingStyles.length === 0) {
         // 完全登録
         registered.push({
           speakerId: speaker.speakerUuid,
           speakerName: speaker.speakerName,
           characterId,
           registeredStyles: speaker.styles.length,
           totalStyles: speaker.styles.length,
           allStylesHaveSpeechRate: true,
         });
       } else {
         // 部分登録
         partiallyRegistered.push({
           speakerId: speaker.speakerUuid,
           speakerName: speaker.speakerName,
           characterId,
           missingStyles: missingStyles.map(s => ({
             styleId: s.styleId,
             styleName: s.styleName,
           })),
         });
       }
     }

     return { registered, partiallyRegistered, unregistered };
   }
   ```

2. **measureAndRegisterSpeaker()メソッドの追加**:
   ```typescript
   /**
    * Speaker/Styleの話速を測定して登録
    */
   async measureAndRegisterSpeaker(
     speakerName: string,
     styleName?: string,
     characterId?: string
   ): Promise<{
     speakerId: string;
     speakerName: string;
     measurements: Array<{
       styleId: number;
       styleName: string;
       morasPerSecond: number;
     }>;
   }> {
     // 1. Speakerを検証
     const speakerProvider = getSpeakerProvider();
     const apiSpeakers = await speakerProvider.getSpeakers();

     const speaker = apiSpeakers.find(s => s.speakerName === speakerName);
     if (!speaker) {
       throw new Error(`Speaker "${speakerName}" が見つかりません`);
     }

     // 2. 測定対象のスタイルを決定
     const targetStyles = styleName
       ? speaker.styles.filter(s => s.styleName === styleName)
       : speaker.styles;

     if (targetStyles.length === 0) {
       throw new Error(`Style "${styleName}" が見つかりません`);
     }

     // 3. 話速測定（measure-speech-rate.tsから抽出した測定ロジック）
     const measurements = await this.measureSpeechRateForStyles(
       speaker.speakerUuid,
       targetStyles
     );

     // 4. characterIdの決定
     const finalCharacterId = characterId || this.generateCharacterId(speakerName);

     // 5. config.jsonに登録
     await this.configManager.updateCharacterConfig(finalCharacterId, {
       speakerId: speaker.speakerUuid,
       name: speaker.speakerName,
       personality: '',
       speakingStyle: '',
       greeting: '',
       farewell: '',
       defaultStyleId: targetStyles[0].styleId,
       styles: Object.fromEntries(
         measurements.map(m => [
           m.styleId,
           {
             styleName: m.styleName,
             morasPerSecond: m.morasPerSecond,
           },
         ])
       ),
     });

     return {
       speakerId: speaker.speakerUuid,
       speakerName: speaker.speakerName,
       measurements,
     };
   }
   ```

3. **測定ロジックのヘルパーメソッド**:
   ```typescript
   /**
    * 指定されたスタイルの話速を測定
    * （measure-speech-rate.tsから測定ロジックを抽出）
    */
   private async measureSpeechRateForStyles(
     speakerId: string,
     styles: StyleFromAPI[]
   ): Promise<Array<{
     styleId: number;
     styleName: string;
     morasPerSecond: number;
   }>> {
     // TODO: measure-speech-rate.tsの測定ロジックを実装
     // - TEST_TEXTSを使用
     // - モーラ数カウント
     // - WAVファイル生成→再生時間測定
     // - morasPerSecond計算

     throw new Error('Not implemented yet');
   }

   /**
    * Speaker名からcharacterIdを生成
    */
   private generateCharacterId(speakerName: string): string {
     // speakerIdプレフィックスまたはユーザ指定を推奨
     // 簡易実装としてspeaker名の小文字化
     return speakerName.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
   }
   ```

4. **動作確認**:
   - ビルド: `pnpm run build`
   - 型チェック: `pnpm run typecheck`
   - 手動テスト（スクリプトまたはREPL）

## 考慮事項

### 既存コードへの影響

**Phase 1の影響範囲**:
- ConfigManager.buildDynamicConfig()
- CharacterInfoService.selectStyle()
- MCPサーバー（packages/mcp/src/server.ts）の型参照箇所

**確認事項**:
- 既存テストの実行
- 型エラーの解消
- ビルド成功

### 後方互換性

- Character型の変更は破壊的
- すべての参照箇所を更新する必要あり
- マイグレーションは不要（実行時に動的にマージ）

### エラーハンドリング

- COEIROINK APIへの接続失敗
- 測定失敗時のエラーメッセージ
- config.json書き込み失敗時のバックアップ（ConfigManager.writeJsonFile()で対応済み）

### パフォーマンス

- 測定時の進捗表示（オプション）
- 非同期処理による応答性

## テスト戦略

### Phase 1
- ConfigManager.buildDynamicConfig()のテスト
- mergeStyles()のユニットテスト
- CharacterInfoService.selectStyle()のテスト

### Phase 2
- ConfigManager.updateCharacterConfig()のテスト
- マージロジックの検証

### Phase 3
- detectUnregisteredSpeakers()のテスト（モックデータ）
- measureAndRegisterSpeaker()の統合テスト

## 完了の定義

### Phase 1
- ✅ Character型がフラット化され、speakerフィールドが削除されている
- ✅ morasPerSecondがオプショナルになっている
- ✅ mergeStyles()関数が実装されている
- ✅ 既存機能が正常動作している（テスト・ビルド成功）

### Phase 2
- ✅ ConfigManager.updateCharacterConfig()が実装されている
- ✅ スタイルマージロジックが正しく動作している

### Phase 3
- ✅ OperatorManagerに検出・測定・登録機能が統合されている
- ✅ 手動テストで動作確認済み

## 次のステップ

Phase 1から順次実装を開始します。各Phaseの完了後、次のPhaseに進みます。

---

**作成日**: 2025-01-11
**更新日**: 2025-01-11
**作成者**: Claude Code
