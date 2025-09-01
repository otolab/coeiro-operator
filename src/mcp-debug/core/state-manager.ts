/**
 * MCP Server State Manager
 * MCPサーバーの状態管理を担当
 */

export enum MCPServerState {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  READY = 'ready',
  PROCESSING = 'processing',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated'
}

export interface IMCPStateManager {
  readonly currentState: MCPServerState;
  transitionTo(newState: MCPServerState): void;
  canAcceptRequest(): boolean;
  waitForState(state: MCPServerState, timeout?: number): Promise<void>;
  onStateChange(handler: (oldState: MCPServerState, newState: MCPServerState) => void): void;
}

export class MCPStateManager implements IMCPStateManager {
  private _currentState: MCPServerState = MCPServerState.UNINITIALIZED;
  private stateWaiters = new Map<MCPServerState, Set<(value: void) => void>>();
  private stateChangeHandlers = new Set<(oldState: MCPServerState, newState: MCPServerState) => void>();
  
  // 状態遷移の有効性を定義
  private readonly validTransitions: Record<MCPServerState, MCPServerState[]> = {
    [MCPServerState.UNINITIALIZED]: [MCPServerState.INITIALIZING, MCPServerState.SHUTTING_DOWN, MCPServerState.TERMINATED],
    [MCPServerState.INITIALIZING]: [MCPServerState.READY, MCPServerState.SHUTTING_DOWN, MCPServerState.TERMINATED],
    [MCPServerState.READY]: [MCPServerState.PROCESSING, MCPServerState.SHUTTING_DOWN, MCPServerState.TERMINATED],
    [MCPServerState.PROCESSING]: [MCPServerState.READY, MCPServerState.SHUTTING_DOWN, MCPServerState.TERMINATED],
    [MCPServerState.SHUTTING_DOWN]: [MCPServerState.TERMINATED],
    [MCPServerState.TERMINATED]: []
  };

  get currentState(): MCPServerState {
    return this._currentState;
  }

  transitionTo(newState: MCPServerState): void {
    const oldState = this._currentState;
    
    // 同じ状態への遷移は無視
    if (oldState === newState) {
      return;
    }

    // 有効な遷移かチェック
    if (!this.validTransitions[oldState].includes(newState)) {
      throw new Error(`Invalid state transition: ${oldState} -> ${newState}`);
    }

    // 状態を更新
    this._currentState = newState;
    
    // 状態変更ハンドラーを呼び出し
    this.stateChangeHandlers.forEach(handler => {
      try {
        handler(oldState, newState);
      } catch (error) {
        console.error('Error in state change handler:', error);
      }
    });
    
    // 待機中のPromiseを解決
    const waiters = this.stateWaiters.get(newState);
    if (waiters) {
      waiters.forEach(resolve => resolve());
      waiters.clear();
    }
  }

  canAcceptRequest(): boolean {
    return this._currentState === MCPServerState.READY;
  }

  async waitForState(state: MCPServerState, timeout?: number): Promise<void> {
    // すでに目的の状態の場合は即座に解決
    if (this._currentState === state) {
      return;
    }

    // 終了状態から他の状態への遷移は不可能
    if (this._currentState === MCPServerState.TERMINATED) {
      throw new Error('Server is terminated and cannot transition to other states');
    }

    return new Promise((resolve, reject) => {
      // 待機リストに追加
      if (!this.stateWaiters.has(state)) {
        this.stateWaiters.set(state, new Set());
      }
      const waiters = this.stateWaiters.get(state)!;
      waiters.add(resolve);

      // タイムアウト設定
      if (timeout) {
        const timeoutId = setTimeout(() => {
          waiters.delete(resolve);
          reject(new Error(`Timeout waiting for state ${state} after ${timeout}ms`));
        }, timeout);

        // 元のresolveをラップしてタイムアウトをクリア
        const originalResolve = resolve;
        const wrappedResolve = () => {
          clearTimeout(timeoutId);
          originalResolve();
        };
        waiters.delete(resolve);
        waiters.add(wrappedResolve);
      }
    });
  }

  onStateChange(handler: (oldState: MCPServerState, newState: MCPServerState) => void): void {
    this.stateChangeHandlers.add(handler);
  }

  removeStateChangeHandler(handler: (oldState: MCPServerState, newState: MCPServerState) => void): void {
    this.stateChangeHandlers.delete(handler);
  }

  reset(): void {
    // すべての待機中のPromiseを拒否
    this.stateWaiters.forEach((waiters) => {
      waiters.clear();
    });
    this.stateWaiters.clear();
    
    // 状態をリセット
    this._currentState = MCPServerState.UNINITIALIZED;
  }
}