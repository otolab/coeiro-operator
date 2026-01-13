---
"@coeiro-operator/core": patch
"@coeiro-operator/cli": patch
"@coeiro-operator/mcp": patch
---

使われていないワークフローファイルを削除

- release.ymlを削除（緊急時用バックアップワークフローは不要）
- release-branch.yml内の無効化されたcreate-release-prジョブを削除
