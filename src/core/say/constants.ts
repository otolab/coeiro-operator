/**
 * src/say/constants.ts: 音声合成システムのデフォルト定数定義
 * 
 * 📖 関連ドキュメント：
 * - docs/configuration-options.md - 設定オプション詳細ガイド
 * - docs/installation.md - インストール・セットアップガイド（設定例）
 * - docs/audio-system.md - 音声システム仕様
 * - docs/config-samples/ - 設定ファイルサンプル
 * 
 * ⚠️  重要：これらの定数値を変更した場合は、上記ドキュメントも同期更新が必要です
 * 
 * 🔄 設定値同期チェックリスト：
 * 1. constants.ts（このファイル）
 * 2. docs/configuration-options.md の設定表とデフォルト値
 * 3. docs/installation.md の設定例
 * 4. docs/config-samples/*.json のサンプル設定
 * 5. README.md の機能説明（該当する場合）
 */

// ================================
// デフォルト音声設定（COEIROINKデフォルト）
// つくよみちゃん「れいせい」がCOEIROINKの標準音声
// ================================
export const DEFAULT_VOICE = {
    /** デフォルト音声ID - つくよみちゃん */
    ID: '3c37646f-3881-5374-2a83-149267990abc',
    /** デフォルトスタイルID - れいせい */
    STYLE_ID: 0
} as const;

// ================================
// 接続設定
// ================================
export const CONNECTION_SETTINGS = {
    /** デフォルトホスト */
    DEFAULT_HOST: 'localhost',
    /** デフォルトポート */
    DEFAULT_PORT: '50032'
} as const;

// ================================
// サンプルレート設定
// 📄 docs/configuration-options.md: `synthesisRate`, `playbackRate`
// 📄 docs/audio-system.md: サンプルレート分離の説明
// ================================
export const SAMPLE_RATES = {
    /** 音声生成時のサンプルレート（効率重視） */
    SYNTHESIS: 24000,
    /** 再生時のサンプルレート（高品質） */
    PLAYBACK: 48000
} as const;

// ================================
// 音声フォーマット設定
// ================================
export const AUDIO_FORMAT = {
    /** チャンネル数（モノラル） */
    CHANNELS: 1,
    /** ビット深度 */
    BIT_DEPTH: 16
} as const;

// ================================
// バッファサイズ設定
// 📄 docs/configuration-options.md: `bufferSize`, `bufferSettings`
// 📄 docs/installation.md: --buffer-size説明
// ================================
export const BUFFER_SIZES = {
    /** デフォルトバッファサイズ */
    DEFAULT: 1024,
    /** 最小バッファサイズ */
    MIN: 256,
    /** 最大バッファサイズ */
    MAX: 8192,
    
    // プリセット別設定
    PRESETS: {
        ULTRA_LOW: {
            HIGH_WATER_MARK: 64,
            LOW_WATER_MARK: 32
        },
        BALANCED: {
            HIGH_WATER_MARK: 256,
            LOW_WATER_MARK: 128
        },
        QUALITY: {
            HIGH_WATER_MARK: 512,
            LOW_WATER_MARK: 256
        }
    }
} as const;

// ================================
// フィルター設定
// 📄 docs/configuration-options.md: `processing`セクション
// 📄 docs/audio-system.md: フィルター技術仕様
// ================================
export const FILTER_SETTINGS = {
    /** ローパスフィルターのデフォルトカットオフ周波数 */
    LOWPASS_CUTOFF: 24000,
    /** ノイズリダクションのデフォルト状態 */
    NOISE_REDUCTION_DEFAULT: false,
    /** ローパスフィルターのデフォルト状態 */
    LOWPASS_FILTER_DEFAULT: false
} as const;

