/**
 * DictionaryPersistenceManager テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';
import os from 'os';
import { DictionaryPersistenceManager, PersistentDictionary } from './dictionary-persistence.js';
import { DictionaryWord } from './dictionary-client.js';

// fs モジュールのモック
vi.mock('fs');
vi.mock('fs/promises');

describe('DictionaryPersistenceManager', () => {
  let manager: DictionaryPersistenceManager;
  const mockHomeDir = '/home/testuser';
  const expectedConfigDir = path.join(mockHomeDir, '.coeiro-operator');
  const expectedDictionaryFile = path.join(expectedConfigDir, 'user-dictionary.json');

  beforeEach(() => {
    vi.clearAllMocks();
    
    // os.homedir のモック
    vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    
    // fs.existsSync のデフォルトモック
    vi.mocked(fs.existsSync).mockReturnValue(false);
    
    // fs.mkdirSync のモック
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as unknown);
    
    manager = new DictionaryPersistenceManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('設定ディレクトリが存在しない場合は作成する', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      new DictionaryPersistenceManager();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expectedConfigDir,
        { recursive: true }
      );
    });

    it('設定ディレクトリが既に存在する場合は作成しない', () => {
      // existsSyncのモックをクリアして新しく設定
      vi.mocked(fs.existsSync).mockReset();
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      // mkdirSyncもリセット
      vi.mocked(fs.mkdirSync).mockReset();
      
      new DictionaryPersistenceManager();
      
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe('save', () => {
    it('辞書データを正しい形式で保存する', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST', yomi: 'テスト', accent: 1, numMoras: 3 }
      ];

      const writeFileMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(fsPromises).writeFile = writeFileMock;

      await manager.save(words, true);

      expect(writeFileMock).toHaveBeenCalledWith(
        expectedDictionaryFile,
        expect.anything(String),
        'utf8'
      );

      // 保存されたJSONデータを検証
      const savedData = JSON.parse(writeFileMock.mock.calls[0][1] as string);
      expect(savedData).toMatchObject({
        version: '1.0.0',
        customWords: words,
        includeDefaults: true
      });
      expect(savedData.lastUpdated).toBeDefined();
    });

    it('includeDefaultsのデフォルト値はtrue', async () => {
      const words: DictionaryWord[] = [];
      
      const writeFileMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(fsPromises).writeFile = writeFileMock;

      await manager.save(words);

      const savedData = JSON.parse(writeFileMock.mock.calls[0][1] as string);
      expect(savedData.includeDefaults).toBe(true);
    });

    it('保存エラー時に適切なエラーをスローする', async () => {
      const words: DictionaryWord[] = [];
      
      const writeFileMock = vi.fn().mockRejectedValue(new Error('Write failed'));
      vi.mocked(fsPromises).writeFile = writeFileMock;

      await expect(manager.save(words)).rejects.toThrow('辞書データの保存に失敗しました');
    });

    it('複数の単語を保存できる', async () => {
      const words: DictionaryWord[] = [
        { word: 'TEST1', yomi: 'テストイチ', accent: 1, numMoras: 5 },
        { word: 'TEST2', yomi: 'テストニ', accent: 2, numMoras: 4 },
        { word: 'TEST3', yomi: 'テストサン', accent: 0, numMoras: 5 }
      ];

      const writeFileMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(fsPromises).writeFile = writeFileMock;

      await manager.save(words, false);

      const savedData = JSON.parse(writeFileMock.mock.calls[0][1] as string);
      expect(savedData.customWords).toHaveLength(3);
      expect(savedData.includeDefaults).toBe(false);
    });
  });

  describe('load', () => {
    it('ファイルが存在しない場合はnullを返す', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const result = await manager.load();
      
      expect(result).toBeNull();
    });

    it('正しい形式のデータを読み込める', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const mockData: PersistentDictionary = {
        version: '1.0.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        customWords: [
          { word: 'TEST', yomi: 'テスト', accent: 1, numMoras: 3 }
        ],
        includeDefaults: true
      };

      const readFileMock = vi.fn().mockResolvedValue(JSON.stringify(mockData));
      vi.mocked(fsPromises).readFile = readFileMock;

      const result = await manager.load();
      
      expect(result).toEqual(mockData);
      expect(readFileMock).toHaveBeenCalledWith(expectedDictionaryFile, 'utf8');
    });

    it('バージョンがない場合はエラーをスローする', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const invalidData = {
        customWords: [],
        includeDefaults: true
      };

      const readFileMock = vi.fn().mockResolvedValue(JSON.stringify(invalidData));
      vi.mocked(fsPromises).readFile = readFileMock;

      await expect(manager.load()).rejects.toThrow('辞書データのバージョンが不明です');
    });

    it('JSONパースエラー時に適切なエラーをスローする', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const readFileMock = vi.fn().mockResolvedValue('invalid json');
      vi.mocked(fsPromises).readFile = readFileMock;

      await expect(manager.load()).rejects.toThrow('辞書データの読み込みに失敗しました');
    });

    it('ファイル読み込みエラー時に適切なエラーをスローする', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const readFileMock = vi.fn().mockRejectedValue(new Error('Read failed'));
      vi.mocked(fsPromises).readFile = readFileMock;

      await expect(manager.load()).rejects.toThrow('辞書データの読み込みに失敗しました');
    });
  });

  describe('clear', () => {
    it('ファイルが存在する場合は削除する', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const unlinkMock = vi.fn().mockResolvedValue(undefined);
      vi.mocked(fsPromises).unlink = unlinkMock;

      await manager.clear();
      
      expect(unlinkMock).toHaveBeenCalledWith(expectedDictionaryFile);
    });

    it('ファイルが存在しない場合は何もしない', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const unlinkMock = vi.fn();
      vi.mocked(fsPromises).unlink = unlinkMock;

      await manager.clear();
      
      expect(unlinkMock).not.toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('ファイルが存在する場合はtrueを返す', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const result = manager.exists();
      
      expect(result).toBe(true);
    });

    it('ファイルが存在しない場合はfalseを返す', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const result = manager.exists();
      
      expect(result).toBe(false);
    });
  });

  describe('getFilePath', () => {
    it('辞書ファイルのパスを返す', () => {
      const path = manager.getFilePath();
      
      expect(path).toBe(expectedDictionaryFile);
    });
  });

  describe('Integration scenarios', () => {
    it('save → load のラウンドトリップが正しく動作する', async () => {
      const words: DictionaryWord[] = [
        { word: 'COEIRO', yomi: 'コエイロ', accent: 2, numMoras: 4 },
        { word: 'Claude', yomi: 'クロード', accent: 2, numMoras: 4 }
      ];

      let savedData: string | undefined;
      
      // save のモック
      const writeFileMock = vi.fn().mockImplementation((path, data) => {
        savedData = data;
        return Promise.resolve();
      });
      vi.mocked(fsPromises).writeFile = writeFileMock;

      // load のモック
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const readFileMock = vi.fn().mockImplementation(() => {
        return Promise.resolve(savedData);
      });
      vi.mocked(fsPromises).readFile = readFileMock;

      // 保存
      await manager.save(words, false);
      
      // 読み込み
      const loaded = await manager.load();
      
      expect(loaded).toBeDefined();
      expect(loaded?.customWords).toEqual(words);
      expect(loaded?.includeDefaults).toBe(false);
      expect(loaded?.version).toBe('1.0.0');
    });

    it('clear後はファイルが存在しない', async () => {
      // 初期状態：ファイルが存在する
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const unlinkMock = vi.fn().mockImplementation(() => {
        // unlink後はファイルが存在しない
        vi.mocked(fs.existsSync).mockReturnValue(false);
        return Promise.resolve();
      });
      vi.mocked(fsPromises).unlink = unlinkMock;

      expect(manager.exists()).toBe(true);
      
      await manager.clear();
      
      expect(manager.exists()).toBe(false);
    });
  });
});