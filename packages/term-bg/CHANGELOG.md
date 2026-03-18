# @coeiro-operator/term-bg

## 1.0.5

### Patch Changes

- a2fd2c8: getSessionId()を構造化しセッション特定ロジックを統一、current_sessionフォールバックを削除

## 1.0.4

### Patch Changes

- 62ea415: fix(term-bg): プロジェクト名のサニタイズによる画像切替失敗を修正

  getSessionId()のサニタイズ済み値がiTerm2のuser.projectIDと不一致で背景画像が切り替わらない問題を修正。clearBackground()でprojectNameが渡されていなかった問題の修正、および同じプロジェクトの全ウィンドウに背景画像を適用するように改善。

## 1.0.3

### Patch Changes

- 371cb15: tmux環境での背景画像設定をiTmuxプロジェクト名ベースのウィンドウ特定に改善

## 1.0.2

### Patch Changes

- 598ae41: tmux環境でterminal背景画像が動作しない問題を修正

## 1.0.1

### Patch Changes

- Updated dependencies
  - @coeiro-operator/common@1.0.2
