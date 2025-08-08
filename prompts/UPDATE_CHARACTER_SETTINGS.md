# キャラクター設定メンテナンスガイド

COEIRO Operatorのキャラクター設定データの更新・メンテナンス手順について説明します。

## 目的

このドキュメントは**開発者向け**のキャラクター設定データメンテナンス手順です。  
**ユーザー向け設定方法**については [@../docs/CONFIGURATION.md](../docs/CONFIGURATION.md) を参照してください。

## メンテナンス対象

### 1. キャラクター詳細情報（CHARACTERS.md）

**ファイル**: `docs/CHARACTERS.md`

**目的**: 全キャラクターの性格・特徴・利用ガイドなどの詳細情報

#### 更新手順

1. **公式情報の収集**：
   - COEIROINK公式サイト（https://coeiroink.com/character/）から最新情報取得
   - 各キャラクター個別ページの詳細確認

2. **CHARACTERS.mdの更新**：
   ```bash
   $EDITOR docs/CHARACTERS.md
   ```

3. **整合性確認**：
   - character-defaults.jsとの設定整合性
   - 新キャラクター追加時はcharacter-defaults.jsも同時更新

### 2. 内蔵キャラクター設定（character-defaults.js）

**ファイル**: `src/operator/character-defaults.js`

**目的**: システム内蔵のキャラクター基本設定（挨拶・性格など）

#### 設定構造

```javascript
export const BUILTIN_CHARACTER_CONFIGS = {
    character_id: {
        name: "表示名",
        personality: "性格設定（MCP出力時に表示）",
        speaking_style: "話し方の特徴（MCP出力時に表示）",
        greeting: "アサイン時の挨拶メッセージ",
        farewell: "解放時のお別れメッセージ",
        default_style: "normal",        // デフォルトスタイル
        style_selection: "default"      // default/random
    }
};

export const SPEAKER_NAME_TO_ID_MAP = {
    "つくよみちゃん": "tsukuyomi",
    "アンジーさん": "angie",
    // 音声名 → character_idのマッピング
};
```

#### 更新手順

1. **設定ファイル編集**：
   ```bash
   $EDITOR src/operator/character-defaults.js
   ```

2. **設定確認**：
   ```bash
   node -e "
   import('./src/operator/character-defaults.js').then(mod => {
     console.log('利用可能キャラクター:', Object.keys(mod.BUILTIN_CHARACTER_CONFIGS));
     console.log('音声マッピング:', mod.SPEAKER_NAME_TO_ID_MAP);
   });
   "
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

1. **[docs/CHARACTERS.md](../docs/CHARACTERS.md)に詳細情報を追加**：
   - キャラクター名・特徴
   - 性格・話し方
   - 利用シーン・おすすめ用途

2. **公式情報との整合性確認**：
   - 公式サイトの情報と一致させる
   - 音声サンプルがある場合は特徴を記載

### 2. 内蔵設定への追加

1. **BUILTIN_CHARACTER_CONFIGSに追加**：
   ```javascript
   new_character: {
       name: "新キャラクター名",
       personality: "性格設定",
       speaking_style: "話し方の特徴",
       greeting: "こんにちは。新キャラクターです。",
       farewell: "お疲れ様でした。",
       default_style: "normal",
       style_selection: "default"
   }
   ```

2. **SPEAKER_NAME_TO_ID_MAPに追加**：
   ```javascript
   "新キャラクター音声名": "new_character"
   ```

3. **チェックリスト**：
   - [ ] BUILTIN_CHARACTER_CONFIGSに追加
   - [ ] SPEAKER_NAME_TO_ID_MAPに音声名マッピング追加
   - [ ] [docs/CHARACTERS.md](../docs/CHARACTERS.md)に詳細情報記載
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
   - [docs/CHARACTERS.md](../docs/CHARACTERS.md)とcharacter-defaults.jsの整合性
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

- **音声ID自動検出**: `voice_id`や`available_styles`は設定不要（動的検出）
- **下位互換性**: 既存キャラクターIDの変更は避ける
- **設定整合性**: personality/speaking_styleは[docs/CHARACTERS.md](../docs/CHARACTERS.md)と一致させる
- **JSON形式**: character-defaults.jsはES Modulesだが、設定内容はJSONライクに保つ

### データの役割分担

| ファイル | 目的 | 更新頻度 |
|----------|------|----------|
| `docs/CHARACTERS.md` | ユーザー向け詳細情報・利用ガイド | 定期的 |
| `character-defaults.js` | システム内蔵の基本設定 | キャラクター追加時 |
| `CONFIGURATION.md` | ユーザー向け設定説明 | 機能変更時 |

## 関連ファイル

- **[docs/CHARACTERS.md](../docs/CHARACTERS.md)** - 内蔵キャラクター詳細情報
- **[../README.md](../README.md)** - インストール・基本使用方法ガイド
- **[../docs/CONFIGURATION.md](../docs/CONFIGURATION.md)** - 設定ファイル仕様詳細
- **[OPERATOR_SYSTEM.md](OPERATOR_SYSTEM.md)** - システム仕様

---
**作成日**: 2025年8月5日  
**最終更新**: v1.0対応（動的設定管理システム）  
**対象バージョン**: COEIRO Operator v1.0+