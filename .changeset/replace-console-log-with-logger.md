---
"@coeiro-operator/core": patch
"@coeiro-operator/cli": patch
---

console.logをloggerに統一してログレベル管理を改善

全てのconsole.logをloggerに置き換え、ログレベルの統一管理を実現しました。

**変更内容:**
- MCPサーバー起動時の不要なログ出力を削除
- packages/core: console.log → logger.debug に置き換え
- packages/cli: console.log → logger.info、console.error → logger.error に置き換え
- ログレベル設定による出力制御が可能に

**影響範囲:**
- テストファイルとデバッグツールは対象外（console.log維持）
- 独立したツール（setup-python-env.cjs）は対象外
