# @coeiro-operator/cli

COEIROINKと連携するCLIツール集

## インストール

```bash
npm install -g @coeiro-operator/cli
```

## コマンド

### say-coeiroink

COEIROINK音声合成コマンド（macOS sayコマンド互換）

```bash
# 基本使用
say-coeiroink "こんにちは"

# 音声一覧表示
say-coeiroink -v "?"

# 話速調整（WPM）
say-coeiroink -r 150 "ゆっくり話します"

# ファイル出力
say-coeiroink -o output.wav "保存テスト"

# スタイル指定
say-coeiroink --style "セクシー" "別のスタイルで話します"
```

### operator-manager

ターミナルセッションのオペレータ管理

```bash
# オペレータ割り当て（ランダム）
operator-manager assign

# 特定キャラクターを指定
operator-manager assign tsukuyomi

# 現在の状態確認
operator-manager status

# オペレータ解放
operator-manager release

# 利用可能なオペレータ一覧
operator-manager available
```

### dictionary-register

COEIROINK用語辞書登録

```bash
# 単語登録
dictionary-register "COEIROINK" "コエイロインク" 0 7

# パラメータ
# - 単語（表記）
# - 読み方（カタカナ）
# - アクセント位置
# - モーラ数
```

## 動作要件

- Node.js 18以上
- COEIROINK本体が起動済み（http://localhost:50032）

## 詳細

完全なドキュメントは [GitHub](https://github.com/otolab/coeiro-operator) を参照してください。

## ライセンス

MIT