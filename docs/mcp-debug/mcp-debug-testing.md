# MCPサーバー デバッグ・テスト ガイド

## デバッグモードの使用方法

MCPサーバーにはデバッグモードが組み込まれており、分割モード（splitMode）の動作を詳細に確認できます。

### デバッグモードの有効化

以下のいずれかの方法でデバッグモードを有効化できます：

コマンドライン引数でデバッグモードを有効化：
```bash
node dist/mcp/server.js --debug
```

デバッグモードでは、標準出力に詳細なログが出力され、すべてのログレベル（debug、verbose含む）が蓄積されます。通常のMCPモードではMCP規格準拠のため標準出力にエラーのみが出力され、蓄積はinfo以上のログに限定されます。

## 手動テスト方法

デバッグモードでMCPサーバーを起動し、標準入力からMCP準拠のJSONを送信してテストできます。

### 1. デバッグモードでサーバー起動

```bash
pnpm build
node dist/mcp/server.js --debug
```

### 2. 初期化シーケンス

まず、MCPの初期化を行います：

```json
{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{"tools":{}}},"id":1}
```

サーバーが初期化に応答したら、初期化完了を送信：

```json
{"jsonrpc":"2.0","method":"initialized","params":{}}
```

### 3. sayツールのテスト

句読点分割の動作をテストするため、sayツールを実行：

```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは最初の文です。これは二番目の文です。最後の文はここで終わります。"}},"id":2}
```

### 4. デバッグログの確認ポイント

デバッグモードでは以下のログが出力・蓄積されます：

#### ログレベル別出力内容
- **通常モード**: エラーのみ出力、info以上を蓄積
- **デバッグモード**: 全レベル出力・蓄積

#### 出力されるログ詳細

#### SAY TOOL レベル
- 入力パラメータ（message, voice, rate等）
- 現在の音声設定（splitMode, latencyMode, bufferSize）

#### SYNTHESIZE_TEXT_INTERNAL レベル  
- 解決されたオプション（chunkMode等）
- フォールバック処理の詳細

#### SPLIT_TEXT_INTO_CHUNKS レベル
- 入力されたsplitMode
- テキスト長と内容プレビュー
- 使用される分割方式（punctuation/その他）
- 生成されたチャンク数と各チャンクの内容

#### SYNTHESIZE_STREAM レベル
- chunkModeパラメータ
- 総チャンク数
- 各チャンクの処理状況

## 問題の特定方法

### splitModeが期待通りに動作しない場合

1. **設定ファイルの確認**:
   設定ファイルを確認: `~/.coeiro-operator/coeiroink-config.json`

2. **フォールバック処理の確認**:
   - `config.audio.splitMode`が`undefined`の場合、`'punctuation'`にフォールバックされるはず
   - ログで`"chunkMode: punctuation (from: config.audio.splitMode fallback)"`を確認

3. **分割処理の確認**:
   - `"Using punctuation-based splitting"`ログの有無
   - 生成されたチャンク数と内容が適切か

4. **句読点以外の分割が使われている場合**:
   - `chunkMode`パラメータが意図しない値になっていないか
   - 設定ファイルに予期しない`splitMode`設定がないか

## よくある問題と対処法

### 1. punctuation分割が効かない

**症状**: 文章が句読点で分割されず、文字数で分割されている

**確認ポイント**:
- ログで`"Using punctuation-based splitting"`が表示されるか
- `chunkMode`パラメータが`"punctuation"`になっているか
- 設定ファイルに`splitMode`以外の値が設定されていないか

### 2. 設定ファイルの値が反映されない

**症状**: 設定ファイルを更新しても動作が変わらない

**確認ポイント**:
- サーバーを再起動したか
- 設定ファイルのパスが正しいか（`~/.coeiro-operator/coeiroink-config.json`）
- JSONの構文が正しいか

### 3. プリセットが適用されない

**症状**: `latencyMode: "balanced"`が設定されているのに対応する分割設定が適用されない

**確認ポイント**:
- プリセットシステムは現在`splitMode`を設定しない仕様
- 明示的に`splitMode: "punctuation"`を設定ファイルに追加する必要がある

## テスト用JSON例

### 基本的なsayテスト
```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"短いテスト。"}},"id":3}
```

### 長文テスト
```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"これは長いテストメッセージです。複数の文を含んでいます。句読点で適切に分割されるかを確認します。最後の文章はここで終わります。"}},"id":4}
```

### スタイル指定テスト
```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"say","arguments":{"message":"スタイルテストです。","style":"ura"}},"id":5}
```

このドキュメントを参考に、分割モードの動作を詳細に確認してください。