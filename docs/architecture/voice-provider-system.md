# VoiceProvider System ガイド

## 概要

VoiceProviderシステムは、COEIROINKサーバーからの動的音声情報取得を一元管理するシステムです。従来分散していた音声情報収集処理を統一し、効率的でメンテナンス性の高い実装を提供します。

## アーキテクチャ

### 従来の問題点

リファクタリング前は、音声情報の取得が複数箇所に分散していました：

- `config-manager.ts`: キャラクター設定構築用
- `audio-synthesizer.ts`: 音声リスト表示 + フォールバックstyleID取得用  

これにより以下の問題が発生していました：

- **コードの重複**: 同様の処理が複数箇所に存在
- **保守性の低下**: 変更時に複数ファイルの修正が必要
- **パフォーマンス問題**: 重複したAPI呼び出し
- **エラーハンドリングの不統一**: 各箇所で異なる方法で処理

### 新しいアーキテクチャ

```
┌─────────────────────────────────────────┐
│           VoiceProvider                 │
│  ┌─────────────────────────────────────┤
│  │ 統一された音声情報取得API           │
│  │ - getSpeakers()                     │
│  │ - getVoiceStyles()                  │
│  │ - getFirstStyleId()                 │
│  │ - checkConnection()                 │
│  │ - logAvailableVoices()              │
│  └─────────────────────────────────────┤
│           キャッシュシステム              │
│  ┌─────────────────────────────────────┤
│  │ - 5分間のキャッシュ                 │
│  │ - 接続設定変更時のクリア             │
│  │ - 手動クリア対応                    │
│  └─────────────────────────────────────┤
│        エラーハンドリング                │
│  ┌─────────────────────────────────────┤
│  │ - タイムアウト対応                  │
│  │ - フォールバック機能                │
│  │ - ログ出力                          │
│  └─────────────────────────────────────┤
└─────────────────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────┐
        │   COEIROINK API     │
        │   /v1/speakers      │
        └─────────────────────┘
```

## クラス構成

### VoiceProvider

メインの音声情報プロバイダクラス。シングルトンパターンで実装されています。

```typescript
export class VoiceProvider {
    private connectionConfig: ConnectionConfig;
    private cachedSpeakers: Speaker[] | null = null;
    private lastFetchTime: number = 0;
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分間
}
```

#### 主要メソッド

##### `getSpeakers(): Promise<Speaker[]>`
- COEIROINKサーバーから音声一覧を取得
- キャッシュ機能付き（5分間有効）
- エラー時はキャッシュまたは空配列を返す

##### `getVoiceStyles(voiceId: string): Promise<VoiceStyle[]>`
- 特定音声のスタイル情報を取得
- フォールバック音声選択時に使用

##### `getFirstStyleId(voiceId: string): Promise<number>`
- 音声の最初のスタイルIDを取得
- フォールバック時のstyleID解決に使用

##### `checkConnection(): Promise<boolean>`
- サーバー接続確認
- 3秒タイムアウト

##### `logAvailableVoices(): Promise<void>`
- デバッグ用音声一覧出力
- CLI `-v ?` オプション実装

##### `updateConnection(config: Partial<ConnectionConfig>): void`
- 接続設定の動的更新
- キャッシュを自動クリア

### 型定義

```typescript
export interface Speaker {
    speakerName: string;
    speakerUuid: string;
    styles: VoiceStyle[];
}

export interface VoiceStyle {
    styleId: number;
    styleName: string;
}

export interface VoiceInfo {
    id: string;          // 英語ID（tsukuyomi等）
    name: string;        // 表示名（つくよみちゃん等）
    voice_id: string;    // UUID
    styles: Array<{
        id: number;
        name: string;
        style_id: number;
    }>;
}
```

## シングルトンアクセス

```typescript
import { getVoiceProvider } from '../environment/voice-provider.js';

// デフォルト設定で取得
const provider = getVoiceProvider();

// カスタム接続設定で初期化
const provider = getVoiceProvider({
    host: 'custom-host',
    port: '9999'
});
```

