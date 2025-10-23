---
"@coeiro-operator/cli": patch
---

operator-managerコマンドが動作しない問題を修正

import.meta.urlの比較が原因でCLIが起動しない問題を修正。
npmでインストールされた場合、シンボリックリンク経由で実行されるため、
パスが一致せず実行されない問題があった。