/**
 * src/utils/logger.test.ts: Logger のテスト
 */

import { logger, configureLogger, LoggerPresets, LogLevel } from './logger.js';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Logger', () => {
  let consoleSpy: {
    error: any;
    warn: any;
    log: any;
  };

  beforeEach(() => {
    consoleSpy = {
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ログレベル制御', () => {
    test('quiet レベルでは何も出力しない', () => {
      configureLogger({ level: 'quiet', isMcpMode: false });

      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');
      logger.debug('test debug');

      expect(consoleSpy.error).not.toHaveBeenCalled();
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    test('error レベルではエラーのみ出力', () => {
      configureLogger({ level: 'error', isMcpMode: false });

      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    test('info レベルでは info 以上を出力', () => {
      configureLogger({ level: 'info', isMcpMode: false });

      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');
      logger.debug('test debug');

      expect(consoleSpy.error).toHaveBeenCalledTimes(2); // error, info (infoはconsole.errorに統一)
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1); // warn のみconsole.warnを使用
    });

    test('debug レベルではすべて出力', () => {
      configureLogger({ level: 'debug', isMcpMode: false });

      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');
      logger.verbose('test verbose');
      logger.debug('test debug');

      expect(consoleSpy.error).toHaveBeenCalledTimes(4); // error, info, verbose, debug
      expect(consoleSpy.warn).toHaveBeenCalledTimes(1); // warn
    });
  });

  describe('MCPモード', () => {
    test('MCPモードではエラーのみstderrに出力', () => {
      configureLogger({ level: 'debug', isMcpMode: true });

      logger.error('test error');
      logger.warn('test warn');
      logger.info('test info');
      logger.debug('test debug');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    test('MCPモードのerrorレベルでも同様', () => {
      configureLogger({ level: 'error', isMcpMode: true });

      logger.error('test error');
      logger.warn('test warn');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });
  });

  describe('メッセージフォーマット', () => {
    test('プレフィックス付きメッセージ', () => {
      configureLogger({ level: 'info', isMcpMode: false, prefix: 'TEST' });

      logger.info('test message');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[TEST] test message'));
    });

    test('引数付きメッセージ', () => {
      configureLogger({ level: 'info', isMcpMode: false });

      logger.info('test message', 'arg1', { key: 'value' });

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('test message arg1 {"key":"value"}')
      );
    });

    test('タイムスタンプとレベルを含む', () => {
      configureLogger({ level: 'info', isMcpMode: false, prefix: '' });

      logger.error('test message');

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z ERROR test message$/)
      );
    });
  });

  describe('プリセット設定', () => {
    test('mcpServer プリセット', () => {
      LoggerPresets.mcpServer();

      expect(logger.getLevel()).toBe('error');

      logger.error('test error');
      logger.info('test info');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('cli プリセット', () => {
      LoggerPresets.cli();

      expect(logger.getLevel()).toBe('info');

      logger.error('test error');
      logger.info('test info');
      logger.debug('test debug');

      expect(consoleSpy.error).toHaveBeenCalledTimes(2); // error + info
    });

    test('debug プリセット', () => {
      LoggerPresets.debug();

      expect(logger.getLevel()).toBe('debug');

      logger.debug('test debug');

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
    });

    test('quiet プリセット', () => {
      LoggerPresets.quiet();

      expect(logger.getLevel()).toBe('quiet');

      logger.error('test error');

      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('設定変更', () => {
    test('setLevel でレベル変更', () => {
      logger.setLevel('warn');
      expect(logger.getLevel()).toBe('warn');
    });

    test('setPrefix でプレフィックス変更', () => {
      configureLogger({ level: 'info', isMcpMode: false });
      logger.setPrefix('NEW');

      logger.info('test');

      expect(consoleSpy.error).toHaveBeenCalledWith(expect.stringContaining('[NEW] test'));
    });
  });
});
