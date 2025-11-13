/**
 * Playback Tools Unit Tests
 * tools/playback.tsのユニットテスト
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SayCoeiroink } from '@coeiro-operator/audio';
import {
  registerQueueStatusTool,
  registerQueueClearTool,
  registerPlaybackStopTool,
  registerWaitForTaskCompletionTool,
} from './playback.js';

describe('Playback Tools', () => {
  let mockServer: McpServer;
  let mockSayCoeiroink: SayCoeiroink;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = new Map();

    // モックサーバーの作成
    mockServer = {
      registerTool: vi.fn((name: string, schema: any, handler: any) => {
        registeredTools.set(name, { schema, handler });
      }),
    } as any;

    // SayCoeiroinkのモック
    mockSayCoeiroink = {
      getSpeechQueueStatus: vi.fn(),
      clearSpeechQueue: vi.fn(),
      stopPlayback: vi.fn(),
      waitForQueueLength: vi.fn(),
    } as any;
  });

  describe('registerQueueStatusTool', () => {
    test('ツールが正しく登録されること', () => {
      registerQueueStatusTool(mockServer, mockSayCoeiroink);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'queue_status',
        expect.objectContaining({
          description: expect.stringContaining('音声キューの状態を確認'),
        }),
        expect.any(Function)
      );
    });

    test('キューステータスが取得できること', async () => {
      registerQueueStatusTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 3,
        isProcessing: true,
        nextTaskId: 12345,
        currentTaskId: 12344,
      });

      const tool = registeredTools.get('queue_status');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('キュー長: 3');
      expect(result.content[0].text).toContain('処理中');
      expect(result.content[0].text).toContain('12345');
    });

    test('キューが空の場合のステータスが表示されること', async () => {
      registerQueueStatusTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 0,
        isProcessing: false,
        nextTaskId: null,
        currentTaskId: null,
      });

      const tool = registeredTools.get('queue_status');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('キュー長: 0');
      expect(result.content[0].text).toContain('待機中');
    });
  });

  describe('registerQueueClearTool', () => {
    test('ツールが正しく登録されること', () => {
      registerQueueClearTool(mockServer, mockSayCoeiroink);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'queue_clear',
        expect.objectContaining({
          description: expect.stringContaining('音声キューをクリア'),
        }),
        expect.any(Function)
      );
    });

    test('キュー全体がクリアされること', async () => {
      registerQueueClearTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 0,
        isProcessing: false,
        nextTaskId: null,
        currentTaskId: null,
      });
      vi.mocked(mockSayCoeiroink.clearSpeechQueue).mockResolvedValue({
        removedCount: 5,
      });

      const tool = registeredTools.get('queue_clear');
      const result = await tool.handler({});

      expect(mockSayCoeiroink.clearSpeechQueue).toHaveBeenCalledWith(undefined);
      expect(result.content[0].text).toContain('5');
    });

    test('特定のタスクIDのみがクリアされること', async () => {
      registerQueueClearTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 0,
        isProcessing: false,
        nextTaskId: null,
        currentTaskId: null,
      });
      vi.mocked(mockSayCoeiroink.clearSpeechQueue).mockResolvedValue({
        removedCount: 2,
      });

      const tool = registeredTools.get('queue_clear');
      const result = await tool.handler({ taskIds: [12345, 12346] });

      expect(mockSayCoeiroink.clearSpeechQueue).toHaveBeenCalledWith([12345, 12346]);
      expect(result.content[0].text).toContain('2');
    });

    test('クリアするタスクがない場合のメッセージが表示されること', async () => {
      registerQueueClearTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 0,
        isProcessing: false,
        nextTaskId: null,
        currentTaskId: null,
      });
      vi.mocked(mockSayCoeiroink.clearSpeechQueue).mockResolvedValue({
        removedCount: 0,
      });

      const tool = registeredTools.get('queue_clear');
      const result = await tool.handler({});

      expect(result.content[0].text).toContain('0');
    });
  });

  describe('registerPlaybackStopTool', () => {
    test('ツールが正しく登録されること', () => {
      registerPlaybackStopTool(mockServer, mockSayCoeiroink);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'playback_stop',
        expect.objectContaining({
          description: expect.stringContaining('音声再生を停止'),
        }),
        expect.any(Function)
      );
    });

    test('再生停止が成功すること', async () => {
      registerPlaybackStopTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.stopPlayback).mockReturnValue(undefined);
      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 0,
        isProcessing: false,
        nextTaskId: null,
        currentTaskId: null,
      });

      const tool = registeredTools.get('playback_stop');
      const result = await tool.handler({});

      expect(mockSayCoeiroink.stopPlayback).toHaveBeenCalled();
      expect(result.content[0].text).toContain('音声再生の停止を要求しました');
    });
  });

  describe('registerWaitForTaskCompletionTool', () => {
    test('ツールが正しく登録されること', () => {
      registerWaitForTaskCompletionTool(mockServer, mockSayCoeiroink);

      expect(mockServer.registerTool).toHaveBeenCalledWith(
        'wait_for_task_completion',
        expect.objectContaining({
          description: expect.stringContaining('音声タスクの完了を待機'),
        }),
        expect.any(Function)
      );
    });

    test('全タスク完了まで待機すること（デフォルト）', async () => {
      registerWaitForTaskCompletionTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 3,
        isProcessing: true,
        nextTaskId: 12345,
        currentTaskId: 12344,
      });
      vi.mocked(mockSayCoeiroink.waitForQueueLength).mockResolvedValue();

      const tool = registeredTools.get('wait_for_task_completion');
      const result = await tool.handler({});

      expect(mockSayCoeiroink.waitForQueueLength).toHaveBeenCalledWith(0);
      expect(result.content[0].text).toContain('待機完了');
    });

    test('指定したキュー長まで待機すること', async () => {
      registerWaitForTaskCompletionTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 5,
        isProcessing: true,
        nextTaskId: 12345,
        currentTaskId: 12344,
      });
      vi.mocked(mockSayCoeiroink.waitForQueueLength).mockResolvedValue();

      const tool = registeredTools.get('wait_for_task_completion');
      const result = await tool.handler({ remainingQueueLength: 2, timeout: 10000 });

      expect(mockSayCoeiroink.waitForQueueLength).toHaveBeenCalledWith(2);
      expect(result.content[0].text).toContain('待機完了');
    });

    test('タイムアウト時のメッセージが表示されること', async () => {
      registerWaitForTaskCompletionTool(mockServer, mockSayCoeiroink);

      vi.mocked(mockSayCoeiroink.getSpeechQueueStatus).mockReturnValue({
        queueLength: 5,
        isProcessing: true,
        nextTaskId: 12345,
        currentTaskId: 12344,
      });
      vi.mocked(mockSayCoeiroink.waitForQueueLength).mockRejectedValue(new Error('Timeout'));

      const tool = registeredTools.get('wait_for_task_completion');
      const result = await tool.handler({ timeout: 5000 });

      expect(result.content[0].text).toContain('タイムアウト');
    });
  });
});
