---
"@coeiro-operator/core": patch
---

iTmuxセッション識別をitmux currentコマンドに変更

ITMUX_PROJECT環境変数はitmuxプロセス内でのみ設定され、
子プロセスには伝播しないため使用できないことが判明。
代わりに`itmux current`コマンドでプロジェクト名を動的に取得する方式に変更。

- tmux環境でまず`itmux current`を試行
- 成功すればITMUX_PROJECT:プロジェクト名を使用
- 失敗すればtmux display-messageにフォールバック