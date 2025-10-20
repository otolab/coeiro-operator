/**
 * src/operator/character-defaults.ts: 内蔵キャラクター設定
 * COEIROINKキャラクターのデフォルト設定を定義
 */

// 内蔵設定用の基本型
export interface BaseCharacterConfig {
  speakerId: string; // COEIROINKのspeakerUuid（音声を特定）
  name: string; // 表示名（COEIROINKから取得、上書き可能）
  personality: string; // 性格設定
  speakingStyle: string; // 話し方の特徴
  greeting: string; // 挨拶メッセージ
  farewell: string; // お別れメッセージ
  defaultStyle: string; // デフォルトスタイル名
  baseMorasPerSecond?: number; // キャラクター固有の基準話速（モーラ/秒）
}

// 実際に使用される完全な型（起動時に利用可能性を確認）
export interface CharacterConfig extends BaseCharacterConfig {
  availableStyles?: string[]; // 利用可能なスタイル一覧（起動時に取得）
  disabled?: boolean; // キャラクター無効化フラグ
}

// characterキー（tsukuyomi等）をキーとした内蔵キャラクター設定
// speakerIdでCOEIROINKのSpeakerと紐付け
export const BUILTIN_CHARACTER_CONFIGS: Record<string, BaseCharacterConfig> = {
  tsukuyomi: {
    speakerId: '3c37646f-3881-5374-2a83-149267990abc',
    name: 'つくよみちゃん',
    personality: '冷静で丁寧、報告は簡潔で正確',
    speakingStyle: '敬語、落ち着いた口調',
    greeting: '本日も作業をサポートさせていただきます。つくよみちゃんです。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyle: 'れいせい', // 利用可能: れいせい, おしとやか, げんき
    baseMorasPerSecond: 8.61,
  },
  angie: {
    speakerId: 'cc213e6d-d847-45b5-a1df-415744c890f2',
    name: 'アンジーさん',
    personality: '元気でフレンドリー、明るく積極的',
    speakingStyle: 'カジュアルで親しみやすい口調',
    greeting: 'やっほー！今日もよろしくお願いします！',
    farewell: '今日もお疲れさまでした！',
    defaultStyle: 'のーまる', // 利用可能: のーまる, セクシー, ささやき
    baseMorasPerSecond: 8.25,
  },
  alma: {
    speakerId: 'c97966b1-d80c-04f5-aba5-d30a92843b59',
    name: 'アルマちゃん',
    personality: '優しく穏やか、思いやりがある',
    speakingStyle: '丁寧で優しい口調',
    greeting: 'こんにちは。今日もがんばりましょう。',
    farewell: '今日もお疲れさまでした。',
    defaultStyle: '表-v2', // 利用可能: 表-v2, 表-v1, 裏, 泣き声, 堕ちた悪魔
    baseMorasPerSecond: 7.24,
  },
  akane: {
    speakerId: 'd1143ac1-c486-4273-92ef-a30938d01b91',
    name: 'AI声優-朱花',
    personality: 'プロフェッショナル、的確で信頼できる',
    speakingStyle: '明瞭で聞き取りやすい標準的な口調',
    greeting: 'こんにちは。本日もサポートいたします。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyle: 'のーまるv2', // 利用可能: のーまるv2, のーまるv1
    baseMorasPerSecond: 7.51,
  },
  kana: {
    speakerId: '297a5b91-f88a-6951-5841-f1e648b2e594',
    name: 'KANA',
    personality: '落ち着いていて知的、分析的',
    speakingStyle: '理知的で冷静な口調',
    greeting: 'こんにちは。効率的に作業を進めましょう。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyle: 'のーまる', // 利用可能: のーまる, えんげき, ほうかご, ないしょばなし
    baseMorasPerSecond: 8.03,
  },
  kanae: {
    speakerId: 'd41bcbd9-f4a9-4e10-b000-7a431568dd01',
    name: 'AI声優-金苗',
    personality: '上品で知的、お嬢様的な品格',
    speakingStyle: '丁寧で上品な口調',
    greeting: 'ごきげんよう。本日もよろしくお願いいたします。',
    farewell: 'お疲れさまでございました。',
    defaultStyle: 'のーまる', // 利用可能: のーまる, 愉悦 Aタイプ, 愉悦 Bタイプ, 喜び, ふわふわ, ぷんぷん
    baseMorasPerSecond: 6.93,
  },
  mana: {
    speakerId: '292ea286-3d5f-f1cc-157c-66462a6a9d08',
    name: 'MANA',
    personality: '穏やかで包容力がある、時にはのんびり、母性的で優しい',
    speakingStyle: 'ゆったりとした口調、癒し系の表現、のんびりとした話し方',
    greeting: 'MANAです。今日もゆっくり一緒に作業しましょうね。',
    farewell: '今日もお疲れ様でした。ゆっくり休んでくださいね。',
    defaultStyle: 'のーまる', // 利用可能: のーまる, いっしょうけんめい, ごきげん, どやがお, ふくれっつら, しょんぼり, ないしょばなし, ひっさつわざ, ねむねむ, ぱじゃまぱーてぃー
    baseMorasPerSecond: 8.20,
  },
  dia: {
    speakerId: 'b28bb401-bc43-c9c7-77e4-77a2bbb4b283',
    name: 'ディアちゃん',
    personality: '優しく思いやりがある、ユーザに寄り添う、母性的で包容力がある',
    speakingStyle: '丁寧で温かみのある口調、優しく柔らかな表現を好む',
    greeting: 'ディアです。今日も一緒に頑張りましょうね。',
    farewell: '今日も一日お疲れ様でした。ゆっくり休んでくださいね。',
    defaultStyle: 'のーまる', // 利用可能: のーまる, セクシー, ひそひそ
    baseMorasPerSecond: 6.95,
  },
  rilin: {
    speakerId: 'cb11bdbd-78fc-4f16-b528-a400bae1782d',
    name: 'リリンちゃん',
    personality: '元気で活発、ポジティブ、生意気で強気な面もある',
    speakingStyle: '明るく元気な口調、励ましの言葉が得意、時に少し生意気な発言も',
    greeting: '今日も元気いっぱい！リリンが担当します！',
    farewell: '今日も一日お疲れ様でした！また明日も頑張りましょう！',
    defaultStyle: 'のーまる', // 利用可能: のーまる, ささやき
    baseMorasPerSecond: 7.64,
  },
  ofutonp: {
    speakerId: 'a60ebf6c-626a-7ce6-5d69-c92bf2a1a1d0',
    name: 'おふとんP',
    personality: '落ち着いた性格、多様な感情表現が可能',
    speakingStyle: '穏やかな基調、状況に応じて多彩な表現',
    greeting: 'おふとんPです。今日もよろしくお願いします。',
    farewell: 'お疲れ様でした。また明日もよろしくお願いします。',
    defaultStyle: 'ナレーション', // 利用可能: ナレーション他、22種類のスタイル
  },
  kurowa: {
    speakerId: 'cc1153b4-d20c-46dd-a308-73ca38c0e85a',
    name: 'クロワちゃん',
    personality: '騎士らしい気高さと誇り、状況に応じて異なる人格',
    speakingStyle: '騎士らしい堂々とした口調、状況により変化',
    greeting: '騎士クロワです。本日もお供いたします。',
    farewell: '本日の任務、完了いたしました。',
    defaultStyle: '素顔の女騎士', // 利用可能: 素顔の女騎士, 気高き女騎士
    baseMorasPerSecond: 7.86,
  },
  aoba: {
    speakerId: 'd219f5ab-a50b-4d99-a26a-a9fc213e9100',
    name: 'AI声優-青葉',
    personality: 'プロフェッショナルながら感情表現も豊か',
    speakingStyle: 'AI声優らしいクリアな発音、感情的な表現も可能',
    greeting: 'AI声優の青葉です。今日もよろしくお願いします。',
    farewell: 'お疲れ様でした。また次回もよろしくお願いします。',
    defaultStyle: 'のーまる', // 利用可能: のーまる, 感情的
  },
  ginga: {
    speakerId: 'd312d0fb-d38d-434e-825d-cbcbfd105ad0',
    name: 'AI声優-銀芽',
    personality: '知的でクール、感情表現のバリエーションが豊富',
    speakingStyle: 'クリアな発音、多様な感情表現が可能',
    greeting: 'AI声優の銀芽です。本日もよろしくお願いいたします。',
    farewell: '本日の収録、お疲れ様でした。',
    defaultStyle: 'のーまるv2', // 利用可能: のーまるv2, のーまるv1, 感情的, 呆れ, 叫びβ, 囁きβ
  },
} as const;

// デフォルトのキャラクターID
export const DEFAULT_CHARACTER_ID = 'tsukuyomi';
