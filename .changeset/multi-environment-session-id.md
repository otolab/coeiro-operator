---
"@coeiro-operator/core": minor
---

iTmux/tmux環境での複数セッション対応

- セッションID取得ロジックを改善し、iTmux/tmux環境で複数のオペレータを同時に割り当て可能に
- 環境変数の優先順位を追加: ITMUX_PROJECT → TMUX_SESSION_ID → ITERM_SESSION_ID → TERM_SESSION_ID → PID
- 名前空間衝突を防ぐため、セッションIDにプレフィックスを追加 (例: `ITMUX_PROJECT:coeiro_operator`, `TMUX_SESSION_ID:myproject_0`)
- terminal背景画像機能も同様のセッションID取得ロジックを使用

refs #215
