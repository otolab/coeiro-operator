import { afterEach, describe, expect, test } from 'vitest';
import { RNNoiseDenoiser } from './rnnoise-denoiser.js';

const SAMPLE_RATE = 48_000;

function createPcm(frameCount: number, channelCount = 1): Uint8Array {
  const pcm = new Uint8Array(frameCount * channelCount * 2);
  const view = new DataView(pcm.buffer);

  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const frequency = channel === 0 ? 220 : 440;
      const sample = Math.round(Math.sin((2 * Math.PI * frequency * frame) / SAMPLE_RATE) * 8_000);
      view.setInt16((frame * channelCount + channel) * 2, sample, true);
    }
  }

  return pcm;
}

describe('RNNoiseDenoiser', () => {
  let denoisers: RNNoiseDenoiser[] = [];

  afterEach(() => {
    for (const denoiser of denoisers) denoiser.dispose();
    denoisers = [];
  });

  async function createDenoiser(channelCount = 1): Promise<RNNoiseDenoiser> {
    const denoiser = await RNNoiseDenoiser.create(channelCount);
    denoisers.push(denoiser);
    return denoiser;
  }

  test('NodeでWASMを初期化し、480サンプルのフレームを処理する', async () => {
    const denoiser = await createDenoiser();
    const input = createPcm(480);

    const output = denoiser.process(input, SAMPLE_RATE, 1);

    expect(output).toHaveLength(input.length);
    expect(output).not.toEqual(input);
    expect(new DataView(output.buffer).getInt16(0, true)).toBeTypeOf('number');
  });

  test('480サンプル単位に満たない末尾をゼロ埋めし、入力と同じ長さに戻す', async () => {
    const denoiser = await createDenoiser();
    const input = createPcm(481);

    const output = denoiser.process(input, SAMPLE_RATE, 1);

    expect(output).toHaveLength(input.length);
    expect(output).not.toEqual(input);
  });

  test.each([24_000, 44_100, 48_000, 96_000])(
    'playbackRate %dHzでも処理後のサンプル数を維持する',
    async sampleRate => {
      const denoiser = await createDenoiser();
      const frameCount = Math.max(1, Math.round(sampleRate / 100));
      const input = createPcm(frameCount);

      const output = denoiser.process(input, sampleRate, 1);

      expect(output).toHaveLength(input.length);
    }
  );

  test('ステレオ入力をチャンネルごとに処理し、インターリーブ長を保つ', async () => {
    const denoiser = await createDenoiser(2);
    const input = createPcm(481, 2);

    const output = denoiser.process(input, SAMPLE_RATE, 2);

    expect(output).toHaveLength(input.length);
    expect(output).not.toEqual(input);
  });

  test('不正なサンプルレートと不完全なチャンネルフレームを拒否する', async () => {
    const denoiser = await createDenoiser(2);

    expect(() => denoiser.process(createPcm(480), 0, 2)).toThrow('Invalid sample rate');
    expect(() => denoiser.process(new Uint8Array(6), SAMPLE_RATE, 2)).toThrow(
      'complete interleaved samples'
    );
  });

  test('破棄後に処理を拒否し、複数回の破棄は安全に扱う', async () => {
    const denoiser = await createDenoiser();
    denoiser.dispose();

    expect(() => denoiser.process(createPcm(480), SAMPLE_RATE, 1)).toThrow('has been disposed');
    expect(() => denoiser.dispose()).not.toThrow();
  });
});
