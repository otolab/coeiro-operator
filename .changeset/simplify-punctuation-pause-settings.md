---
"@coeiro-operator/core": patch
"@coeiro-operator/audio": patch
---

句読点ポーズ設定を簡素化し一貫性を向上

- `PunctuationPauseSettings`から`enabled`フラグを削除（各値を0にすることで無効化可能）
- `PunctuationPauseSettings`から`baseMorasPerSecond`を削除（VoiceConfigから取得するため不要）
- `pauseMoras`ネストを削除し、フラットな構造に変更
- 型定義、実装コード、テスト、ドキュメントを一貫した仕様に統一

**変更前:**
```typescript
punctuationPause: {
  enabled: true,
  pauseMoras: { period: 2.0 },
  baseMorasPerSecond: 7.5
}
```

**変更後:**
```typescript
punctuationPause: {
  period: 2.0,
  exclamation: 1.5,
  question: 1.8,
  comma: 0.8
}
```

この変更により、よりシンプルで直感的な設定が可能になりました。
