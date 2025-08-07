# トラブルシューティングガイド

COEIRO Operatorの一般的な問題と解決方法を説明します。

## 音声出力の問題

### 音声が出力されない

#### 症状
- コマンド実行後に音声が聞こえない
- エラーメッセージが表示される
- プロセスが正常終了するが無音

#### 確認手順

1. **COEIROINKサーバー確認**
```bash
# COEIROINK起動確認
curl -X GET "http://localhost:50032/v1/speakers"

# 接続テスト
say-coeiroink --check-server
```

2. **システム音量確認**
```bash
# macOS
osascript -e "get volume settings"

# Linux (ALSA)
amixer get Master

# Windows (PowerShell)
Get-AudioDevice -PlaybackVolume
```

3. **音声デバイス確認**
```bash
# デバイス一覧表示
say-coeiroink --list-devices

# システム情報表示
say-coeiroink --system-info
```

#### 解決方法

**COEIROINKサーバー問題**
```bash
# COEIROINK再起動
# 1. COEIROINKアプリケーションを終了
# 2. 再起動
# 3. ポート50032で起動確認
```

**音声デバイス問題**
```bash
# デフォルトデバイス変更（macOS）
sudo defaults write com.apple.HIToolbox AppleCurrentKeyboardLayoutInputSourceID -string com.apple.keylayout.US

# ALSA設定リセット（Linux）
sudo alsactl restore
```

**権限問題**
```bash
# macOS: マイクアクセス許可確認
# システム環境設定 > セキュリティとプライバシー > プライバシー

# Linux: audio グループ追加
sudo usermod -a -G audio $USER
```

### 音質が悪い・ノイズが入る

#### 症状
- 音声にノイズが混入
- 音が割れる・歪む
- 音量が小さい・大きすぎる

#### 診断コマンド
```bash
# 現在の音声設定確認
say-coeiroink --audio-info

# 設定ファイル確認
cat ~/.coeiro-operator/coeiroink-config.json
```

#### 解決方法

**音質改善設定**
```json
// ~/.coeiro-operator/coeiroink-config.json
{
  "synthesisRate": 24000,
  "playbackRate": 48000,
  "lowpassFilter": true,
  "lowpassCutoff": 24000,
  "defaultBufferSize": 2048
}
```

**ノイズ対策**
```json
{
  "noiseReduction": true,
  "lowpassFilter": true,
  "lowpassCutoff": 20000
}
```

**音割れ対策**
```json
{
  "defaultBufferSize": 4096,
  "volumeScale": 0.8
}
```

### 音声レイテンシが高い

#### 症状
- 音声出力までの遅延が大きい
- リアルタイム性が不足

#### 最適化設定
```json
{
  "synthesisRate": 22050,
  "playbackRate": 44100,
  "defaultBufferSize": 256,
  "lowpassFilter": false,
  "noiseReduction": false,
  "defaultChunkMode": "none"
}
```

## オペレータ管理の問題

### オペレータが割り当てられない

#### 症状
- `operator_assign` が失敗する
- "利用可能なオペレータがいません" エラー

#### 確認手順
```bash
# 利用可能オペレータ確認
operator-manager available

# 現在の状況確認  
operator-manager status

# セッション状況確認
operator-manager sessions
```

#### 解決方法

**強制リセット**
```bash
# 全セッションリセット
operator-manager reset --all

# 特定セッションリセット
operator-manager release --session <session-id>
```

**設定ファイル修復**
```bash
# 設定リセット
operator-manager reset --config

# キャラクター設定再生成
operator-manager rebuild-characters
```

### キャラクター音声が正しくない

#### 症状
- 指定したキャラクターと異なる音声
- スタイル設定が反映されない

#### 確認コマンド
```bash
# キャラクター設定確認
operator-manager show-character "青山龍星"

# 音声マッピング確認
operator-manager voice-mapping
```

#### 解決方法

**キャラクター設定更新**
```bash
# 動的設定再構築
operator-manager build-dynamic-config

# 特定キャラクター設定
operator-manager configure "青山龍星" --style-selection random
```

## MCPサーバー問題

### MCPサーバーが起動しない

#### 症状
- Claude CodeでMCPツールが利用できない
- 接続エラーが発生

#### 確認手順
```bash
# MCP登録確認
claude mcp list

# 手動起動テスト
coeiro-operator

# ログ確認
DEBUG=mcp* coeiro-operator
```

#### 解決方法

**再登録**
```bash
# MCP削除・再登録
claude mcp remove coeiro-operator
claude mcp add coeiro-operator coeiro-operator

# 設定確認
claude mcp test coeiro-operator
```

