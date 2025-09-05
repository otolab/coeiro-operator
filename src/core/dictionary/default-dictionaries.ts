/**
 * デフォルト辞書データ
 *
 * COEIROINKに登録する標準的な単語の定義
 */

import { DictionaryWord } from './dictionary-client.js';

/**
 * デフォルトの技術用語辞書
 */
export const DEFAULT_TECHNICAL_WORDS: DictionaryWord[] = [
  // 音声合成関連
  { word: 'COEIRO', yomi: 'コエイロ', accent: 2, numMoras: 4 },
  { word: 'COEIROINK', yomi: 'コエイロインク', accent: 5, numMoras: 7 },

  // AI関連
  { word: 'Claude', yomi: 'クロード', accent: 2, numMoras: 4 },
  { word: 'Anthropic', yomi: 'アンソロピック', accent: 4, numMoras: 7 },
  { word: 'ChatGPT', yomi: 'チャットジーピーティー', accent: 0, numMoras: 10 },

  // 開発ツール
  { word: 'GitHub', yomi: 'ギットハブ', accent: 3, numMoras: 5 },
  { word: 'TypeScript', yomi: 'タイプスクリプト', accent: 5, numMoras: 8 },
  { word: 'Node.js', yomi: 'ノードジェイエス', accent: 0, numMoras: 8 },
  { word: 'npm', yomi: 'エヌピーエム', accent: 0, numMoras: 6 },

  // プロトコル・形式
  { word: 'MCP', yomi: 'エムシーピー', accent: 0, numMoras: 6 },
  { word: 'API', yomi: 'エーピーアイ', accent: 0, numMoras: 6 },
  { word: 'JSON', yomi: 'ジェイソン', accent: 1, numMoras: 4 },
  { word: 'CLI', yomi: 'シーエルアイ', accent: 0, numMoras: 6 },
  { word: 'GUI', yomi: 'ジーユーアイ', accent: 0, numMoras: 6 },
];

/**
 * キャラクター名辞書
 */
export const CHARACTER_NAME_WORDS: DictionaryWord[] = [
  { word: 'つくよみちゃん', yomi: 'ツクヨミチャン', accent: 3, numMoras: 6 },
  { word: 'アンジー', yomi: 'アンジー', accent: 1, numMoras: 4 },
  { word: 'アルマ', yomi: 'アルマ', accent: 1, numMoras: 3 },
  { word: 'ディア', yomi: 'ディア', accent: 1, numMoras: 2 },
  { word: 'リリン', yomi: 'リリン', accent: 1, numMoras: 3 },
  { word: 'クロワ', yomi: 'クロワ', accent: 1, numMoras: 3 },
];

/**
 * 全デフォルト辞書
 * 技術用語とキャラクター名を統合
 */
export const ALL_DEFAULT_WORDS: DictionaryWord[] = [
  ...DEFAULT_TECHNICAL_WORDS,
  ...CHARACTER_NAME_WORDS,
];
