# @coeiro-operator/audio

COEIRO Operator音声合成・再生モジュール

内部パッケージです。直接のインストールは推奨されません。

COEIROINK APIとの通信、音声ストリーミング、リサンプリング機能を提供します。

## 機能

- COEIROINK APIとの音声合成通信
- 低レイテンシ音声ストリーミング
- 音声再生（@echogarden/audio-io使用）
- リアルタイムリサンプリング
- チャンク境界での停止制御
- クロスフェード処理
- ノイズリダクション（オプション）

## 音声出力モジュール

音声出力には`@echogarden/audio-io`を使用しています。以下の特徴があります：

- **プリコンパイル済みバイナリ**: node-gypによるビルドが不要
- **CI/CD対応**: GitHub ActionsなどのCI環境でも動作
- **低レイテンシ**: コールバックベースのAPIで効率的なバッファ管理
- **マルチプラットフォーム**: macOS、Windows、Linuxをサポート

## パフォーマンス

@echogarden/audio-ioの採用により、以下のパフォーマンス改善を実現：

- 初期化時間: 約0.03ms（高速）
- チャンク処理: 平均1.47ms（低オーバーヘッド）
- メモリ使用量: 約130MB RSS（効率的）

## ドキュメント

### ドキュメント構成

```
packages/audio/
├── docs/
│   ├── architecture.md                        # アーキテクチャ概要
│   ├── task-orchestration.md                 # タスクキュー実装詳細
│   ├── chunk-generation-manager-spec.md       # 並行生成仕様
│   └── architecture-improvement-proposal.md   # 改善提案（未実施）
└── README.md                                  # このファイル
```

### ドキュメント管理ルール

- **アーキテクチャドキュメント**: `docs/` に機能ごとに配置
- **複数ファイルにまたがる処理フロー**: 各ドキュメントに記述
- **コードで明らかな情報**: ドキュメント化しない
- **修正済みの内容**: ドキュメント内で ✅ マークで明示

## ライセンス

MIT