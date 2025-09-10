# 音声アーキテクチャ仕様書

COEIRO Operatorにおける音声関連の型定義と概念の詳細説明

## 📋 概要

COEIRO Operatorは、COEIROINKの音声合成機能を拡張し、キャラクター性や性格を付与した音声オペレータシステムを提供します。このドキュメントでは、システムの中核となる型定義とその関係性について説明します。

## 🎯 階層構造と概念

### 音声システムの4層構造

```
┌─────────────────────────────────────────────┐
│              Operator（オペレータ）            │
│  - セッション単位で管理される音声キャラクター    │
│  - スタイル指定の保存・永続化                  │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│             Character（キャラクター）          │
│  - Speakerに性格・口調を付与                  │
│  - デフォルトスタイルの定義                    │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│              Speaker（スピーカー）             │
│  - COEIROINKの純粋な音声モデル                │
│  - 複数のStyleを保持                          │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────▼────────────────────────┐
│             VoiceConfig（音声設定）            │
│  - 実際の音声合成に使用される最終設定          │
│  - Speaker + 選択されたStyle                  │
└─────────────────────────────────────────────┘
```

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
    styleName: string;      // スタイル名（例: "のーまる", "セクシー"）
    personality?: string;   // スタイル特有の性格（オプション）
    speakingStyle?: string; // スタイル特有の話し方（オプション）
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
    characterId: string;           // キャラクター識別子
    speaker: Speaker | null;       // 関連付けられたSpeaker情報
    defaultStyle: string;          // デフォルトスタイル名
    greeting: string;              // 挨拶メッセージ
    farewell: string;              // 別れの挨拶
    personality: string;           // 基本性格設定
    speakingStyle: string;         // 基本的な話し方
}
```

**特徴:**
- Speakerに人格・性格を付与したもの
- ユーザーフレンドリーな設定情報を含む
- デフォルトのスタイル選択を含む
- 設定ファイルで定義・カスタマイズ可能

### 4. Operator（オペレータ）

```typescript
/**
 * Operator: セッション管理されるCharacterインスタンス
 * 端末セッションごとに割り当てられ、スタイル選択が永続化される
 */
export interface OperatorSession {
    characterId: string;           // 割り当てられたキャラクターID
    styleId?: number;              // 保存されたスタイルID
    styleName?: string;            // 保存されたスタイル名
    assignedAt: number;            // 割り当て時刻（タイムスタンプ）
}
```

**特徴:**
- 端末セッション（TERM_SESSION_ID）単位で管理
- スタイル指定がセッション期間中（最大4時間）保持
- タイムアウト機能（デフォルト4時間）で自動解放
- 排他制御により同一キャラクターの重複使用を防止

### 5. VoiceConfig（音声設定）

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
- CharacterとOperatorの設定を統合して生成

## 🔄 スタイル選択の優先順位

スタイルは以下の優先順位で決定されます：

1. **明示的な指定** (最優先)
   - CLIの`--style`オプション
   - MCPツールの`style`パラメータ
   - APIの`style`引数

2. **オペレータセッション保存値**
   - `operator-manager assign --style=<スタイル名>`で保存された値
   - セッション期間中（最大4時間）は保持

3. **キャラクターのデフォルト**
   - Character定義の`defaultStyle`
   - 設定ファイルでカスタマイズ可能

4. **最初のスタイル** (フォールバック)
   - Speakerのstyles配列の最初の要素

### スタイル選択フローの例

```
ユーザー: say-coeiroink --style "セクシー" "テスト"
    ↓
1. 明示的指定あり → "セクシー"を使用 ✓

ユーザー: say-coeiroink "テスト"  # スタイル指定なし
    ↓
1. 明示的指定なし
2. オペレータセッション確認
   → 保存されたstyleId: 121 (セクシー) あり
   → "セクシー"を使用 ✓

ユーザー: operator-manager release → assign angie
ユーザー: say-coeiroink "テスト"
    ↓
1. 明示的指定なし
2. オペレータセッション確認 → styleIdなし
3. CharacterのdefaultStyle → "のーまる"を使用 ✓
```

## 🔄 型の変換フロー

```
ユーザー入力（CharacterId + オプションのスタイル指定）
    ↓
