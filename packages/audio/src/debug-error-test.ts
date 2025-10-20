/**
 * エラー伝播のデバッグテスト
 */

import { SayCoeiroink } from './index.js';
import { createMockConfigManager } from './test-helpers.js';
import type { Config } from './types.js';

async function runTest() {
  console.log('=== エラー伝播デバッグテスト開始 ===');

  const config: Config = {
    connection: {
      host: 'localhost',
      port: '50031',
    },
    operator: {
      rate: 200,
      timeout: 14400000,
      assignmentStrategy: 'random',
    },
    audio: {
      latencyMode: 'balanced',
      splitMode: 'punctuation',
      bufferSize: 256,
      parallelGeneration: {
        maxConcurrency: 2,
        delayBetweenRequests: 50,
        bufferAheadCount: 1,
        pauseUntilFirstComplete: true,
      },
    },
    characters: {},
  };

  const configManager = createMockConfigManager(config);
  const sayCoeiroink = new SayCoeiroink(configManager);

  // モック設定
  let requestCount = 0;
  (global as any).fetch = (url: string) => {
    console.log(`[Fetch Mock] URL: ${url}`);

    if (url.includes('/v1/speakers')) {
      return Promise.resolve({
        ok: true,
        json: async () => [
          {
            speakerUuid: 'test-speaker-1',
            speakerName: 'テスト',
            styles: [{ styleId: 0, styleName: 'ノーマル' }],
          },
        ],
      });
    }

    if (url.includes('/v1/synthesis')) {
      requestCount++;
      console.log(`[Fetch Mock] synthesis API call #${requestCount}`);

      if (requestCount === 2) {
        console.log(`[Fetch Mock] Returning 500 error for request #${requestCount}`);
        return Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });
      }

      console.log(`[Fetch Mock] Returning success for request #${requestCount}`);
      const buffer = new ArrayBuffer(44 + 100);
      return Promise.resolve({
        ok: true,
        arrayBuffer: async () => buffer,
      });
    }

    return Promise.reject(new Error('Unknown endpoint'));
  };

  // テスト実行
  await sayCoeiroink.initialize();
  console.log('初期化完了');

  const result = sayCoeiroink.synthesize('エラーテスト1。エラーテスト2。エラーテスト3。', {
    voice: 'test-speaker-1',
  });
  console.log('synthesize結果:', result);

  // 少し待つ
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log('100ms待機完了');

  try {
    console.log('waitCompletion呼び出し...');
    const waitResult = await sayCoeiroink.waitCompletion();
    console.log('waitCompletion正常終了:', waitResult);
    console.log('エラーが投げられませんでした！');
  } catch (error) {
    console.log('waitCompletionでエラーキャッチ:', error);
  }

  console.log('=== テスト終了 ===');
}

// メイン実行
runTest().catch(console.error);