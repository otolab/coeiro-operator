---
"@coeiro-operator/mcp": patch
---

fix: sayツールでvoice形式を正しくパース、不正な形式でエラーハンドリングを改善

Issue #179, #180の修正: `alma:裏`のような不正なvoice形式でMCPサーバーがクラッシュする問題、およびvoice指定時に別キャラのstyleが使えない問題を修正しました。

**変更内容:**

1. **voice文字列のパース処理を追加**
   - `characterId:styleName`形式に対応
   - コロン(`:`)で分割し、characterIdとstyleNameを抽出
   - 不正な形式（コロンが複数など）を検出してエラー

2. **エラーメッセージの改善**
   - 不正なvoice形式の場合、使用可能な形式を明示
   - キャラクターが存在しない場合のエラーを明確化
   - 存在しないstyleを指定した場合、そのキャラクターの利用可能なstyleを表示

3. **スタイル検証の改善（Issue #180対応）**
   - voice指定時、そのキャラクターのstyleを検証
   - 現在のオペレータではなく、指定されたキャラクターのstyleをチェック
   - 例: `operator_assign=tsukuyomi`の状態で`voice="alma"` + `style="のーまる"`が使用可能に

4. **クラッシュ防止の強化（Issue #179の本質的な要件）**
   - `voice-resolver.ts`で`selectedStyle`がundefinedになるケースを明示的に処理
   - 非null assertion (`!`) を削除し、ガード節でエラーをthrow
   - `speaker.styles`が空配列の場合のクラッシュを防止
   - `server.ts`で`Character`型に存在しない`name`フィールドの参照を修正

**使用例:**
```typescript
// 正常な形式
say({ message: "こんにちは", voice: "alma" })
say({ message: "こんにちは", voice: "alma:のーまる" })

// Issue #180: voice指定時に別キャラのstyleを使用
// operator_assign=tsukuyomiの状態で
say({ message: "こんにちは", voice: "alma", style: "のーまる" })  // ✅ almaの「のーまる」が使用される

// エラーになる形式（適切なメッセージを表示）
say({ message: "こんにちは", voice: "alma:裏:extra" })  // → "不正なvoice形式です"
say({ message: "こんにちは", voice: "nonexistent" })    // → "キャラクター 'nonexistent' が見つかりません"
```

**テスト:**
- voice形式のパーステストを追加
- 不正な形式のエラーテストを追加
- Issue #180のシナリオテストを追加（voice指定時のstyle検証）

refs #179, #180
