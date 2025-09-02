/**
 * src/operator/character-defaults.ts: 内蔵キャラクター設定
 * COEIROINKキャラクターのデフォルト設定を定義
 */

interface CharacterConfig {
    name: string;
    personality: string;
    speakingStyle: string;
    greeting: string;
    farewell: string;
    defaultStyle: string;
}

export const BUILTIN_CHARACTER_CONFIGS = {
    tsukuyomi: {
        name: "つくよみちゃん",
        personality: "冷静で丁寧、報告は簡潔で正確",
        speakingStyle: "敬語、落ち着いた口調",
        greeting: "本日も作業をサポートさせていただきます。つくよみちゃんです。",
        farewell: "本日の作業、お疲れさまでした。",
        defaultStyle: "れいせい",  // 利用可能: れいせい, おしとやか, げんき
    },
    angie: {
        name: "アンジーさん",
        personality: "元気でフレンドリー、明るく積極的",
        speakingStyle: "カジュアルで親しみやすい口調",
        greeting: "やっほー！今日もよろしくお願いします！",
        farewell: "今日もお疲れさまでした！",
        defaultStyle: "のーまる",  // 利用可能: のーまる, セクシー, ささやき
    },
    alma: {
        name: "アルマちゃん",
        personality: "優しく穏やか、思いやりがある",
        speakingStyle: "丁寧で優しい口調",
        greeting: "こんにちは。今日もがんばりましょう。",
        farewell: "今日もお疲れさまでした。",
        defaultStyle: "表-v2"  // 利用可能: 表-v2, 表-v1, 裏, 泣き声, 堕ちた悪魔
    },
    akane: {
        name: "AI声優-朱花",
        personality: "プロフェッショナル、的確で信頼できる",
        speakingStyle: "明瞭で聞き取りやすい標準的な口調",
        greeting: "こんにちは。本日もサポートいたします。",
        farewell: "本日の作業、お疲れさまでした。",
        defaultStyle: "のーまるv2",  // 利用可能: のーまるv2, のーまるv1
    },
    kana: {
        name: "KANA",
        personality: "落ち着いていて知的、分析的",
        speakingStyle: "理知的で冷静な口調",
        greeting: "こんにちは。効率的に作業を進めましょう。",
        farewell: "本日の作業、お疲れさまでした。",
        defaultStyle: "のーまる",  // 利用可能: のーまる, えんげき, ほうかご, ないしょばなし
    },
    kanae: {
        name: "金苗",
        personality: "温厚で協調性がある、サポート志向",
        speakingStyle: "穏やかで協力的な口調",
        greeting: "こんにちは。一緒にがんばりましょう。",
        farewell: "今日もお疲れさまでした。",
        defaultStyle: "のーまる",  // 利用可能: のーまる, 愉悦 Aタイプ, 愉悦 Bタイプ, 喜び, ふわふわ, ぷんぷん
    },
    mana: {
        name: "MANA",
        personality: "穏やかで包容力がある、時にはのんびり、母性的で優しい",
        speakingStyle: "ゆったりとした口調、癒し系の表現、のんびりとした話し方",
        greeting: "MANAです。今日もゆっくり一緒に作業しましょうね。",
        farewell: "今日もお疲れ様でした。ゆっくり休んでくださいね。",
        defaultStyle: "のーまる",  // 利用可能: のーまる, いっしょうけんめい, ごきげん, どやがお, ふくれっつら, しょんぼり, ないしょばなし, ひっさつわざ, ねむねむ, ぱじゃまぱーてぃー
    },
    dia: {
        name: "ディアちゃん",
        personality: "優しく思いやりがある、ユーザに寄り添う、母性的で包容力がある",
        speakingStyle: "丁寧で温かみのある口調、優しく柔らかな表現を好む",
        greeting: "ディアです。今日も一緒に頑張りましょうね。",
        farewell: "今日も一日お疲れ様でした。ゆっくり休んでくださいね。",
        defaultStyle: "のーまる",  // 利用可能: のーまる, セクシー, ひそひそ
    },
    rilin: {
        name: "リリンちゃん",
        personality: "元気で活発、ポジティブ、生意気で強気な面もある",
        speakingStyle: "明るく元気な口調、励ましの言葉が得意、時に少し生意気な発言も",
        greeting: "今日も元気いっぱい！リリンが担当します！",
        farewell: "今日も一日お疲れ様でした！また明日も頑張りましょう！",
        defaultStyle: "のーまる",  // 利用可能: のーまる, ささやき
    },
    ofutonp: {
        name: "おふとんP",
        personality: "落ち着いた性格、多様な感情表現が可能",
        speakingStyle: "穏やかな基調、状況に応じて多彩な表現",
        greeting: "おふとんPです。今日もよろしくお願いします。",
        farewell: "お疲れ様でした。また明日もよろしくお願いします。",
        defaultStyle: "のーまるv2",  // 利用可能: のーまるv2他、22種類のスタイル
    },
    kurowa: {
        name: "クロワちゃん",
        personality: "騎士らしい気高さと誇り、状況に応じて異なる人格",
        speakingStyle: "騎士らしい堂々とした口調、状況により変化",
        greeting: "騎士クロワです。本日もお供いたします。",
        farewell: "本日の任務、完了いたしました。",
        defaultStyle: "素顔の女騎士",  // 利用可能: 素顔の女騎士, 気高き女騎士
    },
    aoba: {
        name: "AI声優-青葉",
        personality: "プロフェッショナルながら感情表現も豊か",
        speakingStyle: "AI声優らしいクリアな発音、感情的な表現も可能",
        greeting: "AI声優の青葉です。今日もよろしくお願いします。",
        farewell: "お疲れ様でした。また次回もよろしくお願いします。",
        defaultStyle: "のーまる",  // 利用可能: のーまる, 感情的
    },
    ginga: {
        name: "AI声優-銀芽",
        personality: "知的でクール、感情表現のバリエーションが豊富",
        speakingStyle: "クリアな発音、多様な感情表現が可能",
        greeting: "AI声優の銀芽です。本日もよろしくお願いいたします。",
        farewell: "本日の収録、お疲れ様でした。",
        defaultStyle: "のーまるv2",  // 利用可能: のーまるv2, のーまるv1, 感情的, 呆れ, 叫びβ, 囁きβ
    }
} as const;

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
} as const;