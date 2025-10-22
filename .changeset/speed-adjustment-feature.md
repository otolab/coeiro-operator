---
"@coeiro-operator/audio": minor
"@coeiro-operator/cli": minor
"@coeiro-operator/core": minor
"@coeiro-operator/mcp": minor
---

発話速度調整機能の実装とリファクタリング

## 新機能

### 柔軟な速度指定
- **未指定**: 話者固有の自然な速度（speed=1.0）
- **絶対速度（rate）**: WPM単位での速度指定（例: 200 WPM）
- **相対速度（factor）**: 倍率での速度指定（例: 1.5倍速）

### CLI対応
```bash
# WPM指定
say "こんにちは" --rate 200

# パーセント指定（相対速度）
say "こんにちは" --rate "150%"

# 話者固有速度
say "こんにちは"
```

### MCP API対応
```json
{
  "rate": 200,    // WPM指定
  "factor": 1.5   // 倍率指定
}
```

## 改善内容

### シンプルな内部表現
```typescript
interface SpeedSpecification {
  rate?: number;    // 絶対速度（WPM）
  factor?: number;  // 相対速度（倍率）
}
```

### 設定構造の改善
- `audio.defaultRate` に速度設定を統一
- operator設定から速度関連を分離

## Breaking Changes

- `operator.rate` 設定は削除されました
  - 代わりに `audio.defaultRate` を使用してください
- `SpeedSpecification` インターフェースが変更されました
  - mode/value形式から rate/factor形式へ

## 技術的改善

- 過度な抽象化を排除（config-helpers.ts削除）
- 設定アクセスをTypeScriptの基本機能に統一
- レイヤー間の責務を明確に分離
  - CLI層: 文字列パース
  - 内部処理層: 数値計算のみ