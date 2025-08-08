# 設定値同期維持ガイド

COEIRO Operatorでは、コードとドキュメント間の設定値の整合性を保つために、以下のガイドラインに従ってください。

## 📋 同期が必要なファイル一覧

### コード（実装）
- **`src/core/say/constants.ts`** - マスター定数定義（**最優先**）
- `src/core/say/index.ts` - デフォルト設定
- `src/core/say/audio-player.ts` - 音声再生設定
- `src/core/say/audio-synthesizer.ts` - 音声合成設定
- `src/cli/say-coeiroink.ts` - CLI設定

### ドキュメント
- **`docs/configuration-options.md`** - 設定オプション詳細
- `docs/installation.md` - インストールガイドの設定例
- `docs/audio-system.md` - 音声システム仕様
- `docs/config-samples/README.md` - 設定サンプル説明

### 設定ファイルサンプル
- `docs/config-samples/balanced.json`
- `docs/config-samples/ultra-low-latency.json`
- `docs/config-samples/high-quality.json`

## 🔄 設定値変更時の手順

### 1. 変更の優先順位
```
src/core/say/constants.ts → その他のコード → ドキュメント → 設定サンプル
```

### 2. 変更手順

#### ステップ1: コード更新
1. **`src/core/say/constants.ts`** の該当定数を更新
2. 関連するコードファイルで定数参照を確認
3. 型定義やバリデーション範囲の更新

#### ステップ2: ドキュメント更新
1. **`docs/configuration-options.md`** のデフォルト値表を更新
2. `docs/installation.md` の設定例を更新
3. 技術仕様が変わる場合は `docs/audio-system.md` を更新

#### ステップ3: 設定サンプル更新
1. `docs/config-samples/*.json` の値を更新
2. `docs/config-samples/README.md` の説明を更新

## ⚠️ 特に注意が必要な設定値

### 音声処理関連
- **サンプルレート**: `SAMPLE_RATES.*` 
  - 影響: 音質、処理負荷、互換性
  - 要更新: audio-system.md、configuration-options.md

- **バッファサイズ**: `BUFFER_SIZES.*`
  - 影響: レイテンシ、メモリ使用量、CLI制限
  - 要更新: CLI help、installation.md、全設定サンプル

### プリセット設定
- **レイテンシモード**: `SPLIT_SETTINGS.PRESETS.*`, `BUFFER_SIZES.PRESETS.*` など
  - 影響: 3つのプリセット間のバランス
  - 要更新: configuration-options.mdのプリセット説明、設定サンプル

### CLI設定
- **バッファサイズ範囲**: `BUFFER_SIZES.MIN/MAX`
  - 影響: CLIバリデーション、ヘルプメッセージ
  - 要更新: cli.tsのヘルプテキスト、installation.md

## 🔍 同期確認チェックリスト

変更後は以下を確認してください：

### コード整合性
- [ ] `src/core/say/constants.ts` の値がコード全体で参照されている
- [ ] テストが新しい値に対応している
- [ ] 型定義が適切である

### ドキュメント整合性
- [ ] `docs/configuration-options.md` のデフォルト値が正しい
- [ ] `docs/installation.md` の設定例が動作する
- [ ] 技術仕様ドキュメントが実装と一致している

### 設定ファイル整合性
- [ ] すべての設定サンプルが有効な値を使用している
- [ ] プリセット説明と実際のプリセット値が一致している
- [ ] 設定サンプルのコメントが最新である

## 🛠 自動化の可能性

将来的に以下の自動化を検討：

1. **設定値検証スクリプト**
   - constants.tsとドキュメントの値を比較
   - 不整合を自動検出

2. **ドキュメント自動生成**
   - constants.tsから設定表を自動生成
   - 設定サンプルの自動バリデーション

3. **CI/CDチェック**
   - PR時に設定値整合性を自動確認
   - ドキュメント更新忘れの防止

## 📞 困った時は

設定値の変更で不明な点がある場合：

1. まず `src/core/say/constants.ts` のコメントを確認
2. 関連ドキュメントの相互参照コメントを確認
3. git履歴で過去の変更パターンを参照
4. テストファイルで期待される値を確認

---

**作成日**: 2025年8月8日  
**目的**: コードとドキュメント間の設定値同期を確実にするため