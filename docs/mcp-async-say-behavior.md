# CLI vs MCP 実行モードの設計

## 概要

COEIRO Operatorは、CLIツールとMCPサーバーで異なる実行戦略を採用しています。この設計により、それぞれの用途に最適化された動作を提供します。

## 実行モード別の設計方針

### CLI実行モード
- **目的**: ユーザーが音声の完了を確認できる同期的な動作
- **動作**: 音声合成を直接実行し、再生完了まで待機
- **メソッド**: `synthesizeText()` → `synthesizeTextInternal()`
- **待機処理**: `waitForPlaybackCompletion()` で再生終了を待つ

### MCP実行モード  
- **目的**: Claude Codeの応答性を重視した非同期動作
- **動作**: SpeechQueueにタスク投稿のみ、背景で音声処理
- **メソッド**: `synthesizeTextAsync()` → `enqueueSpeech()`
- **待機処理**: なし（即座にレスポンス）

## 変更内容

### 修正前（同期的動作）
```typescript
// 音声合成の完了を待つ
const result = await sayCoeiroink.synthesizeTextAsync(message, options);
return { content: [{ type: "text", text: `発声完了: タスクID ${result.taskId}` }] };
```

### 修正後（非同期実行）
```typescript
// 非同期で音声合成を開始（awaitしない）
const speechPromise = sayCoeiroink.synthesizeTextAsync(message, options);

// 完了ログを非同期で処理
speechPromise
  .then(result => logger.info(`発声完了 - タスクID: ${result.taskId}`))
  .catch(error => logger.error(`音声合成エラー: ${error.message}`));

// 即座にレスポンスを返す
return { content: [{ type: "text", text: "音声合成を開始しました" }] };
```

## 動作の変更点

### レスポンス時間
- **修正前**: 音声合成完了まで数秒待機
- **修正後**: 即座にレスポンス（< 100ms）

### レスポンス内容
- **修正前**: `発声完了: タスクID 12345, オペレータ: tsukuyomi`
- **修正後**: `音声合成を開始しました - オペレータ: tsukuyomi`

### ログ出力
- 音声合成の完了ログは非同期で出力されます
- エラーが発生した場合も非同期でログに記録されます

## 利点

1. **高速なレスポンス**: Claude Codeの応答性向上
2. **並行実行**: 複数の音声合成タスクの同時実行が可能
3. **ユーザビリティ**: 長い音声でもツールがブロックされない
4. **システム安定性**: 音声合成エラーがMCPサーバーをブロックしない

## 注意点

- 音声合成の完了確認は、ログまたは音声出力の開始で判断してください
- エラーが発生した場合、ツールのレスポンスではなくログに記録されます
- 音声合成の結果（成功/失敗）はツールのレスポンスには含まれません

## デバッグ

デバッグモードでMCPサーバーを起動すると、音声合成の完了ログを確認できます：

```bash
node dist/mcp/server.js --debug
```

ログ例：
```
音声合成を開始しました - オペレータ: tsukuyomi
発声完了 - オペレータ: tsukuyomi, タスクID: 12345
```