**権限問題**
```bash
# 実行権限確認
which coeiro-operator
ls -la $(which coeiro-operator)

# 再インストール
npm uninstall -g coeiro-operator
npm install -g coeiro-operator
```

### MCPツール呼び出しエラー

#### 症状
- 特定のMCPツール呼び出しが失敗
- タイムアウトエラー

#### デバッグ方法
```bash
# 詳細ログ有効化
DEBUG=coeiro* claude mcp test coeiro-operator

# 個別ツールテスト
curl -X POST localhost:3000/mcp/operator_assign
```

## インストール・依存関係問題

### ネイティブモジュールビルドエラー

#### 症状
- `npm install` 中にコンパイルエラー
- `speaker` や `node-libsamplerate` のビルド失敗

#### 解決方法

**Windows**
```powershell
# Visual Studio Build Tools インストール
npm install -g windows-build-tools

# Python設定
npm config set python C:\Python\python.exe

# 再ビルド
npm rebuild
```

**macOS**
```bash
# Xcode Command Line Tools
xcode-select --install

# Homebrew更新
brew update
brew upgrade

# 再インストール
npm cache clean --force
npm install
```

**Linux**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential libasound2-dev

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install alsa-lib-devel

# 再ビルド
npm rebuild
```

### 依存関係バージョン競合

#### 症状
- `npm WARN` メッセージ
- 一部機能が動作しない

#### 解決方法
```bash
# 依存関係チェック
npm ls

# 脆弱性修正
npm audit fix

# 強制更新
npm update --force

# クリーンインストール
rm -rf node_modules package-lock.json
npm install
```

## パフォーマンス問題

### メモリ使用量が多い

#### 診断
```bash
# メモリ使用量確認
ps aux | grep coeiro
top -p $(pgrep -f coeiro)

# Node.js ヒープ使用量
node --max-old-space-size=1024 say/cli.js "テスト"
```

#### 最適化
```json
{
  "defaultBufferSize": 512,
  "maxQueueSize": 5,
  "noiseReduction": false,
  "defaultChunkMode": "small"
}
```

### CPU使用率が高い

#### 最適化設定
```json
{
  "synthesisRate": 22050,
  "lowpassFilter": false,
  "noiseReduction": false,
  "resamplingQuality": "fastest"
}
```

## ログ・デバッグ

### 詳細ログ有効化

```bash
# 全般デバッグ
export DEBUG=coeiro*

# 特定モジュール
export DEBUG=coeiro:audio*
export DEBUG=coeiro:operator*
export DEBUG=coeiro:mcp*

# ログレベル設定
export COEIRO_LOG_LEVEL=debug
```

### ログファイル出力

```bash
# ファイル出力
DEBUG=coeiro* say-coeiroink "テスト" 2> debug.log

# 永続ログ設定
echo 'export DEBUG=coeiro*' >> ~/.bashrc
```

### システム情報収集

```bash
# 総合診断
say-coeiroink --system-info > system-report.txt

# 設定ダンプ
operator-manager config --export > config-dump.json

# 環境変数
env | grep COEIRO > env-vars.txt
```

## 緊急時復旧

### 完全リセット

```bash
# 1. 全プロセス終了
pkill -f coeiro

# 2. 設定ファイルバックアップ
cp -r ~/.coeiro-operator ~/.coeiro-operator.backup

# 3. 設定削除
rm -rf ~/.coeiro-operator

# 4. キャッシュクリア
npm cache clean --force

# 5. 再インストール
npm uninstall -g coeiro-operator
npm install -g coeiro-operator

# 6. 初期設定
operator-manager init
```

### 設定復旧

```bash
# バックアップから復旧
cp -r ~/.coeiro-operator.backup ~/.coeiro-operator

# 設定検証
operator-manager validate-config

# 部分復旧
cp ~/.coeiro-operator.backup/coeiroink-config.json ~/.coeiro-operator/
```

## サポート・問い合わせ

### 問題報告前チェックリスト

- [ ] システム要件確認
- [ ] 最新版アップデート確認
- [ ] 基本的なトラブルシューティング実行
- [ ] ログファイル取得
- [ ] 再現手順明確化

### 情報収集コマンド

```bash
# 問題報告用情報一括収集
say-coeiroink --debug-report > debug-report-$(date +%Y%m%d).txt
```

### GitHub Issues

問題報告時の情報：
- OS・Node.jsバージョン
- COEIRO Operatorバージョン
- COEIROINKバージョン
- エラーメッセージ全文
- 再現手順
- 設定ファイル（機密情報除去）