// ================================
// テキスト分割設定
// 📄 docs/configuration-options.md: `splitMode`, `splitSettings`
// 📄 docs/installation.md: パフォーマンス最適化の分割設定説明
// ================================
export const SPLIT_SETTINGS = {
    DEFAULTS: {
        SMALL_SIZE: 30,
        MEDIUM_SIZE: 50,
        LARGE_SIZE: 100,
        OVERLAP_RATIO: 0.1
    },
    PUNCTUATION: {
        MAX_CHUNK_SIZE: 150,           // 句読点分割時の最大文字数（フォールバック）
        PREFER_SENTENCE: true,         // 句点（。）を優先
        ALLOW_COMMA_SPLIT: true,       // 読点（、）での分割を許可
        MIN_CHUNK_SIZE: 10,            // 最小チャンクサイズ
        OVERLAP_CHARS: 0               // 句読点分割ではオーバーラップなし
    },
    PRESETS: {
        ULTRA_LOW: {
            SMALL_SIZE: 20,
            MEDIUM_SIZE: 30,
            LARGE_SIZE: 50,
            OVERLAP_RATIO: 0.05
        },
        BALANCED: {
            SMALL_SIZE: 30,
            MEDIUM_SIZE: 50,
            LARGE_SIZE: 100,
            OVERLAP_RATIO: 0.1
        },
        QUALITY: {
            SMALL_SIZE: 40,
            MEDIUM_SIZE: 70,
            LARGE_SIZE: 150,
            OVERLAP_RATIO: 0.15
        }
    }
} as const;

// ================================
// パディング設定
// ================================
export const PADDING_SETTINGS = {
    DEFAULTS: {
        ENABLED: true,
        PRE_PHONEME_LENGTH: 0.01,  // 10ms
        POST_PHONEME_LENGTH: 0.01, // 10ms
        FIRST_CHUNK_ONLY: true
    },
    PRESETS: {
        ULTRA_LOW: {
            ENABLED: false,
            PRE_PHONEME_LENGTH: 0,
            POST_PHONEME_LENGTH: 0,
            FIRST_CHUNK_ONLY: true
        },
        BALANCED: {
            ENABLED: true,
            PRE_PHONEME_LENGTH: 0.01,
            POST_PHONEME_LENGTH: 0.01,
            FIRST_CHUNK_ONLY: true
        },
        QUALITY: {
            ENABLED: true,
            PRE_PHONEME_LENGTH: 0.02,
            POST_PHONEME_LENGTH: 0.02,
            FIRST_CHUNK_ONLY: false
        }
    }
} as const;

// ================================
// クロスフェード設定
// ================================
export const CROSSFADE_SETTINGS = {
    DEFAULTS: {
        ENABLED: true,
        SKIP_FIRST_CHUNK: true,
        OVERLAP_SAMPLES: 24
    },
    PRESETS: {
        ULTRA_LOW: {
            ENABLED: false,
            SKIP_FIRST_CHUNK: true,
            OVERLAP_SAMPLES: 0
        },
        BALANCED: {
            ENABLED: true,
            SKIP_FIRST_CHUNK: true,
            OVERLAP_SAMPLES: 24
        },
        QUALITY: {
            ENABLED: true,
            SKIP_FIRST_CHUNK: false,
            OVERLAP_SAMPLES: 48
        }
    }
} as const;

// ================================
// 音声合成設定
// 📄 docs/configuration-options.md: `voice`セクション
// 📄 docs/installation.md: 基本設定例のrate値
// ================================
export const SYNTHESIS_SETTINGS = {
    /** デフォルト話速（WPM） */
    DEFAULT_RATE: 200,
    /** デフォルト音量 */
    DEFAULT_VOLUME: 1.0,
    /** デフォルト音高 */
    DEFAULT_PITCH: 0.0,
    /** デフォルトイントネーション */
    DEFAULT_INTONATION: 1.0
} as const;

// ================================
// ストリーミング設定
// ================================
export const STREAM_SETTINGS = {
    /** チャンク分割の基準文字数 */
    CHUNK_SIZE_CHARS: 50,
    /** チャンク間のオーバーラップ文字数 */
    OVERLAP_CHARS: 5,
    /** 音声バッファサイズ（並列処理数） */
    BUFFER_SIZE: 3,
    /** 音声出力バッファ時間（ms） */
    AUDIO_BUFFER_MS: 100,
    /** 無音パディング時間（ms） */
    SILENCE_PADDING_MS: 50,
    /** 先読みチャンク数 */
    PRELOAD_CHUNKS: 2
} as const;

// 重複した定義は上部で既に定義されているため削除

// ================================
// ヘルパー型定義
// ================================
export type LatencyMode = 'ultra-low' | 'balanced' | 'quality';
export type SplitMode = 'auto' | 'none' | 'small' | 'medium' | 'large' | 'punctuation';