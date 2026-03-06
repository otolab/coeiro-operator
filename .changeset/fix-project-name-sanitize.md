---
"@coeiro-operator/term-bg": patch
"@coeiro-operator/core": patch
---

fix(term-bg): プロジェクト名のサニタイズによる画像切替失敗を修正

getSessionId()のサニタイズ済み値がiTerm2のuser.projectIDと不一致で背景画像が切り替わらない問題を修正。clearBackground()でprojectNameが渡されていなかった問題の修正、および同じプロジェクトの全ウィンドウに背景画像を適用するように改善。
