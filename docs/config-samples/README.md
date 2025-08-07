# 設定ファイルサンプル

このディレクトリには、COEIRO Operatorの様々な用途に応じた設定ファイルのサンプルが含まれています。

## 使用方法

1. 適切なサンプルファイルを選択
2. `~/.coeiro-operator/coeiroink-config.json` にコピー
3. 必要に応じて `voice_id` などを環境に合わせて調整

## サンプル一覧

### [ultra-low-latency.json](./ultra-low-latency.json)
- **用途**: リアルタイム対話、チャットボット
- **特徴**: 最低レイテンシ、音声head途切れ対策最優先
- **設定**: `splitMode: "small"`, クロスフェード無効、最小バッファ

### [balanced.json](./balanced.json)
- **用途**: 一般的な用途、Webアプリケーション
- **特徴**: レイテンシと音質のバランス
- **設定**: `splitMode: "auto"`, 適度なクロスフェード、バランス型バッファ

### [high-quality.json](./high-quality.json)
- **用途**: 高品質録音、プレゼンテーション
- **特徴**: 最高音質、ノイズ除去有効
- **設定**: `splitMode: "large"`, 高品質処理、大きなバッファ

## 設定のカスタマイズ

詳細な設定オプションについては、[設定オプション詳細ガイド](../configuration-options.md) を参照してください。

## 注意事項

- `voice_id` は環境に応じて適切な値に変更してください
- 高品質設定はCPU負荷が高くなる場合があります
- レイテンシ設定は用途に応じて調整してください