# 音声速度設定仕様書

## 概要
COEIROINKオペレータの音声速度（話速）設定に関する仕様を定義します。

## 基本設計思想

### 1. 二つの速度モード

#### 話者固有速度モード（rate未指定）
- 各話者・スタイルが持つ自然な速度で発話
- 話者の個性や感情表現を最大限に活かす
- 例：MANAの「ねむねむ」は自然にゆっくり（4.81mora/s）

#### 絶対速度モード（rate指定）
- 全話者を統一された速度に調整
- 基準速度：7.5mora/s = rate 200（macOS sayコマンド互換）
- 用途：複数話者で一貫した速度が必要な場合

## 速度パラメータの定義

### rate（入力パラメータ）
- **単位**: WPM（Words Per Minute）※日本語ではmora/sに変換
- **範囲**: 50〜400（実用範囲）
- **未指定時**: undefined（話者固有速度を使用）
- **デフォルト値**: なし（未指定と200は異なる意味を持つ）

### 基準値
- **基準rate**: 200 WPM
- **基準速度**: 7.5 mora/s
- **変換式**: mora/s = 7.5 × (rate / 200)

### 内部パラメータ

#### speed（COEIROINK API用）
```typescript
// rate未指定の場合
speed = 1.0  // 話者固有速度

// rate指定の場合
targetMorasPerSecond = 7.5 * (rate / 200)
speed = targetMorasPerSecond / styleMorasPerSecond[styleId]
// 範囲制限: 0.5 ≤ speed ≤ 2.0
```

#### actualMorasPerSecond（実際の発話速度）
```typescript
// rate未指定の場合
actualMorasPerSecond = styleMorasPerSecond[styleId]

// rate指定の場合
actualMorasPerSecond = 7.5 * (rate / 200)
// ただし、speedの範囲制限により実際の値は制限される場合がある
```

## 各インターフェースでの実装

### 1. CLIコマンド（say-coeiroink）
```bash
# 話者固有速度（アンジーさん「のーまる」: 8.25mora/s）
say-coeiroink "こんにちは"

# 絶対速度指定（7.5mora/s）
say-coeiroink -r 200 "こんにちは"

# 高速（15mora/s）
say-coeiroink -r 400 "こんにちは"

# 低速（3.75mora/s）
say-coeiroink -r 100 "こんにちは"
```

### 2. MCPツール
```typescript
// 話者固有速度
await say({ message: "こんにちは" })

// 絶対速度指定
await say({ message: "こんにちは", rate: 200 })
```

### 3. 設定ファイル（config.json）
```json
{
  "operator": {
    // rateを省略 = 話者固有速度
    // "rate": 200 を指定 = 絶対速度7.5mora/s
  }
}
```

## 実装上の注意点

### 後方互換性
- 既存の`rate: 200`指定は絶対速度モードとして動作
- 設定ファイルでrate未指定の場合は話者固有速度（破壊的変更）
  - 移行措置：初回起動時に設定ファイル更新を促す

### 速度制限
- COEIROINKのspeed制限（0.5〜2.0）により、極端な速度調整は制限される
- 例：「ねむねむ」（4.81mora/s）をrate=400（15mora/s）に設定
  - 必要speed = 15 / 4.81 = 3.12 → 2.0に制限
  - 実際の速度 = 4.81 × 2.0 = 9.62mora/s

### 句読点ポーズの計算
- 常に実際のmora/sを基準に計算
- rate未指定：話者固有速度を使用
- rate指定：調整後の速度を使用

## 話者固有速度の例

| 話者・スタイル | 固有速度（mora/s） | rate=200時の調整 |
|-------------|-----------------|----------------|
| つくよみちゃん（れいせい） | 8.61 | speed=0.87で7.5mora/sに |
| MANA（ねむねむ） | 4.81 | speed=1.56で7.5mora/sに |
| アンジーさん（セクシー） | 6.14 | speed=1.22で7.5mora/sに |
| KANA（ほうかご） | 8.50 | speed=0.88で7.5mora/sに |

## 移行計画

### Phase 1：実装
1. AudioSynthesizerの速度変換ロジック更新
2. AudioStreamControllerの速度計算更新
3. 各インターフェースのrate処理更新

### Phase 2：テスト
1. 単体テストの更新
2. 統合テストの追加
3. 実機での動作確認

### Phase 3：ドキュメント更新
1. README.mdの更新
2. ユーザーガイドの作成
3. 移行ガイドの提供