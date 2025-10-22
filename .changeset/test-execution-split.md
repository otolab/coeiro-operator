---
---

fix: テスト実行の分割と重複実行の改善 (#143)

### 問題修正
- ユニットテストと統合テストを明確に分離
- CIでの重複テスト実行を解消
- テスト実行時間の短縮

### 変更内容
- vitest.config.ts: 統合テストをデフォルト実行から除外
- vitest.integration.config.ts: 統合テスト専用の設定ファイルを追加
- package.json: test:integrationスクリプトを追加、test:allを簡潔に修正
- .github/workflows/pr-checks.yml: Quick Testsでユニットテストのみ実行
- .github/workflows/ci.yml: ユニット・統合テストを順次実行する構成に変更

### 利点
- PR Checksでの高速フィードバック（ユニットテストのみ）
- CIリソースの効率化（重複実行の排除）
- テストタイプごとの明確な分離と管理