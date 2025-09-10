/**
 * Request Tracker
 * JSON-RPC IDを使用したリクエスト/レスポンスの相関管理
 */

export interface PendingRequest {
  method: string;
  params?: unknown;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  timeout: NodeJS.Timeout;
  timestamp: Date;
}

export interface IRequestTracker {
  track(id: string | number, method: string, params?: unknown, timeout?: number): Promise<unknown>;
  resolve(id: string | number, result: unknown): void;
  reject(id: string | number, error: unknown): void;
  hasRequest(id: string | number): boolean;
  getPendingCount(): number;
  cleanup(): void;
}

export class RequestTracker implements IRequestTracker {
  private pendingRequests = new Map<string | number, PendingRequest>();
  private nextId = 1;

  constructor(private defaultTimeout: number = 10000) {}

  /**
   * 新しいリクエストIDを生成
   */
  generateId(): number {
    return this.nextId++;
  }

  /**
   * リクエストを追跡開始
   */
  track(id: string | number, method: string, params?: unknown, timeout?: number): Promise<unknown> {
    // 既存のIDが使用されている場合はエラー
    if (this.pendingRequests.has(id)) {
      throw new Error(`Request ID ${id} is already being tracked`);
    }

    const requestTimeout = timeout ?? this.defaultTimeout;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${id} (${method}) timed out after ${requestTimeout}ms`));
      }, requestTimeout);

      this.pendingRequests.set(id, {
        method,
        params,
        resolve,
        reject,
        timeout: timeoutHandle,
        timestamp: new Date(),
      });
    });
  }

  /**
   * リクエストを成功として解決
   */
  resolve(id: string | number, result: unknown): void {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(result);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * リクエストをエラーとして拒否
   */
  reject(id: string | number, error: unknown): void {
    const pending = this.pendingRequests.get(id);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(error);
      this.pendingRequests.delete(id);
    }
  }

  /**
   * 指定IDのリクエストが追跡中か確認
   */
  hasRequest(id: string | number): boolean {
    return this.pendingRequests.has(id);
  }

  /**
   * 保留中のリクエスト数を取得
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * デバッグ用：保留中のリクエスト情報を取得
   */
  getPendingRequests(): Array<{ id: string | number; method: string; elapsed: number }> {
    const now = new Date();
    return Array.from(this.pendingRequests.entries()).map(([id, request]) => ({
      id,
      method: request.method,
      elapsed: now.getTime() - request.timestamp.getTime(),
    }));
  }

  /**
   * すべての保留中のリクエストをクリーンアップ
   */
  cleanup(): void {
    // すべてのタイムアウトをクリア
    this.pendingRequests.forEach(request => {
      clearTimeout(request.timeout);
      request.reject(new Error('Request tracker is being cleaned up'));
    });

    this.pendingRequests.clear();
    this.nextId = 1;
  }
}
