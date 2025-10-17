---
"@coeiro-operator/audio": minor
---

音声出力モジュールを speaker から @echogarden/audio-io へ完全移行

- プリコンパイル済みバイナリによりビルド不要
- CI/CD環境での安定動作を実現
- コールバックベースAPIで低レイテンシを実現
- コードのシンプル化（speaker互換コードを削除）