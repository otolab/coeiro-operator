# COEIRO Operator - 開発ガイド

Claude向けのプロジェクト開発リファレンス・インデックス

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

```
src/
├── cli/                    # CLIツール
├── core/
│   ├── operator/           # オペレータ管理機能
│   ├── say/               # 音声出力機能  
│   └── environment/       # 環境情報管理（VoiceProvider等）
├── mcp/                   # MCPサーバー
├── mcp-debug/             # MCPデバッグ環境
└── utils/                 # ユーティリティ（ロガーシステム等）

docs/                      # ドキュメント
prompts/                   # システムプロンプトとガイド
```

## 🎛️ 設定システム

**音声設定**: `~/.coeiro-operator/coeiroink-config.json`

### 重要パラメータ

- `audio.splitMode`: `'punctuation'` (デフォルト、句読点分割)
- `audio.latencyMode`: `'ultra-low'` | `'balanced'` | `'quality'`
- `audio.parallelGeneration.maxConcurrency`: 並行生成数（1=逐次、2以上=並行）
- `audio.parallelGeneration.pauseUntilFirstComplete`: 初回ポーズ（デフォルト: `true`）

## 🛠️ MCPサーバー開発

### 再起動方法
```bash
claude mcp remove coeiro-operator -s local
claude mcp add coeiro-operator ./dist/mcp/server.js
```

### デバッグモード
```bash
node dist/mcp/server.js --debug  # 詳細ログ・同期音声再生
```

## 📖 ドキュメントインデックス

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
- `docs/api-reference.md` - 完全APIリファレンス
- `docs/CHARACTERS.md` - オペレータキャラクター詳細

## 🔍 開発フロー

1. コード修正
2. `npm run build`
3. MCPサーバー再起動（上記コマンド）  
4. Claude Codeでツール動作確認

**詳細**: `docs/development-tips.md#推奨開発フロー` を参照