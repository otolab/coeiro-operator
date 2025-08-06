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
        personality: "穏やかで包容力がある、時にはのんびり、母性的で優しい",
        speaking_style: "ゆったりとした口調、癒し系の表現、のんびりとした話し方",
        greeting: "MANAです。今日もゆっくり一緒に作業しましょうね。",
        farewell: "今日もお疲れ様でした。ゆっくり休んでくださいね。",
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
    dia: {
        name: "ディアちゃん",
        personality: "優しく思いやりがある、ユーザに寄り添う、母性的で包容力がある",
        speaking_style: "丁寧で温かみのある口調、優しく柔らかな表現を好む",
        greeting: "ディアです。今日も一緒に頑張りましょうね。",
        farewell: "今日も一日お疲れ様でした。ゆっくり休んでくださいね。",
        default_style: "normal",
        style_selection: "default"
    },
    rilin: {
        name: "リリンちゃん",
        personality: "元気で活発、ポジティブ、生意気で強気な面もある",
        speaking_style: "明るく元気な口調、励ましの言葉が得意、時に少し生意気な発言も",
        greeting: "今日も元気いっぱい！リリンが担当します！",
        farewell: "今日も一日お疲れ様でした！また明日も頑張りましょう！",
        default_style: "normal",
        style_selection: "default"
    },
    ofutonp: {
        name: "おふとんP",
        personality: "落ち着いた性格、多様な感情表現が可能",
        speaking_style: "穏やかな基調、状況に応じて多彩な表現",
        greeting: "おふとんPです。今日もよろしくお願いします。",
        farewell: "お疲れ様でした。また明日もよろしくお願いします。",
        default_style: "normal",
        style_selection: "default"
    },
    kurowa: {
        name: "クロワちゃん",
        personality: "騎士らしい気高さと誇り、状況に応じて異なる人格",
        speaking_style: "騎士らしい堂々とした口調、状況により変化",
        greeting: "騎士クロワです。本日もお供いたします。",
        farewell: "本日の任務、完了いたしました。",
        default_style: "normal",
        style_selection: "default"
    },
    aoba: {
        name: "AI声優-青葉",
        personality: "プロフェッショナルながら感情表現も豊か",
        speaking_style: "AI声優らしいクリアな発音、感情的な表現も可能",
        greeting: "AI声優の青葉です。今日もよろしくお願いします。",
        farewell: "お疲れ様でした。また次回もよろしくお願いします。",
        default_style: "normal",
        style_selection: "default"
    },
    ginga: {
        name: "AI声優-銀芽",
        personality: "知的でクール、感情表現のバリエーションが豊富",
        speaking_style: "クリアな発音、多様な感情表現が可能",
        greeting: "AI声優の銀芽です。本日もよろしくお願いいたします。",
        farewell: "本日の収録、お疲れ様でした。",
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
    'ディアちゃん': 'dia',
    'KANA': 'kana',
    '金苗': 'kanae',
    'AI声優-金苗': 'kanae',
    'リリンちゃん': 'rilin',
    'MANA': 'mana',
    'おふとんP': 'ofutonp',
    'クロワちゃん': 'kurowa',
    'AI声優-青葉': 'aoba',
    'AI声優-銀芽': 'ginga'
};