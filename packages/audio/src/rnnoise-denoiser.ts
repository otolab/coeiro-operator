import loadRNNoiseModule from '@echogarden/rnnoise-wasm';

const RNNOISE_SAMPLE_RATE = 48_000;
const RNNOISE_FRAME_SIZE = 480;
const BYTES_PER_SAMPLE = 2;

interface RNNoiseModule {
  HEAPF32: Float32Array;
  _free(pointer: number): void;
  _malloc(size: number): number;
  _rnnoise_create(model: number): number;
  _rnnoise_destroy(state: number): void;
  _rnnoise_get_frame_size(): number;
  _rnnoise_process_frame(state: number, output: number, input: number): number;
}

let rnnoiseModulePromise: Promise<RNNoiseModule> | null = null;

function loadModule(): Promise<RNNoiseModule> {
  if (!rnnoiseModulePromise) {
    rnnoiseModulePromise = loadRNNoiseModule().catch(error => {
      rnnoiseModulePromise = null;
      throw error;
    });
  }

  return rnnoiseModulePromise;
}

function resample(input: Float32Array, outputLength: number): Float32Array {
  if (outputLength === input.length) return input;
  if (outputLength <= 0 || input.length === 0) return new Float32Array(0);

  const output = new Float32Array(outputLength);
  if (input.length === 1 || outputLength === 1) {
    output.fill(input[0]);
    return output;
  }

  const scale = (input.length - 1) / (outputLength - 1);
  for (let i = 0; i < outputLength; i++) {
    const sourcePosition = i * scale;
    const leftIndex = Math.floor(sourcePosition);
    const fraction = sourcePosition - leftIndex;
    const left = input[leftIndex];
    const right = input[Math.min(leftIndex + 1, input.length - 1)];
    output[i] = left + (right - left) * fraction;
  }

  return output;
}

export class RNNoiseDenoiser {
  private disposed = false;

  private constructor(
    private readonly module: RNNoiseModule,
    private readonly channelCount: number
  ) {}

  static async create(channelCount: number): Promise<RNNoiseDenoiser> {
    if (!Number.isInteger(channelCount) || channelCount < 1) {
      throw new RangeError(`Invalid channel count: ${channelCount}`);
    }

    const module = await loadModule();
    const frameSize = module._rnnoise_get_frame_size();
    if (frameSize !== RNNOISE_FRAME_SIZE) {
      throw new Error(`Unsupported RNNoise frame size: ${frameSize}`);
    }

    return new RNNoiseDenoiser(module, channelCount);
  }

  process(pcmData: Uint8Array, sampleRate: number, channelCount: number): Uint8Array {
    if (this.disposed) throw new Error('RNNoise denoiser has been disposed');
    if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
      throw new RangeError(`Invalid sample rate: ${sampleRate}`);
    }
    if (channelCount !== this.channelCount) {
      throw new RangeError(`Expected ${this.channelCount} channels, received ${channelCount}`);
    }
    if (pcmData.byteLength % (BYTES_PER_SAMPLE * channelCount) !== 0) {
      throw new RangeError('PCM data does not contain complete interleaved samples');
    }
    if (pcmData.byteLength === 0) return new Uint8Array(0);