## 使用例

### ConfigManagerでの使用

```typescript
export class ConfigManager {
    private voiceProvider = getVoiceProvider();

    async buildDynamicConfig(): Promise<MergedConfig> {
        // 接続設定を更新
        await this.updateVoiceProviderConnection();
        
        // 音声情報を取得
        const availableVoices = await this.voiceProvider.getVoicesForConfig();
        
        // キャラクター設定を構築
        // ...
    }
}
```

### AudioSynthesizerでの使用

```typescript
export class AudioSynthesizer {
    private voiceProvider = getVoiceProvider();
    
    constructor(private config: Config) {
        // 接続設定を更新
        this.voiceProvider.updateConnection({
            host: this.config.connection.host,
            port: this.config.connection.port
        });
    }

    async synthesizeChunk(chunk: Chunk, voiceInfo: string | OperatorVoice): Promise<AudioResult> {
        if (typeof voiceInfo === 'string') {
            // フォールバック音声のstyleID取得
            const styleId = await this.voiceProvider.getFirstStyleId(voiceInfo);
            // ...
        }
    }
}
```

## キャッシュ戦略

### キャッシュ期間
- **5分間**: 通常の使用では十分、過度なAPI呼び出しを防止
- **接続設定変更時**: 自動クリア
- **手動クリア**: `clearCache()`メソッド提供

### キャッシュの利点
1. **パフォーマンス向上**: 不要なAPI呼び出しを削減
2. **レスポンス時間短縮**: キャッシュヒット時は即座に応答
3. **サーバー負荷軽減**: COEIROINKサーバーへの負荷を軽減

## エラーハンドリング

### タイムアウト設定
- **接続確認**: 3秒
- **音声情報取得**: 5秒

### フォールバック戦略
1. **キャッシュ利用**: エラー時は既存キャッシュを返す
2. **空配列返却**: キャッシュもない場合は空配列
3. **ログ出力**: エラー詳細をwarningレベルで出力

## パフォーマンス最適化

### 遅延初期化
```typescript
let globalVoiceProvider: VoiceProvider | null = null;

export function getVoiceProvider(): VoiceProvider {
    if (!globalVoiceProvider) {
        globalVoiceProvider = new VoiceProvider();
    }
    return globalVoiceProvider;
}
```

### キャッシュ効率
- メモリ使用量を抑制（Speaker[]のみキャッシュ）
- 設定変更時の自動無効化
- GCフレンドリーな実装


## テスト対応

### リセット機能
```typescript
import { resetVoiceProvider } from '../environment/voice-provider.js';

beforeEach(() => {
    resetVoiceProvider(); // テスト間でのクリーンアップ
});
```

### モック対応
```typescript
// テスト用のカスタムプロバイダを注入可能
const testProvider = getVoiceProvider({
    host: 'localhost',
    port: '50032'
});
```

## トラブルシューティング

### よくある問題

#### 1. 音声情報が更新されない
**原因**: キャッシュが残っている  
**解決**: `voiceProvider.clearCache()` を実行

#### 2. 接続エラー
**原因**: COEIROINKサーバーが起動していない  
**解決**: サーバー起動確認、接続設定確認

#### 3. スタイルIDが0になる
**原因**: 音声情報取得エラー  
**解決**: サーバー接続確認、ログでエラー詳細確認

### ログ確認
```bash
# 音声情報取得の詳細ログ
DEBUG=voice-provider npm start

# 接続エラーの確認
tail -f ~/.coeiro-operator/logs/error.log
```

## 今後の拡張予定

### 計画中の機能
1. **音声品質情報**: サンプルレート、ビットレート等の情報取得
2. **カスタムスタイル**: ユーザー定義スタイルの対応
3. **音声プレビュー**: 短いサンプル音声の生成・再生
4. **バッチ処理**: 複数音声の一括情報取得

### アーキテクチャ拡張
- プラグインシステム対応
- 他の音声エンジンとの統合
- クラウド音声サービス対応