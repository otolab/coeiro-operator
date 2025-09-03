/**
 * DictionaryClient テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DictionaryClient, DictionaryWord, DEFAULT_TECHNICAL_WORDS, CHARACTER_NAME_WORDS } from './dictionary-client.js';

// fetch のモック
global.fetch = vi.fn();

describe('DictionaryClient', () => {
  let client: DictionaryClient;

  beforeEach(() => {
    client = new DictionaryClient();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('デフォルト設定でインスタンスを作成できる', () => {
      const client = new DictionaryClient();
      expect(client).toBeInstanceOf(DictionaryClient);
    });

    it('カスタム設定でインスタンスを作成できる', () => {
      const client = new DictionaryClient({ host: '192.168.1.100', port: 50033 });
      expect(client).toBeInstanceOf(DictionaryClient);
    });
  });

  describe('registerWords', () => {
    it('単語を正常に登録できる', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST', yomi: 'テスト', accent: 1, numMoras: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await client.registerWords(words);
      
      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('半角英数字を全角に自動変換して登録する', async () => {
      const words: DictionaryWord[] = [
        { word: 'ABC123', yomi: 'エービーシー', accent: 0, numMoras: 6 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await client.registerWords(words);

      // fetch の呼び出しを確認
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:50032/v1/set_dictionary',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('ＡＢＣ１２３')
        })
      );
    });

    it('サーバーエラー時にエラーを返す', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST', yomi: 'テスト', accent: 1, numMoras: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await client.registerWords(words);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('接続エラー時に適切なメッセージを返す', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST', yomi: 'テスト', accent: 1, numMoras: 3 }
      ];

      const error = new Error('ECONNREFUSED');
      (global.fetch as any).mockRejectedValueOnce(error);

      const result = await client.registerWords(words);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('COEIROINKサーバーに接続できません');
      expect(result.error).toContain('http://localhost:50032');
    });

    it('複数の単語を一括登録できる', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST1', yomi: 'テストイチ', accent: 1, numMoras: 5 },
        { word: 'TEST2', yomi: 'テストニ', accent: 2, numMoras: 4 },
        { word: 'TEST3', yomi: 'テストサン', accent: 0, numMoras: 5 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      const result = await client.registerWords(words);
      
      expect(result.success).toBe(true);
      expect(result.registeredCount).toBe(3);
    });
  });

  describe('checkConnection', () => {
    it('サーバーに接続できる場合はtrueを返す', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      const isConnected = await client.checkConnection();
      
      expect(isConnected).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:50032/',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('サーバーに接続できない場合はfalseを返す', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Connection refused'));

      const isConnected = await client.checkConnection();
      
      expect(isConnected).toBe(false);
    });

    it('タイムアウト時はfalseを返す', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('AbortError'));

      const isConnected = await client.checkConnection();
      
      expect(isConnected).toBe(false);
    });
  });

  describe('toFullWidth (private method via registerWords)', () => {
    it('半角大文字を全角に変換する', async () => {
      const words: DictionaryWord[] = [
        { word: 'ABCXYZ', yomi: 'テスト', accent: 0, numMoras: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await client.registerWords(words);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.dictionaryWords[0].word).toBe('ＡＢＣＸＹＺ');
    });

    it('半角小文字を全角に変換する', async () => {
      const words: DictionaryWord[] = [
        { word: 'abcxyz', yomi: 'テスト', accent: 0, numMoras: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await client.registerWords(words);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.dictionaryWords[0].word).toBe('ａｂｃｘｙｚ');
    });

    it('半角数字を全角に変換する', async () => {
      const words: DictionaryWord[] = [
        { word: '0123456789', yomi: 'スウジ', accent: 0, numMoras: 3 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await client.registerWords(words);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.dictionaryWords[0].word).toBe('０１２３４５６７８９');
    });

    it('日本語文字はそのまま保持する', async () => {
      const words: DictionaryWord[] = [
        { word: 'つくよみちゃん', yomi: 'ツクヨミチャン', accent: 3, numMoras: 6 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await client.registerWords(words);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.dictionaryWords[0].word).toBe('つくよみちゃん');
    });

    it('混在文字列を適切に変換する', async () => {
      const words: DictionaryWord[] = [
        { word: 'Node.jsでCOEIRO', yomi: 'ノードジェイエス', accent: 0, numMoras: 8 }
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      await client.registerWords(words);

      const callBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(callBody.dictionaryWords[0].word).toBe('Ｎｏｄｅ．ｊｓでＣＯＥＩＲＯ');
    });
  });
});

describe('DEFAULT_TECHNICAL_WORDS', () => {
  it('技術用語辞書が定義されている', () => {
    expect(DEFAULT_TECHNICAL_WORDS).toBeDefined();
    expect(Array.isArray(DEFAULT_TECHNICAL_WORDS)).toBe(true);
    expect(DEFAULT_TECHNICAL_WORDS.length).toBeGreaterThan(0);
  });

  it('各単語が正しい形式を持つ', () => {
    DEFAULT_TECHNICAL_WORDS.forEach(word => {
      expect(word).toHaveProperty('word');
      expect(word).toHaveProperty('yomi');
      expect(word).toHaveProperty('accent');
      expect(word).toHaveProperty('numMoras');
      
      expect(typeof word.word).toBe('string');
      expect(typeof word.yomi).toBe('string');
      expect(typeof word.accent).toBe('number');
      expect(typeof word.numMoras).toBe('number');
      
      // アクセント位置はモーラ数以下である必要がある
      expect(word.accent).toBeLessThanOrEqual(word.numMoras);
      expect(word.accent).toBeGreaterThanOrEqual(0);
    });
  });

  it('COEIROINKが含まれている', () => {
    const coeiro = DEFAULT_TECHNICAL_WORDS.find(w => w.word === 'COEIROINK');
    expect(coeiro).toBeDefined();
    expect(coeiro?.yomi).toBe('コエイロインク');
  });
});

describe('CHARACTER_NAME_WORDS', () => {
  it('キャラクター名辞書が定義されている', () => {
    expect(CHARACTER_NAME_WORDS).toBeDefined();
    expect(Array.isArray(CHARACTER_NAME_WORDS)).toBe(true);
    expect(CHARACTER_NAME_WORDS.length).toBeGreaterThan(0);
  });

  it('各キャラクター名が正しい形式を持つ', () => {
    CHARACTER_NAME_WORDS.forEach(word => {
      expect(word).toHaveProperty('word');
      expect(word).toHaveProperty('yomi');
      expect(word).toHaveProperty('accent');
      expect(word).toHaveProperty('numMoras');
      
      expect(typeof word.word).toBe('string');
      expect(typeof word.yomi).toBe('string');
      expect(typeof word.accent).toBe('number');
      expect(typeof word.numMoras).toBe('number');
      
      // アクセント位置はモーラ数以下である必要がある
      expect(word.accent).toBeLessThanOrEqual(word.numMoras);
      expect(word.accent).toBeGreaterThanOrEqual(0);
    });
  });

  it('つくよみちゃんが含まれている', () => {
    const tsukuyomi = CHARACTER_NAME_WORDS.find(w => w.word === 'つくよみちゃん');
    expect(tsukuyomi).toBeDefined();
    expect(tsukuyomi?.yomi).toBe('ツクヨミチャン');
    expect(tsukuyomi?.accent).toBe(3);
    expect(tsukuyomi?.numMoras).toBe(6);
  });
});