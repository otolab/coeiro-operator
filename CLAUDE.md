# COEIRO Operator - 開発ガイド

Claude向けのプロジェクト開発リファレンス・インデックス

以下のファイルを読み込んでください:
* @README.md
* @prompts/README.md
  - 作業内容が確定したら必要なガイドを読み込んでください
* @docs/README.md

## 📋 基本情報

**プロジェクト詳細**: `README.md` を参照（ユーザ向け包括情報）

## 🔧 開発コマンド

```bash
# ビルド・型チェック
npm run build
npm run type-check

# テスト実行
npm test
npm run test:e2e
./scripts/test-mcp-debug.sh
```

## 📁 プロジェクト構成

**詳細**: `docs/development-tips.md#プロジェクト構成` を参照

### Queue統一実装アーキテクチャ

- **SpeechQueue**: 音声タスクの一元管理（`src/core/say/speech-queue.ts`）
- **CLI実行**: 同期処理（ウォームアップ→音声→完了待機）
- **MCP実行**: 非同期キューイング（音声タスクのみ即座にレスポンス）
- **タスクタイプ**: `speech` | `warmup` | `completion_wait`

## 🎛️ 設定システム

**音声設定**: `~/.coeiro-operator/coeiroink-config.json`

### 重要パラメータ

- `audio.splitMode`: `'punctuation'` (デフォルト、句読点分割)
- `audio.latencyMode`: `'ultra-low'` | `'balanced'` | `'quality'`
- `audio.parallelGeneration.maxConcurrency`: 並行生成数（1=逐次、2以上=並行）
- `audio.parallelGeneration.pauseUntilFirstComplete`: 初回ポーズ（デフォルト: `true`）

## 🛠️ MCPサーバー開発

### 開発テスト方法
**⚠️ 重要：** Claude Code起動中のMCPツールでは編集したコードの変更が反映されません。

開発・テスト時は以下を使用：
```bash
# 直接MCPサーバー実行（推奨）
node dist/mcp/server.js --debug

# mcp-debug CLI使用（インタラクティブモード）
node dist/mcp-debug/cli.js --interactive dist/mcp/server.js -- --debug

# 短時間テスト（10秒で自動終了、timeoutコマンド不要）
node dist/mcp-debug/cli.js --timeout 10000 dist/mcp/server.js -- --debug
```


## 📖 ドキュメントインデックス

### 📋 完全インデックス
- `prompts/README.md` - プロンプト・ガイドインデックス
- `docs/README.md` - ドキュメント完全インデックス（詳細・用途別）

### MCP・開発
- `prompts/MCP_TOOLS_USAGE_GUIDE.md` - MCPツール使用ガイド
- `docs/development-tips.md` - 開発テクニック・Tips集
- `docs/mcp-debug-guide.md` - MCPデバッグ環境

### 音声・システム
- `docs/audio-streaming-guide.md` - 音声ストリーミング機能
- `docs/parallel-generation-system.md` - 並行チャンク生成システム
- `docs/voice-provider-system.md` - VoiceProviderシステム

### 設定・運用
- `docs/configuration-guide.md` - 設定・カスタマイズ完全ガイド
- `docs/testing-guide.md` - テスト環境とmcp-debug統合
- `docs/test-quality-guidelines.md` - テスト品質の基本原則

### API・リファレンス
- `docs/CHARACTERS.md` - オペレータキャラクター詳細

## 🔍 開発フロー

### Queue統一実装での開発プロセス

1. **コード修正** (特にSpeechQueue関連)
2. **ビルド**: `npm run build`
3. **テスト**: APIレスポンス構造変更確認 (`result.taskId` vs 従来の `result.mode`)
4. **MCPサーバー再起動**（下記コマンド）
5. **Claude Codeでツール動作確認**

### MCPサーバー再起動コマンド
```bash
claude mcp remove coeiro-operator -s local
claude mcp add coeiro-operator ./dist/mcp/server.js
```

### テスト時の注意点
- 統合テストではAPIレスポンス構造が `{ success, taskId }` に変更
- レガシーメソッド（`synthesizeTextInternal`）削除によるテスト修正済み
- SpeechQueueのタスク管理により非同期処理の動作が変更

**詳細**: `docs/development-tips.md#推奨開発フロー` を参照