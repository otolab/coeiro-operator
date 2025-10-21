# CLI Scripts

このディレクトリには、開発・メンテナンス用のスクリプトが含まれています。

## measure-speech-rate.ts

Speaker/スタイル毎の話速（モーラ/秒）を測定するスクリプト

### 概要

COEIROINKの各キャラクター（Speaker）とスタイルについて、標準話速（speedScale=1.0）での実際のモーラ/秒を測定します。この測定値は、句読点ポーズ機能などで正確なタイミング制御を行うために使用されます。

### 使用方法

```bash
# 測定を実行（結果を標準出力に表示）
npx tsx packages/cli/scripts/measure-speech-rate.ts

# 測定結果をファイルに保存
npx tsx packages/cli/scripts/measure-speech-rate.ts -o ./speech-rates.json

# ヘルプを表示
npx tsx packages/cli/scripts/measure-speech-rate.ts -h
```

### 前提条件

- COEIROINKサーバーが起動していること
- config.jsonで接続設定が正しく設定されていること

### 測定方法

1. 4つのテスト文章（モーラ数が事前にカウント済み）を用意
2. 各Speaker/スタイルでテスト文章を音声合成
3. 生成されたWAVファイルから再生時間を取得
4. モーラ数 ÷ 再生時間 でモーラ/秒を計算
5. 複数のテスト文章の平均値を最終的な測定値とする

### 出力形式

測定結果は以下の形式で出力されます：

#### コンソール出力
```
つくよみちゃん - ノーマル: 7.23 モーラ/秒
つくよみちゃん - おしとやか: 6.89 モーラ/秒
ディアちゃん - のーまる: 7.85 モーラ/秒
...
```

#### config.json用設定
```json
{
  "characters": {
    "tsukuyomi": {
      "baseMorasPerSecond": 7.23,
      "styles": {
        "ノーマル": 7.23,
        "おしとやか": 6.89,
        ...
      }
    },
    ...
  }
}
```

### config.jsonへの適用

測定結果をconfig.jsonに適用する例：

```bash
# 1. 測定を実行してファイルに保存
npx tsx packages/cli/scripts/measure-speech-rate.ts -o ./speech-rates.json

# 2. config.jsonを手動で編集
# ~/.coeiro-operator/config.json に以下を追加：
{
  "characters": {
    "tsukuyomi": {
      "baseMorasPerSecond": 7.23
    },
    "dia": {
      "baseMorasPerSecond": 7.85
    }
  }
}
```

### 技術詳細

- **モーラカウント**: 日本語の音韻単位で、基本的にひらがな1文字=1モーラ
  - 拗音（きゃ、しゅ等）は1モーラ
  - 長音（ー）は1モーラ
  - 促音（っ）は1モーラ
  - 撥音（ん）は1モーラ

- **WAVファイル解析**: 標準的なWAVヘッダーを解析して再生時間を計算
  - サンプリングレート、チャンネル数、ビット深度から正確な時間を算出

- **speedScale=1.0**: COEIROINKの標準話速設定で測定
  - sayコマンド互換のrate=200に相当

## 今後の追加予定

- キャラクター別の感情表現パラメータ測定スクリプト
- 句読点ポーズの最適値自動探索スクリプト