---
"@coeiro-operator/audio": patch
---

fix: operator_assignで指定したstyleがsay呼び出しで反映されない問題を修正

operator_assignでstyleNameパラメータを指定してオペレーターをアサインした後、
say()を引数なしで呼び出すと、アサインしたスタイルではなくキャラクターの
デフォルトスタイルが使用されていた問題を修正しました。

修正内容:
- resolveCharacterOptions()でvoice/style両方が未指定の場合、
  セッションのstyleIdを使用するように変更
- session変数のスコープを調整してスタイル解決時に参照可能に
- 型安全性のため session?.styleId !== undefined でチェック

これにより、MCPツールでoperator_assignしたスタイル設定が
後続のsay呼び出しで正しく反映されるようになります。