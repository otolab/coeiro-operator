/**
 * src/operator/character-defaults.ts: 内蔵キャラクター設定
 * COEIROINKキャラクターのデフォルト設定を定義
 */

// スタイル設定（config.jsonに保存されるデータ）
export interface StyleConfig {
  styleName: string; // スタイル名（例: "のーまる", "ねむねむ"）
  morasPerSecond?: number; // 基準話速（モーラ/秒）- オプショナル
  personality?: string; // スタイル固有の性格（指定時はキャラクターのデフォルトを上書き）
  speakingStyle?: string; // スタイル固有の話し方（指定時はキャラクターのデフォルトを上書き）
  disabled?: boolean; // スタイル無効化フラグ
}

// キャラクター設定（config.jsonに保存・実行時に使用）
export interface CharacterConfig {
  speakerId: string; // COEIROINKのspeakerUuid（音声を特定）
  name: string; // 表示名（COEIROINKから取得、上書き可能）
  personality: string; // デフォルトの性格設定
  speakingStyle: string; // デフォルトの話し方の特徴
  greeting: string; // 挨拶メッセージ
  farewell: string; // お別れメッセージ
  defaultStyleId: number; // デフォルトスタイルID（数値）
  styles: Record<number, StyleConfig>; // スタイル設定（数値styleIdをキーに）
  disabled?: boolean; // キャラクター無効化フラグ
}

