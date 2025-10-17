/**
 * OpenPromise: 外部から解決・拒否できるPromise
 * @echogarden/audio-ioの内部実装パターンを参考
 */
export class OpenPromise<T = void> {
  public readonly promise: Promise<T>;
  private _resolve!: (value: T | PromiseLike<T>) => void;
  private _reject!: (reason?: any) => void;
  private _resolved = false;
  private _rejected = false;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  resolve(value?: T | PromiseLike<T>): void {
    if (this._resolved || this._rejected) {
      return;
    }
    this._resolved = true;
    // void型の場合はundefinedを渡す
    this._resolve(value as T | PromiseLike<T>);
  }

  reject(reason?: any): void {
    if (this._resolved || this._rejected) {
      return;
    }
    this._rejected = true;
    this._reject(reason);
  }

  get isResolved(): boolean {
    return this._resolved;
  }

  get isRejected(): boolean {
    return this._rejected;
  }

  get isPending(): boolean {
    return !this._resolved && !this._rejected;
  }
}