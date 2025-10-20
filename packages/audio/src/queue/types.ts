/**
 * src/queue/types.ts: タスクキューの型定義
 */

/**
 * タスクの基本インターフェース
 */
export interface BaseTask {
  id: number;
  type: string;
  timestamp: number;
  // OpenPromiseパターン用
  promise?: Promise<void>;
  resolve?: () => void;
  reject?: (error: Error) => void;
  // 中断制御用
  abort?: () => void | Promise<void>;
  aborted?: boolean;
}

/**
 * エンキュー結果の基本インターフェース
 */
export interface EnqueueResult {
  success: boolean;
  taskId: number;
  promise?: Promise<void>;
  queueLength: number;
}

/**
 * キューステータス
 */
export interface QueueStatus {
  queueLength: number;
  isProcessing: boolean;
  nextTaskId: number | null;
  currentTaskId: number | null;
}

/**
 * クリア結果
 */
export interface ClearResult {
  removedCount: number;
  aborted: boolean;
}