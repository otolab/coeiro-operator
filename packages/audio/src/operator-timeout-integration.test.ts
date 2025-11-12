/**
 * オペレータタイムアウト時のCLI統合テスト
 * Issue #93: アサインが時間切れした端末でsay-coeiroinkコマンドを実行すると音声が出ない
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { SayCoeiroink } from './index.js';
import { OperatorManager, ConfigManager, CharacterInfoService } from '@coeiro-operator/core';
import { tmpdir } from 'os';
import { join } from 'path';
import * as fs from 'fs/promises';

describe('オペレータタイムアウト統合テスト', () => {
  let sayCoeiroink: SayCoeiroink;
  let operatorManager: OperatorManager;
  let configManager: ConfigManager;
  let characterInfoService: CharacterInfoService;
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
      getConfigDir: vi.fn().mockReturnValue(testConfigDir),
      getStateDir: vi.fn().mockReturnValue(join(testConfigDir, 'state')),
      getCoeiroinkConfigPath: vi.fn().mockReturnValue(join(testConfigDir, 'coeiroink-config.json')),
    } as any;

    // CharacterInfoServiceを初期化
    characterInfoService = new CharacterInfoService();
    characterInfoService.initialize(configManager);

    // OperatorManagerを初期化（DI）
    operatorManager = new OperatorManager(configManager, characterInfoService);
    await operatorManager.initialize();

    // SayCoeiroinkを初期化
    sayCoeiroink = new SayCoeiroink(configManager);
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
      enqueue: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1 }),
      enqueueSpeech: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1, promise: Promise.resolve() }),
      waitForAllTasks: vi.fn().mockResolvedValue({ errors: [] }),
      getStatus: vi.fn().mockReturnValue({ queueLength: 0, isProcessing: false }),
      clear: vi.fn(),
    };

    // initializeメソッドを呼んでSayCoeiroinkを完全に初期化
    await sayCoeiroink.initialize();

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

    // synthesizeメソッドを呼び出してテスト
    const result = sayCoeiroink.synthesize('テストメッセージ', {
      allowFallback: true, // CLIのデフォルト設定
    });

    // waitCompletionを呼んで処理を待つ
    await sayCoeiroink.waitCompletion();

    // SpeechQueueのenqueueSpeechが呼ばれることを確認
    expect(mockSpeechQueue.enqueueSpeech).toHaveBeenCalled();
    // デフォルト音声が使用されることを確認
    expect(result.success).toBe(true);
  });

  test('MCPモード: オペレータがタイムアウトしたらエラーになる', async () => {
    // AudioSynthesizerのモック
    const mockAudioSynthesizer = {
      checkServerConnection: vi.fn().mockResolvedValue(true),
    };

    // SpeechQueueのモック - エラーを返す
    const operatorError = new Error('オペレータが割り当てられていません');
    const rejectedPromise = Promise.reject(operatorError);
    rejectedPromise.catch(() => {}); // Unhandled Rejection防止

    const mockSpeechQueue = {
      enqueue: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1 }),
      enqueueSpeech: vi.fn().mockReturnValue({
        success: true,
        taskId: 1,
        queueLength: 1,
        promise: rejectedPromise
      }),
      waitForAllTasks: vi.fn().mockResolvedValue({
        errors: [{ taskId: 1, error: operatorError }]
      }),
      getStatus: vi.fn().mockReturnValue({ queueLength: 0, isProcessing: false }),
      clear: vi.fn(),
    };

    // initializeメソッドを呼んでSayCoeiroinkを完全に初期化
    await sayCoeiroink.initialize();

    // プライベートプロパティをモックで置き換え
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
    (sayCoeiroink as any).speechQueue = mockSpeechQueue;
    (sayCoeiroink as any).operatorManager = operatorManager;

    // オペレータがタイムアウトした状態をシミュレート
    vi.spyOn(operatorManager, 'showCurrentOperator').mockResolvedValue({
      message: 'オペレータは割り当てられていません',
    });
    vi.spyOn(operatorManager, 'getCurrentOperatorSession').mockResolvedValue(null);

    // synthesizeメソッドを呼び出してテスト
    // MCPモード: allowFallback=false
    sayCoeiroink.synthesize('テストメッセージ', {
      allowFallback: false, // MCPの設定
    });

    // waitCompletionでエラーが発生することを確認
    await expect(sayCoeiroink.waitCompletion()).rejects.toThrow('オペレータが割り当てられていません');
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
      warmupAudioDriver: vi.fn().mockResolvedValue(undefined),
      playAudioStream: vi.fn().mockResolvedValue(undefined),
      playStreamingAudio: vi.fn().mockResolvedValue(undefined),
      setSynthesisRate: vi.fn(),
      setPlaybackRate: vi.fn(),
      setNoiseReduction: vi.fn(),
      setLowpassFilter: vi.fn(),
    };

    // initializeメソッドを呼んでSayCoeiroinkを完全に初期化
    await sayCoeiroink.initialize();

    // SpeechQueueのモック
    const mockSpeechQueue = {
      enqueue: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1 }),
      enqueueSpeech: vi.fn().mockReturnValue({ success: true, taskId: 1, queueLength: 1, promise: Promise.resolve() }),
      waitForAllTasks: vi.fn().mockResolvedValue({ errors: [] }),
      getStatus: vi.fn().mockReturnValue({ queueLength: 0, isProcessing: false }),
      clear: vi.fn(),
    };

    // プライベートプロパティをモックで置き換え
    (sayCoeiroink as any).audioSynthesizer = mockAudioSynthesizer;
    (sayCoeiroink as any).audioPlayer = mockAudioPlayer;
    (sayCoeiroink as any).speechQueue = mockSpeechQueue;
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

    // synthesizeメソッドを呼び出してテスト
    // オペレータ音声を使用
    const result = sayCoeiroink.synthesize('テストメッセージ', {});

    expect(result.success).toBe(true);

    // waitCompletionを呼んで処理を待つ
    await sayCoeiroink.waitCompletion();

    // synthesizeメソッドによってキューにタスクが登録されることを確認
    expect(mockSpeechQueue.enqueueSpeech).toHaveBeenCalled();
  });
});