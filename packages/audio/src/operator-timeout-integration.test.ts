/**
 * オペレータタイムアウト時のCLI統合テスト
 * Issue #93: アサインが時間切れした端末でsay-coeiroinkコマンドを実行すると音声が出ない
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { OperatorManager, ConfigManager } from '@coeiro-operator/core';
import { tmpdir } from 'os';
import { join } from 'path';
import * as fs from 'fs/promises';

describe('オペレータタイムアウト統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let operatorManager: OperatorManager;
  let configManager: ConfigManager;
  let testConfigDir: string;

  beforeEach(async () => {
    // テスト用の設定ディレクトリ
    testConfigDir = join(tmpdir(), `test-config-${Date.now()}`);
    await fs.mkdir(testConfigDir, { recursive: true });

    // ConfigManagerのモック
    configManager = {
      getFullConfig: vi.fn().mockResolvedValue({
        connection: { host: 'localhost', port: '50032' },
        operator: { rate: 200 },
        audio: {
          latencyMode: 'balanced',
          splitMode: 'punctuation',
          bufferSize: 2048,
        },
      }),
      buildDynamicConfig: vi.fn().mockResolvedValue(undefined),
      getCharacterConfig: vi.fn().mockImplementation((characterId) => {
        if (characterId === 'tsukuyomi') {
          return Promise.resolve({
            speakerId: 'tsukuyomi-speaker-id',
            defaultStyle: 'れいせい',
          });
        }
        return Promise.resolve(null);
      }),
    } as any;

    // OperatorManagerを初期化
    operatorManager = new OperatorManager();
    await operatorManager.initialize();

    // SayCoeiroinkを初期化
    sayCoeiroink = new SayCoeiroink(configManager);
    // configプロパティを設定
    (sayCoeiroink as any).config = await configManager.getFullConfig();
  });

  afterEach(async () => {
    // テストディレクトリのクリーンアップ
    try {
      await fs.rm(testConfigDir, { recursive: true, force: true });
    } catch {
      // エラーは無視
    }
  });

  test('CLIモード: オペレータがタイムアウトしてもデフォルト音声で再生される', async () => {
    // AudioSynthesizerのモック
    const mockAudioSynthesizer = {
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'tsukuyomi-speaker-id',
          speakerName: 'つくよみちゃん',
          styles: [
            { styleId: 0, styleName: 'れいせい' },
            { styleId: 1, styleName: 'おちつき' },
          ],
        },
      ]),
      synthesizeWithSpeaker: vi.fn().mockResolvedValue({
        success: true,
        audio: new ArrayBuffer(1024),
      }),
      synthesizeStream: vi.fn().mockImplementation(async function* () {
        yield { audio: new ArrayBuffer(512), isFirst: true, isLast: false };
        yield { audio: new ArrayBuffer(512), isFirst: false, isLast: true };
      }),
      checkServerConnection: vi.fn().mockResolvedValue(true),
      convertRateToSpeed: vi.fn().mockReturnValue(1.0),
    };

    // AudioPlayerのモック
    const mockAudioPlayer = {
      initialize: vi.fn().mockResolvedValue(true),
      warmupAudioDriver: vi.fn().mockResolvedValue(undefined),
      playAudioStream: vi.fn().mockResolvedValue(undefined),
      playStreamingAudio: vi.fn().mockResolvedValue(undefined),
      setSynthesisRate: vi.fn(),
      setPlaybackRate: vi.fn(),
      setNoiseReduction: vi.fn(),
      setLowpassFilter: vi.fn(),
    };

    // SpeechQueueのモック
    const mockSpeechQueue = {
      enqueue: vi.fn().mockResolvedValue({ success: true, taskId: 1, queueLength: 1 }),
      enqueueAndWait: vi.fn().mockResolvedValue({ success: true, mode: 'normal' }),
      enqueueWarmup: vi.fn().mockResolvedValue({ success: true }),
      enqueueWarmupAndWait: vi.fn().mockResolvedValue({ success: true }),
      enqueueCompletionWaitAndWait: vi.fn().mockResolvedValue({ success: true }),
      getStatus: vi.fn().mockReturnValue({ queueLength: 0, isProcessing: false }),
      clear: vi.fn(),
    };

    // プライベートプロパティをモックで置き換え
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
    (sayCoeiroink as any).audioPlayer = mockAudioPlayer;
    (sayCoeiroink as any).speechQueue = mockSpeechQueue;
    (sayCoeiroink as any).operatorManager = operatorManager;

    // オペレータがタイムアウトした状態をシミュレート
    // （getCurrentOperatorSessionがnullを返すようにモック）
    vi.spyOn(operatorManager, 'showCurrentOperator').mockResolvedValue({
      message: 'オペレータは割り当てられていません',
    });
    vi.spyOn(operatorManager, 'getCurrentOperatorSession').mockResolvedValue(null);

    // synthesizeTextInternalを直接呼び出してテスト
    const synthesizeInternal = (sayCoeiroink as any).synthesizeTextInternal.bind(sayCoeiroink);

    // CLIモード: allowFallback=true（デフォルト）
    const result = await synthesizeInternal('テストメッセージ', {
      allowFallback: true, // CLIのデフォルト設定
    });

    // デフォルト音声が使用されることを確認
    expect(result.success).toBe(true);
    // ストリーミングモードではsynthesizeStreamが使われる
    expect(mockAudioSynthesizer.synthesizeStream).toHaveBeenCalled();
  });

  test('MCPモード: オペレータがタイムアウトしたらエラーになる', async () => {
    // AudioSynthesizerのモック
    const mockAudioSynthesizer = {
      checkServerConnection: vi.fn().mockResolvedValue(true),
    };

    // プライベートプロパティをモックで置き換え
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
    (sayCoeiroink as any).operatorManager = operatorManager;

    // オペレータがタイムアウトした状態をシミュレート
    vi.spyOn(operatorManager, 'showCurrentOperator').mockResolvedValue({
      message: 'オペレータは割り当てられていません',
    });
    vi.spyOn(operatorManager, 'getCurrentOperatorSession').mockResolvedValue(null);

    // synthesizeTextInternalを直接呼び出してテスト
    const synthesizeInternal = (sayCoeiroink as any).synthesizeTextInternal.bind(sayCoeiroink);

    // MCPモード: allowFallback=false
    await expect(
      synthesizeInternal('テストメッセージ', {
        allowFallback: false, // MCPの設定
      })
    ).rejects.toThrow('オペレータが割り当てられていません。まず operator_assign を実行してください。');
  });

  test('オペレータが有効な場合は正常に音声合成される', async () => {
    // AudioSynthesizerのモック
    const mockAudioSynthesizer = {
      getSpeakers: vi.fn().mockResolvedValue([
        {
          speakerUuid: 'dia-speaker-id',
          speakerName: 'ディアちゃん',
          styles: [
            { styleId: 3, styleName: 'のーまる' },
            { styleId: 130, styleName: 'セクシー' },
          ],
        },
      ]),
      synthesizeWithSpeaker: vi.fn().mockResolvedValue({
        success: true,
        audio: new ArrayBuffer(1024),
      }),
      synthesizeStream: vi.fn().mockImplementation(async function* () {
        yield { audio: new ArrayBuffer(512), isFirst: true, isLast: false };
        yield { audio: new ArrayBuffer(512), isFirst: false, isLast: true };
      }),
      checkServerConnection: vi.fn().mockResolvedValue(true),
      convertRateToSpeed: vi.fn().mockReturnValue(1.0),
    };

    // AudioPlayerのモック
    const mockAudioPlayer = {
      initialize: vi.fn().mockResolvedValue(true),
      playAudioStream: vi.fn().mockResolvedValue(undefined),
      playStreamingAudio: vi.fn().mockResolvedValue(undefined),
      setSynthesisRate: vi.fn(),
      setPlaybackRate: vi.fn(),
      setNoiseReduction: vi.fn(),
      setLowpassFilter: vi.fn(),
    };

    // プライベートプロパティをモックで置き換え
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
    (sayCoeiroink as any).audioPlayer = mockAudioPlayer;
    (sayCoeiroink as any).operatorManager = operatorManager;

    // オペレータが有効な状態をシミュレート
    vi.spyOn(operatorManager, 'showCurrentOperator').mockResolvedValue({
      characterId: 'dia',
      characterName: 'ディアちゃん',
      currentStyle: {
        styleId: '3',
        styleName: 'のーまる',
        personality: '優しく思いやりがある',
        speakingStyle: '丁寧で温かみのある口調',
      },
      message: '現在のオペレータ: ディアちゃん',
    });

    vi.spyOn(operatorManager, 'getCurrentOperatorSession').mockResolvedValue({
      characterId: 'dia',
      styleId: 3,
      styleName: 'のーまる',
    });

    vi.spyOn(operatorManager, 'getCharacterInfo').mockResolvedValue({
      characterId: 'dia',
      speaker: {
        speakerId: 'dia-speaker-id',
        speakerName: 'ディアちゃん',
        styles: [
          { styleId: 3, styleName: 'のーまる' },
          { styleId: 130, styleName: 'セクシー' },
        ],
      },
      personality: '優しく思いやりがある',
      speakingStyle: '丁寧で温かみのある口調',
    } as any);

    vi.spyOn(operatorManager, 'selectStyle').mockReturnValue({
      styleId: 3,
      styleName: 'のーまる',
    });

    // synthesizeTextInternalを直接呼び出してテスト
    const synthesizeInternal = (sayCoeiroink as any).synthesizeTextInternal.bind(sayCoeiroink);

    // オペレータ音声を使用
    const result = await synthesizeInternal('テストメッセージ', {});

    expect(result.success).toBe(true);
    // ストリーミングモードではsynthesizeStreamが使われる
    expect(mockAudioSynthesizer.synthesizeStream).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        speaker: expect.objectContaining({
          speakerId: 'dia-speaker-id',
        }),
        selectedStyleId: 3,
      }),
      expect.any(Number),
      expect.any(String)
    );
  });
});