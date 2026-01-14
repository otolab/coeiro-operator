---
"@coeiro-operator/core": minor
"@coeiro-operator/mcp": minor
"@coeiro-operator/cli": minor
"@coeiro-operator/audio": minor
---

iTmux/tmux環境での複数セッション対応

- セッションID取得を非同期関数化し、tmux環境ではコマンドを動的に実行
- `getSessionId()` を独立した非同期関数としてexport
- `OperatorManager` のconstructorで `sessionId` を受け取るように変更
- 環境変数の優先順位: ITMUX_PROJECT → TMUX（動的取得） → ITERM_SESSION_ID → TERM_SESSION_ID → PID
- 名前空間衝突を防ぐため、セッションIDにプレフィックスを追加 (例: `ITMUX_PROJECT:coeiro_operator`, `TMUX:myproject_0`)
- `TerminalBackground` も `initialize()` メソッドでセッションIDを非同期取得

refs #215