OperatorManager.assignOperator()
    ├→ Character取得 (CharacterInfoService)
    ├→ スタイル選択・検証
    └→ OperatorSession作成（スタイル保存）
    ↓
音声合成時
    ├→ getCurrentVoiceConfig()
    │   ├→ OperatorSession取得
    │   ├→ Character情報取得
    │   └→ スタイル決定（優先順位に従う）
    └→ VoiceConfig生成
    ↓
AudioSynthesizer.synthesize(VoiceConfig)
    └→ COEIROINK API呼び出し
```

## 💾 データ保存

### OperatorSession（オペレータセッション）

**保存場所:** `/tmp/coeiroink-operators-<hostname>.json`  
**保存期間:** 最大4時間（タイムアウト後自動削除）

```json
{
  "sessions": {
    "terminal_session_123": {
      "characterId": "angie",
      "styleId": 121,
      "styleName": "セクシー",
      "assignedAt": 1698123456789
    }
  }
}
```

**注意:** これは一時的なセッション情報であり、タイムアウト後やシステム再起動時には失われます。

### Character設定

**保存場所:** `~/.coeiro-operator/operator-config.json`

```json
{
  "characters": {
    "angie": {
      "defaultStyle": "のーまる",
      "greeting": "カスタム挨拶",
      "personality": "カスタム性格"
    }
  }
}
```

## 📝 実装例

### オペレータ割り当て時のスタイル保存

```typescript
// OperatorManager.assignSpecificOperator()
async assignSpecificOperator(characterId: string, style: string | null = null) {
    // Character情報取得
    const character = await this.characterInfoService.getCharacterInfo(characterId);
    
    // スタイル選択
    const selectedStyle = this.characterInfoService.selectStyle(character, style);
    
    // セッションに保存（スタイル情報を含む）
    await this.reserveOperator(characterId, selectedStyle.styleId, selectedStyle.styleName);
    
    return {
        characterId,
        currentStyle: selectedStyle,
        // ...
    };
}
```

### 音声合成時のスタイル解決

```typescript
// SayCoeiroink.getCurrentVoiceConfig()
async getCurrentVoiceConfig(styleName?: string | null): Promise<VoiceConfig | null> {
    const session = await this.operatorManager.getCurrentOperatorSession();
    const character = await this.operatorManager.getCharacterInfo(session.characterId);
    
    let selectedStyle;
    if (styleName) {
        // 1. 明示的指定を優先
        selectedStyle = this.selectStyle(character, styleName);
    } else if (session?.styleId) {
        // 2. セッション保存値を使用
        selectedStyle = character.speaker.styles.find(s => s.styleId === session.styleId);
    } else {
        // 3. デフォルトスタイルを使用
        selectedStyle = this.selectStyle(character, null);
    }
    
    return {
        speaker: character.speaker,
        selectedStyleId: selectedStyle.styleId
    };
}
```

## 🎮 使用例

### CLI使用例

```bash
# オペレータ割り当て（スタイル指定あり）
operator-manager assign angie --style=セクシー

# スタイルが保存され、以降のコマンドで使用される
say-coeiroink "このメッセージはセクシースタイルで再生"

# 明示的な指定で一時的に上書き
say-coeiroink --style "のーまる" "このメッセージだけ通常スタイル"

# 再び保存されたスタイルが使用される
say-coeiroink "またセクシースタイルに戻る"
```

### MCP使用例

```javascript
// オペレータ割り当て
await operator_assign({ operator: "angie", style: "セクシー" });

// スタイルが保存され、以降の呼び出しで使用
await say({ message: "セクシースタイルで話すよ" });

// 明示的な指定で一時的に上書き
await say({ message: "通常スタイルで話すよ", style: "のーまる" });
```

## 🔧 設定とカスタマイズ

詳細な設定方法については以下のドキュメントを参照：

- [設定ガイド](../getting-started/configuration-guide.md) - 基本設定とカスタマイズ
- [キャラクター詳細](../user-guide/CHARACTERS.md) - 各キャラクターの詳細情報
- [オペレータ仕様](./operator-assignment-specification.md) - オペレータ管理の詳細

## 📚 関連ドキュメント

- [README.md](../../README.md) - プロジェクト概要
- [開発Tips](../development/development-tips.md) - 開発者向け情報
- [テストガイド](../development/testing-guide.md) - テスト方法