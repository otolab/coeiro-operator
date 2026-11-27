declare module '@echogarden/rnnoise-wasm' {
  interface RNNoiseModule {
    HEAPF32: Float32Array;
    _free(pointer: number): void;
    _malloc(size: number): number;
    _rnnoise_create(model: number): number;
    _rnnoise_destroy(state: number): void;
    _rnnoise_get_frame_size(): number;
    _rnnoise_process_frame(state: number, output: number, input: number): number;
  }

  export default function loadRNNoiseModule(): Promise<RNNoiseModule>;
}
