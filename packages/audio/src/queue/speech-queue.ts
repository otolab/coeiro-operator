/**
 * src/queue/speech-queue.ts: 音声合成タスクキュー
 * TaskQueueのSpeechTask特化版
 */

import { TaskQueue } from './task-queue.js';
import type { BaseTask } from './types.js';
import type { SynthesizeOptions, SynthesizeResult } from '../types.js';

/**
 * 音声合成タスク
 */
export interface SpeechTask extends BaseTask {
  type: 'speech';
  text: string;
  options: SynthesizeOptions;
}

/**
 * 音声合成タスクキュー
 * TaskQueueをSpeechTaskに特化
 */
export class SpeechQueue extends TaskQueue<SpeechTask> {
  /**
   * 音声タスクをキューに追加（音声合成用のラッパー）
   * @param text 音声合成するテキスト
   * @param options 音声合成オプション
   * @returns 音声合成結果
   */
  enqueueSpeech(text: string, options: SynthesizeOptions = {}): SynthesizeResult {
    const result = super.enqueue({
      type: 'speech',
      text,
      options,
    });

    return {
      ...result,
      outputFile: options.outputFile || undefined,
    };
  }

  /**
   * 基底クラスのenqueueメソッドを隠蔽し、enqueueSpeechを使用するよう促す
   * @deprecated Use enqueueSpeech instead
   */
  enqueue(taskData: Omit<SpeechTask, 'id' | 'promise' | 'resolve' | 'reject' | 'timestamp'>) {
    return super.enqueue(taskData);
  }
}