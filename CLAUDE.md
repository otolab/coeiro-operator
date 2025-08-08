# COEIRO Operator プロジェクト用設定

## MCP Tools ガイド

code-bugs MCPツールの詳細な使用方法については、以下のファイルを参照してください：

- [MCP Tools 使用ガイド](./prompts/MCP_TOOLS_USAGE_GUIDE.md)
  - @prompts/MCP_TOOLS_USAGE_GUIDE.md

このファイルには以下の情報が含まれています：
- 利用可能なMCPサーバーの概要
- 各ツールの詳細な引数と使用例
- 解析タイプの説明
- 典型的なワークフローとベストプラクティス

## コマンド実行環境

### テスト実行
```bash
npm test
```

### 型チェック
```bash
npm run type-check
```

### ビルド
```bash
npm run build
```

## プロジェクト構成

- `src/core/operator/`: オペレータ管理機能
- `src/core/say/`: 音声出力機能  
- `src/core/environment/`: 環境情報管理（VoiceProvider等）
- `src/cli/`: コマンドラインツール
- `src/mcp/`: MCPサーバー
- `prompts/`: システムプロンプトとガイド
- `docs/`: プロジェクトドキュメント
  - `development-tips.md`: 開発テクニック・Tips集
  - `audio-streaming-guide.md`: 音声ストリーミング再生システムガイド
  - `voice-provider-system.md`: VoiceProviderシステムガイド

## 音声設定

### 設定ファイル

音声システムの設定は `~/.coeiro-operator/coeiroink-config.json` で管理されます。

#### 主要設定項目

- `splitMode`: テキスト分割モード (`'punctuation'`, `'none'`, `'small'`, `'medium'`, `'large'`, `'auto'`)
- `bufferSize`: スピーカーバッファサイズ（256-8192バイト）
- `chunkSizeSmall/Medium/Large`: 各モードでの分割サイズ（文字数）
- `overlapRatio`: オーバーラップ比率（0.0-1.0）

詳細は [`docs/audio-streaming-guide.md`](./docs/audio-streaming-guide.md) を参照してください。

## 開発時の重要なテクニック

### MCPサーバーの再起動
コード変更後にMCPサーバーを再起動するには：
```bash
claude mcp remove coeiro-operator
claude mcp add coeiro-operator
```
この方法により変更が確実に反映されます。詳細は`docs/development-tips.md`を参照。

### 開発フロー
1. コード修正
2. `npm run build` でビルド
3. MCPサーバー再起動（上記コマンド）
4. Claude Codeでツール動作確認

これにより開発効率が大幅に向上します。