    const sourceFrameCount = pcmData.byteLength / (BYTES_PER_SAMPLE * channelCount);
    const pcmView = new DataView(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
    const sourceChannels = Array.from(
      { length: channelCount },
      () => new Float32Array(sourceFrameCount)
    );

    for (let frame = 0; frame < sourceFrameCount; frame++) {
      for (let channel = 0; channel < channelCount; channel++) {
        const sampleOffset = (frame * channelCount + channel) * BYTES_PER_SAMPLE;
        sourceChannels[channel][frame] = pcmView.getInt16(sampleOffset, true);
      }
    }

    const rnnoiseFrameCount =
      sampleRate === RNNOISE_SAMPLE_RATE
        ? sourceFrameCount
        : Math.max(1, Math.round((sourceFrameCount * RNNOISE_SAMPLE_RATE) / sampleRate));
    const rnnoiseChannels = sourceChannels.map(channel => resample(channel, rnnoiseFrameCount));
    const states: number[] = [];
    const inputBuffers: number[] = [];
    const outputBuffers: number[] = [];
    const frameBytes = RNNOISE_FRAME_SIZE * Float32Array.BYTES_PER_ELEMENT;
    let denoisedChannels: Float32Array[];

    try {
      for (let channel = 0; channel < channelCount; channel++) {
        const state = this.module._rnnoise_create(0);
        if (!state) throw new Error('Failed to create RNNoise state');
        states.push(state);

        const inputBuffer = this.module._malloc(frameBytes);
        if (!inputBuffer) throw new Error('Failed to allocate RNNoise input buffer');
        inputBuffers.push(inputBuffer);

        const outputBuffer = this.module._malloc(frameBytes);
        if (!outputBuffer) throw new Error('Failed to allocate RNNoise output buffer');
        outputBuffers.push(outputBuffer);
      }

      denoisedChannels = rnnoiseChannels.map((channel, channelIndex) =>
        this.processChannel(
          channel,
          states[channelIndex],
          inputBuffers[channelIndex],
          outputBuffers[channelIndex]
        )
      );
    } finally {
      for (const state of states) this.module._rnnoise_destroy(state);
      for (const pointer of inputBuffers) this.module._free(pointer);
      for (const pointer of outputBuffers) this.module._free(pointer);
    }

    const outputChannels = denoisedChannels.map(channel =>
      sampleRate === RNNOISE_SAMPLE_RATE ? channel : resample(channel, sourceFrameCount)
    );

    const output = new Uint8Array(pcmData.byteLength);
    const outputView = new DataView(output.buffer);
    for (let frame = 0; frame < sourceFrameCount; frame++) {
      for (let channel = 0; channel < channelCount; channel++) {
        const intSample = Math.round(
          Math.max(-32_768, Math.min(32_767, outputChannels[channel][frame]))
        );
        outputView.setInt16((frame * channelCount + channel) * BYTES_PER_SAMPLE, intSample, true);
      }
    }

    return output;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
  }

  private processChannel(
    input: Float32Array,
    state: number,
    inputPointer: number,
    outputPointer: number
  ): Float32Array {
    const frameCount = Math.ceil(input.length / RNNOISE_FRAME_SIZE);
    const frameOutput = new Float32Array((frameCount + 1) * RNNOISE_FRAME_SIZE);
    const frame = new Float32Array(RNNOISE_FRAME_SIZE);
    const heapOffset = outputPointer / Float32Array.BYTES_PER_ELEMENT;
    let outputOffset = 0;

    for (let offset = 0; offset < input.length; offset += RNNOISE_FRAME_SIZE) {
      frame.fill(0);
      frame.set(input.subarray(offset, offset + RNNOISE_FRAME_SIZE));

      const inputHeap = this.module.HEAPF32;
      inputHeap.set(frame, inputPointer / Float32Array.BYTES_PER_ELEMENT);
      this.module._rnnoise_process_frame(state, outputPointer, inputPointer);

      const outputHeap = this.module.HEAPF32;
      frameOutput.set(
        outputHeap.subarray(heapOffset, heapOffset + RNNOISE_FRAME_SIZE),
        outputOffset
      );
      outputOffset += RNNOISE_FRAME_SIZE;
    }

    frame.fill(0);
    this.module.HEAPF32.set(frame, inputPointer / Float32Array.BYTES_PER_ELEMENT);
    this.module._rnnoise_process_frame(state, outputPointer, inputPointer);
    frameOutput.set(
      this.module.HEAPF32.subarray(heapOffset, heapOffset + RNNOISE_FRAME_SIZE),
      outputOffset
    );

    // RNNoise's analysis path delays output by 479 samples. Discard that startup
    // delay and append one silent frame so the returned PCM stays aligned and full length.
    return frameOutput.slice(RNNOISE_FRAME_SIZE - 1, RNNOISE_FRAME_SIZE - 1 + input.length);
  }
}
