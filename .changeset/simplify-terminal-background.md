---
"@coeiro-operator/core": patch
---

ターミナル背景画像設定をシンプル化

- 新しい設定構造 `imagePaths` で統一管理
  - string値: ファイルパス指定
  - null/false: 画像無効（APIも使わない）
  - 未定義: APIから自動取得
- 旧設定（`backgroundImages`、`operatorImage`）からの自動移行をサポート
- より直感的な設定で「ファイル優先、なければAPI」の動作を実現

破壊的変更なし（後方互換性維持）