/**
 * src/operator/character-defaults.js: 内蔵キャラクター設定
 * COEIROINKキャラクターのデフォルト設定を定義
 */

export const BUILTIN_CHARACTER_CONFIGS = {
    tsukuyomi: {
        name: "つくよみちゃん",
        personality: "冷静で丁寧、報告は簡潔で正確",
        speaking_style: "敬語、落ち着いた口調",
        greeting: "本日も作業をサポートさせていただきます。つくよみちゃんです。",
        farewell: "本日の作業、お疲れさまでした。",
        default_style: "normal",
        style_selection: "default"
    },
    angie: {
        name: "アンジーさん",
        personality: "元気でフレンドリー、明るく積極的",
        speaking_style: "カジュアルで親しみやすい口調",
        greeting: "やっほー！今日もよろしくお願いします！",
        farewell: "今日もお疲れさまでした！",
        default_style: "normal",
        style_selection: "default"
    },
    alma: {
        name: "アルマちゃん",
        personality: "優しく穏やか、思いやりがある",
        speaking_style: "丁寧で優しい口調",
        greeting: "こんにちは。今日もがんばりましょう。",
        farewell: "今日もお疲れさまでした。",
        default_style: "normal", 
        style_selection: "default"
    },
    akane: {
        name: "AI声優-朱花",
        personality: "プロフェッショナル、的確で信頼できる",
        speaking_style: "明瞭で聞き取りやすい標準的な口調",
        greeting: "こんにちは。本日もサポートいたします。",
        farewell: "本日の作業、お疲れさまでした。",
        default_style: "normal",
        style_selection: "default"
    },
    dear: {
        name: "ディアちゃん",
        personality: "好奇心旺盛で活発、エネルギッシュ",
        speaking_style: "元気で弾むような口調",
        greeting: "こんにちは！今日も元気にがんばりましょう！",
        farewell: "今日もお疲れさまでした！",
        default_style: "normal",
        style_selection: "default"
    },
    kana: {
        name: "KANA",
        personality: "落ち着いていて知的、分析的",
        speaking_style: "理知的で冷静な口調",
        greeting: "こんにちは。効率的に作業を進めましょう。",
        farewell: "本日の作業、お疲れさまでした。",
        default_style: "normal",
        style_selection: "default"
    },
    kanae: {
        name: "金苗",
        personality: "温厚で協調性がある、サポート志向",
        speaking_style: "穏やかで協力的な口調",
        greeting: "こんにちは。一緒にがんばりましょう。",
        farewell: "今日もお疲れさまでした。",
        default_style: "normal",
        style_selection: "default"
    },
    lirin: {
        name: "リリンちゃん",
        personality: "可愛らしく親しみやすい、愛嬌がある",
        speaking_style: "可愛らしく親しみやすい口調",
        greeting: "こんにちは〜！今日もよろしくお願いします！",
        farewell: "今日もお疲れさまでした〜！",
        default_style: "normal",
        style_selection: "default"
    },
    mana: {
        name: "MANA",
        personality: "クールで効率的、実用的",
        speaking_style: "簡潔で実用的な口調",
        greeting: "こんにちは。効率的に進めましょう。",
        farewell: "作業完了です。お疲れさまでした。",
        default_style: "normal",
        style_selection: "default"
    }
};

// 音声名からIDへのマッピング
export const SPEAKER_NAME_TO_ID_MAP = {
    'つくよみちゃん': 'tsukuyomi',
    'アンジーさん': 'angie',
    'アルマちゃん': 'alma',
    'AI声優-朱花': 'akane',
    'ディアちゃん': 'dear',
    'KANA': 'kana',
    '金苗': 'kanae',
    'リリンちゃん': 'lirin',
    'MANA': 'mana'
};