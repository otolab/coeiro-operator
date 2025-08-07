# 設定・カスタマイズガイド

COEIRO Operatorの詳細な設定方法とカスタマイズオプションについて説明します。

## 設定ファイルの概要

### 設定ファイルの場所
```
~/.coeiro-operator/
├── coeiroink-config.json      # COEIROINK・音声設定
├── operator-config.json       # オペレータ管理設定  
├── character-settings.json    # キャラクター個別設定
└── session-data.json          # セッション状態（自動生成）
```

### 設定の優先順位
1. **コマンドライン引数** （最優先）
2. **環境変数**
3. **ユーザー設定ファイル** （~/.coeiro-operator/）
4. **プロジェクト設定** （./.coeiro-operator/）
5. **デフォルト設定** （最低優先）

## COEIROINK・音声設定

### coeiroink-config.json

#### 基本接続設定
```json
{
  "host": "localhost",
  "port": "50032",
  "timeout": 30000,
  "retryAttempts": 3,
  "retryDelay": 1000
}
```

#### 音声合成設定
```json
{
  "rate": 200,                    // 基本話速 (50-400)
  "synthesisRate": 24000,         // 生成時サンプルレート
  "playbackRate": 48000,          // 再生時サンプルレート
  "defaultChunkMode": "auto",     // チャンク分割モード
  "defaultBufferSize": 1024       // バッファサイズ
}
```

#### 音声処理設定
```json
{
  "lowpassFilter": true,          // ローパスフィルター有効
  "lowpassCutoff": 24000,         // カットオフ周波数 (Hz)
  "noiseReduction": false,        // ノイズリダクション有効
  "resamplingQuality": "medium"   // リサンプリング品質
}
```

#### 完全設定例
```json
{
  "host": "localhost",
  "port": "50032",
  "timeout": 30000,
  "rate": 200,
  "synthesisRate": 24000,
  "playbackRate": 48000,
  "defaultChunkMode": "auto",
  "defaultBufferSize": 1024,
  "lowpassFilter": true,
  "lowpassCutoff": 24000,
  "noiseReduction": false,
  "resamplingQuality": "medium",
  "voice_id": "cc213e6d-d847-45b5-a1df-415744c890f2",
  "style_id": 120
}
```

### 音質プリセット

#### 高品質設定
```json
{
  "synthesisRate": 24000,
  "playbackRate": 48000,
  "lowpassFilter": true,
  "lowpassCutoff": 24000,
  "noiseReduction": true,
  "resamplingQuality": "best",
  "defaultBufferSize": 2048
}
```

#### 高速設定
```json
{
  "synthesisRate": 22050,
  "playbackRate": 44100,
  "lowpassFilter": false,
  "noiseReduction": false,
  "resamplingQuality": "fastest",
  "defaultBufferSize": 512
}
```

#### バランス設定（推奨）
```json
{
  "synthesisRate": 24000,
  "playbackRate": 48000,
  "lowpassFilter": true,
  "lowpassCutoff": 24000,
  "noiseReduction": false,
  "resamplingQuality": "medium",
  "defaultBufferSize": 1024
}
```

## 設定管理コマンド

### 設定確認
```bash
# 現在の設定表示
operator-manager config

# 特定項目確認
operator-manager config --key audio.synthesisRate

# 設定ファイル場所確認
operator-manager config --paths
```

### 設定リセット
```bash
# 全設定リセット
operator-manager reset --all

# 特定設定リセット
operator-manager reset --config audio
operator-manager reset --config operator

# バックアップ付きリセット
operator-manager reset --backup
```

### 設定検証
```bash
# 設定ファイル検証
operator-manager validate-config

# COEIROINK接続テスト
say-coeiroink --check-server

# 音声出力テスト
say-coeiroink --test-audio
```