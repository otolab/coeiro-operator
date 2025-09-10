# 設定ファイルサンプル

このディレクトリには、COEIRO Operatorの様々な用途に応じた設定ファイルのサンプルが含まれています。

> 🔗 **コード参照**: 設定値の実装については `src/core/say/constants.ts` を参照してください  
> 📖 **詳細ドキュメント**: [設定オプション詳細ガイド](../user-guide/configuration-options.md)  
> ⚠️  **同期必須**: これらのサンプル値を変更する際は、コードの定数値も同期更新してください

## 使用方法

1. 適切なサンプルファイルを選択
2. `~/.coeiro-operator/coeiroink-config.json` にコピー
3. 必要に応じて `speaker_id` などを環境に合わせて調整

## サンプル一覧

### [ultra-low-latency.json](./ultra-low-latency.json)
- **用途**: リアルタイム対話、チャットボット
- **特徴**: 最低レイテンシ、即座の応答
- **設定**: `latencyMode: "ultra-low"`, `splitMode: "none"`, 小バッファ（512）
- **自動適用**: 最小限のエフェクト、高速処理、最小バッファ設定

### [balanced.json](./balanced.json)
- **用途**: 一般的な用途、Webアプリケーション
- **特徴**: レイテンシと音質のバランス（デフォルト）
- **設定**: `latencyMode: "balanced"`, `splitMode: "punctuation"`, 標準バッファ（1024）
- **自動適用**: 適度なエフェクト、バランス型処理、標準バッファ設定

### [high-quality.json](./high-quality.json)
- **用途**: 高品質録音、プレゼンテーション
- **特徴**: 最高音質、エフェクト有効
- **設定**: `latencyMode: "quality"`, `splitMode: "large"`, 大バッファ（2048）
- **自動適用**: フルエフェクト、高品質処理、大容量バッファ設定

## プリセット活用のメリット

これらのサンプルは`latencyMode`プリセットを活用して簡潔に設定されています：

### 自動設定される項目
- **バッファ設定**: `highWaterMark`, `lowWaterMark`, `dynamicAdjustment`
- **分割設定**: `smallSize`, `mediumSize`, `largeSize`, `overlapRatio`
- **エフェクト設定**: `noiseReduction`, `lowpassFilter`, クロスフェード等
- **パディング設定**: 音切れ防止、フェードイン/アウト

### カスタマイズが必要な場合
必要に応じて個別設定で上書き可能：
```json
{
  "audio": {
    "latencyMode": "balanced",
    "splitMode": "punctuation",
    "processing": {
      "noiseReduction": true  // プリセット値を上書き
    }
  }
}
```

## 設定のカスタマイズ

詳細な設定オプションについては、[設定オプション詳細ガイド](../user-guide/configuration-options.md) を参照してください。

## 注意事項

- `default_speaker_id` は環境に応じて適切な値に変更してください
- 高品質設定はCPU負荷が高くなる場合があります  
- プリセットを活用することで設定の複雑さを大幅に軽減できます