// characterキー（tsukuyomi等）をキーとした内蔵キャラクター設定
// speakerIdでCOEIROINKのSpeakerと紐付け
export const BUILTIN_CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  tsukuyomi: {
    speakerId: '3c37646f-3881-5374-2a83-149267990abc',
    name: 'つくよみちゃん',
    personality: '冷静で丁寧、報告は簡潔で正確',
    speakingStyle: '敬語、落ち着いた口調',
    greeting: '本日も作業をサポートさせていただきます。つくよみちゃんです。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyleId: 0, // れいせい
    styles: {
      0: { styleName: 'れいせい', morasPerSecond: 8.61 },
      5: { styleName: 'おしとやか', morasPerSecond: 8.19 },
      6: { styleName: 'げんき', morasPerSecond: 8.50 },
    },
  },
  angie: {
    speakerId: 'cc213e6d-d847-45b5-a1df-415744c890f2',
    name: 'アンジーさん',
    personality: '元気でフレンドリー、明るく積極的',
    speakingStyle: 'カジュアルで親しみやすい口調',
    greeting: 'やっほー！今日もよろしくお願いします！',
    farewell: '今日もお疲れさまでした！',
    defaultStyleId: 120, // のーまる
    styles: {
      120: { styleName: 'のーまる', morasPerSecond: 8.25 },
      121: {
        styleName: 'セクシー',
        morasPerSecond: 6.14,
        personality: '魅惑的で大人っぽい',
        speakingStyle: 'ゆっくりとした色っぽい口調'
      },
    },
  },
  alma: {
    speakerId: 'c97966b1-d80c-04f5-aba5-d30a92843b59',
    name: 'アルマちゃん',
    personality: '優しく穏やか、思いやりがある',
    speakingStyle: '丁寧で優しい口調',
    greeting: 'こんにちは。今日もがんばりましょう。',
    farewell: '今日もお疲れさまでした。',
    defaultStyleId: 10, // 表-v2
    styles: {
      10: { styleName: '表-v2', morasPerSecond: 7.24 },
      11: { styleName: '裏', morasPerSecond: 7.08 },
    },
  },
  akane: {
    speakerId: 'd1143ac1-c486-4273-92ef-a30938d01b91',
    name: 'AI声優-朱花',
    personality: 'プロフェッショナル、的確で信頼できる',
    speakingStyle: '明瞭で聞き取りやすい標準的な口調',
    greeting: 'こんにちは。本日もサポートいたします。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyleId: 50,
    styles: {
      50: { styleName: 'のーまるv2', morasPerSecond: 7.51 },
    },
  },
  kana: {
    speakerId: '297a5b91-f88a-6951-5841-f1e648b2e594',
    name: 'KANA',
    personality: '落ち着いていて知的、分析的',
    speakingStyle: '理知的で冷静な口調',
    greeting: 'こんにちは。効率的に作業を進めましょう。',
    farewell: '本日の作業、お疲れさまでした。',
    defaultStyleId: 30,
    styles: {
      30: { styleName: 'のーまる', morasPerSecond: 8.03 },
      31: { styleName: 'えんげき', morasPerSecond: 8.39 },
      32: { styleName: 'ほうかご', morasPerSecond: 8.50 },
    },
  },
  kanae: {
    speakerId: 'd41bcbd9-f4a9-4e10-b000-7a431568dd01',
    name: 'AI声優-金苗',
    personality: '上品で知的、お嬢様的な品格',
    speakingStyle: '丁寧で上品な口調',
    greeting: 'ごきげんよう。本日もよろしくお願いいたします。',
    farewell: 'お疲れさまでございました。',
    defaultStyleId: 100,
    styles: {
      100: { styleName: 'のーまる', morasPerSecond: 6.93 },
      104: { styleName: 'ふわふわ', morasPerSecond: 5.49 },
    },
  },
  mana: {
    speakerId: '292ea286-3d5f-f1cc-157c-66462a6a9d08',
    name: 'MANA',
    personality: '穏やかで包容力がある、時にはのんびり、母性的で優しい',
    speakingStyle: 'ゆったりとした口調、癒し系の表現、のんびりとした話し方',
    greeting: 'MANAです。今日もゆっくり一緒に作業しましょうね。',
    farewell: '今日もお疲れ様でした。ゆっくり休んでくださいね。',
    defaultStyleId: 1, // のーまる
    styles: {
      1: { styleName: 'のーまる', morasPerSecond: 8.20 },
      40: {
        styleName: 'ごきげん',
        morasPerSecond: 8.48,
        personality: '楽しそうで明るい',
        speakingStyle: '弾んだ声で楽しそうに'
      },
      42: {
        styleName: 'しょんぼり',
        morasPerSecond: 6.74,
        personality: '落ち込んでいる',
        speakingStyle: 'ゆっくりと力なく'
      },
      46: {
        styleName: 'ねむねむ',
        morasPerSecond: 4.81,
        personality: 'とても眠たそう',
        speakingStyle: 'とてもゆっくりと眠そうに'
      },
    },
  },
  dia: {
    speakerId: 'b28bb401-bc43-c9c7-77e4-77a2bbb4b283',
    name: 'ディアちゃん',
    personality: '優しく思いやりがある、ユーザに寄り添う、母性的で包容力がある',
    speakingStyle: '丁寧で温かみのある口調、優しく柔らかな表現を好む',
    greeting: 'ディアです。今日も一緒に頑張りましょうね。',
    farewell: '今日も一日お疲れ様でした。ゆっくり休んでくださいね。',
    defaultStyleId: 3,
    styles: {
      3: { styleName: 'のーまる', morasPerSecond: 6.95 },
      130: {
        styleName: 'セクシー',
        morasPerSecond: 6.19,
        personality: '魅惑的で大人っぽい',
        speakingStyle: 'ゆっくりとした色っぽい口調'
      },
      131: { styleName: 'ひそひそ', morasPerSecond: 6.71 },
    },
  },
  rilin: {
    speakerId: 'cb11bdbd-78fc-4f16-b528-a400bae1782d',
    name: 'リリンちゃん',
    personality: '元気で活発、ポジティブ、生意気で強気な面もある',
    speakingStyle: '明るく元気な口調、励ましの言葉が得意、時に少し生意気な発言も',
    greeting: '今日も元気いっぱい！リリンが担当します！',
    farewell: '今日も一日お疲れ様でした！また明日も頑張りましょう！',
    defaultStyleId: 90,
    styles: {
      90: { styleName: 'のーまる', morasPerSecond: 7.64 },
    },
  },
  ofutonp: {
    speakerId: 'a60ebf6c-626a-7ce6-5d69-c92bf2a1a1d0',
    name: 'おふとんP',
    personality: '落ち着いた性格、多様な感情表現が可能',
    speakingStyle: '穏やかな基調、状況に応じて多彩な表現',
    greeting: 'おふとんPです。今日もよろしくお願いします。',
    farewell: 'お疲れ様でした。また明日もよろしくお願いします。',
    defaultStyleId: 8,
    styles: {
      2: { styleName: 'のーまるv2', morasPerSecond: 7.50 },
      8: { styleName: 'ナレーション', morasPerSecond: 7.50 },
      21: { styleName: 'よろこび', morasPerSecond: 7.50 },
      22: { styleName: 'ささやき', morasPerSecond: 7.50 },
    },
  },
  kurowa: {
    speakerId: 'cc1153b4-d20c-46dd-a308-73ca38c0e85a',
    name: 'クロワちゃん',
    personality: '騎士らしい気高さと誇り、状況に応じて異なる人格',
    speakingStyle: '騎士らしい堂々とした口調、状況により変化',
    greeting: '騎士クロワです。本日もお供いたします。',
    farewell: '本日の任務、完了いたしました。',
    defaultStyleId: 110,
    styles: {
      110: { styleName: '素顔の女騎士', morasPerSecond: 7.86 },
    },
  },
  aoba: {
    speakerId: 'd219f5ab-a50b-4d99-a26a-a9fc213e9100',
    name: 'AI声優-青葉',
    personality: 'プロフェッショナルながら感情表現も豊か',
    speakingStyle: 'AI声優らしいクリアな発音、感情的な表現も可能',
    greeting: 'AI声優の青葉です。今日もよろしくお願いします。',
    farewell: 'お疲れ様でした。また次回もよろしくお願いします。',
    defaultStyleId: 60,
    styles: {
      60: { styleName: 'のーまる', morasPerSecond: 7.50 },
      61: { styleName: '感情的', morasPerSecond: 7.50 },
    },
  },
  ginga: {
    speakerId: 'd312d0fb-d38d-434e-825d-cbcbfd105ad0',
    name: 'AI声優-銀芽',
    personality: '知的でクール、感情表現のバリエーションが豊富',
    speakingStyle: 'クリアな発音、多様な感情表現が可能',
    greeting: 'AI声優の銀芽です。本日もよろしくお願いいたします。',
    farewell: '本日の収録、お疲れ様でした。',
    defaultStyleId: 70,
    styles: {
      70: { styleName: 'のーまるv2', morasPerSecond: 7.50 },
      71: { styleName: '感情的', morasPerSecond: 7.50 },
      72: { styleName: '呆れ', morasPerSecond: 7.50 },
      74: { styleName: '叫びβ', morasPerSecond: 7.50 },
      75: { styleName: '囁きβ', morasPerSecond: 7.50 },
    },
  },
  ameno: {
    speakerId: 'cc31327e-6617-446f-ba41-eb88f89b8fce',
    name: 'アメノちゃん',
    personality: '明るく元気で前向き、親しみやすい性格',
    speakingStyle: '元気いっぱいの明るい口調',
    greeting: 'おはよーございます！アメノです！今日も一緒に頑張りましょう！',
    farewell: '今日もお疲れ様でした！また明日も元気にいきましょう！',
    defaultStyleId: 140,
    styles: {
      140: { styleName: 'のーまる', morasPerSecond: 7.50 },
      141: { styleName: 'ギャル', morasPerSecond: 7.50 },
      142: { styleName: '熊本弁', morasPerSecond: 7.50 },
    },
  },
} as const;

// デフォルトのキャラクターID
export const DEFAULT_CHARACTER_ID = 'tsukuyomi';
