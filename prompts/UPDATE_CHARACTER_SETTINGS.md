# キャラクター設定メンテナンスガイド

COEIRO Operatorのキャラクター設定データの更新・メンテナンス手順について説明します。

## 目的

このドキュメントは**開発者向け**のキャラクター設定データメンテナンス手順です。  
**ユーザー向け設定方法**については [docs/user-guide/configuration-guide.md](../docs/user-guide/configuration-guide.md) を参照してください。

## メンテナンス対象

### 1. キャラクター詳細情報（CHARACTERS.md）

**ファイル**: `docs/user-guide/CHARACTERS.md`

**目的**: 全キャラクターの性格・特徴・利用ガイドなどの詳細情報

#### 更新手順

1. **公式情報の収集**：
   - COEIROINK公式サイト（https://coeiroink.com/character/）から最新情報取得
   - 各キャラクター個別ページの詳細確認

2. **CHARACTERS.mdの更新**：
   ```bash
   $EDITOR docs/user-guide/CHARACTERS.md
   ```

3. **整合性確認**：
   - character-defaults.jsとの設定整合性
   - 新キャラクター追加時はcharacter-defaults.jsも同時更新

### 2. 内蔵キャラクター設定（character-info-service.ts）

**ファイル**: `packages/core/src/operator/character-info-service.ts`

**目的**: システム内蔵のキャラクター基本設定（挨拶・性格など）

#### 設定構造

```typescript
interface CharacterConfig {
    id: string;
    name: string;
    speakerId: string;  // COEIROINK Speaker UUID
    personality: string;
    speakingStyle: string;
    greeting: string;
    farewell: string;
    defaultStyle?: string;
    disabled?: boolean;
}

const DEFAULT_CHARACTERS: CharacterConfig[] = [
    {
        id: 'tsukuyomi',
        name: 'つくよみちゃん',
        speakerId: '3c37646f-3881-5374-2a83-149267990abc',
        personality: '冷静で丁寧、知的で落ち着いた司会進行',
        speakingStyle: '安定感のある上品な声',
        greeting: 'こんにちは。つくよみちゃんです。',
        farewell: 'お疲れ様でした。'
    },
    // ...
];
```

#### 更新手順

1. **設定ファイル編集**：
   ```bash
   $EDITOR packages/core/src/operator/character-info-service.ts
   ```

2. **設定確認**：
   ```bash
   # ビルド後に確認
   npm run build
   operator-manager available
   ```

3. **動作テスト**：
   ```bash
   # 利用可能キャラクター確認
   operator-manager available
   
   # アサインテスト
   operator-manager assign
   operator-manager release
   ```

## 新キャラクター追加時の手順

### 1. キャラクター詳細情報の追加

1. **[docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)に詳細情報を追加**：
   - キャラクター名・特徴
   - 性格・話し方
   - 利用シーン・おすすめ用途

2. **公式情報との整合性確認**：
   - 公式サイトの情報と一致させる
   - 音声サンプルがある場合は特徴を記載

### 2. 内蔵設定への追加

1. **DEFAULT_CHARACTERS配列に追加**：
   ```typescript
   {
       id: 'new_character',
       name: '新キャラクター名',
       speakerId: 'speaker-uuid-here',  // COEIROINKから取得
       personality: '性格設定',
       speakingStyle: '話し方の特徴',
       greeting: 'こんにちは。新キャラクターです。',
       farewell: 'お疲れ様でした。'
   }
   ```

2. **チェックリスト**：
   - [ ] DEFAULT_CHARACTERS配列に追加
   - [ ] speakerIdをCOEIROINKから確認
   - [ ] [docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)に詳細情報記載
   - [ ] 動作テスト実行
   - [ ] README.mdのキャラクター数更新

## キャラクター情報の更新

### 既存キャラクターの情報修正

1. **情報源の確認**：
   - 公式サイト最新情報
   - COEIROINK内のキャラクター説明
   - ユーザーフィードバック

2. **修正対象の特定**：
   - 性格設定の見直し
   - 話し方の特徴更新
   - 挨拶・お別れメッセージの改善

3. **一貫性の保持**：
   - [docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)とcharacter-info-service.tsの整合性
   - 他キャラクターとのバランス

### 定期的なメンテナンス

1. **四半期レビュー**：
   - 公式情報の変更確認
   - ユーザー利用状況の分析
   - 設定の最適化検討

2. **COEIROINK更新対応**：
   - 新キャラクター追加対応
   - 既存キャラクターの仕様変更対応
   - 音声名変更への対応

## 注意事項

### 開発時の重要ポイント

- **speakerId必須**: 各キャラクターにCOEIROINKのSpeaker UUIDが必要
- **下位互換性**: 既存キャラクターIDの変更は避ける
- **設定整合性**: personality/speakingStyleは[docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)と一致させる
- **TypeScript形式**: character-info-service.tsはTypeScriptで型安全に管理

### データの役割分担

| ファイル | 目的 | 更新頻度 |
|----------|------|----------|
| `docs/user-guide/CHARACTERS.md` | ユーザー向け詳細情報・利用ガイド | 定期的 |
| `character-info-service.ts` | システム内蔵の基本設定 | キャラクター追加時 |
| `configuration-guide.md` | ユーザー向け設定説明 | 機能変更時 |

## 関連ファイル

- **[docs/user-guide/CHARACTERS.md](../docs/user-guide/CHARACTERS.md)** - 内蔵キャラクター詳細情報
- **[../README.md](../README.md)** - インストール・基本使用方法ガイド
- **[docs/user-guide/configuration-guide.md](../docs/user-guide/configuration-guide.md)** - 設定ファイル仕様詳細
- **[packages/core/src/operator/character-info-service.ts](../packages/core/src/operator/character-info-service.ts)** - キャラクター設定実装

---
**作成日**: 2025年8月5日  
**最終更新**: v1.0対応（動的設定管理システム）  
**対象バージョン**: COEIRO Operator v1.0+