---
"@coeiro-operator/audio": patch
---

fix: waitForQueueLengthでtargetLength>0の場合に待機が解除されない問題を修正

Issue #182の修正: `waitForQueueLength(targetLength)`で`targetLength > 0`を指定しても、キューが目標長になったときに待機が解除されなかった問題を修正しました。

**問題:**
`taskCompleted`イベント発火時に、まだ`currentProcessPromise`がnullになっていないため、`isProcessing = true`のままで条件を満たさなかった。

**修正内容:**
- targetLength=0: 完全に空で処理中でない場合に解除（従来通り）
- targetLength>0: キューが目標長以下になった時点で即座に解除

**影響を受けるパッケージ:**
- @coeiro-operator/mcp: `wait_for_task_completion`ツールの`remainingQueueLength`オプションが正常に動作するようになります

refs #182