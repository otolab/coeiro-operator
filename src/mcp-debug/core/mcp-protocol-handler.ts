/**
 * MCP Protocol Handler
 * MCPプロトコルの処理を担当
 */

import { IMCPStateManager, MCPServerState } from './state-manager.js';
import { IRequestTracker } from './request-tracker.js';

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPCapabilities {
  tools?: Record<string, any>;
  prompts?: Record<string, any>;
  resources?: Record<string, any>;
}

export interface IMCPProtocolHandler {
  initialize(capabilities: MCPCapabilities): Promise<any>;
  sendRequest(method: string, params?: any, timeout?: number): Promise<any>;
  sendNotification(method: string, params?: any): void;
  handleMessage(message: MCPMessage): void;
}

export class MCPProtocolHandler implements IMCPProtocolHandler {
  private outputHandler?: (data: string) => void;
  private serverCapabilities?: any;
  
  constructor(
    private stateManager: IMCPStateManager,
    private requestTracker: IRequestTracker
  ) {}

  /**
   * 出力ハンドラーを設定
   */
  setOutputHandler(handler: (data: string) => void): void {
    this.outputHandler = handler;
  }

  /**
   * MCPサーバーを初期化
   */
  async initialize(capabilities: MCPCapabilities): Promise<any> {
    // 状態を初期化中に遷移
    this.stateManager.transitionTo(MCPServerState.INITIALIZING);
    
    try {
      // initialize リクエストを送信
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities,
        clientInfo: {
          name: 'mcp-debug',
          version: '1.0.0'
        }
      });
      
      // サーバー機能を保存
      this.serverCapabilities = response.capabilities;
      
      // initialized 通知を送信
      this.sendNotification('initialized', {});
      
      // 状態をREADYに遷移
      this.stateManager.transitionTo(MCPServerState.READY);
      
      return response;
    } catch (error) {
      // エラー時は終了状態に遷移
      this.stateManager.transitionTo(MCPServerState.TERMINATED);
      throw error;
    }
  }

  /**
   * リクエストを送信
   */
  async sendRequest(method: string, params?: any, timeout?: number): Promise<any> {
    // ID生成はRequestTrackerに委譲すべきだが、簡単のため直接生成
    const id = Date.now() + Math.random();
    
    const message: MCPMessage = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    // リクエストを追跡開始
    const responsePromise = this.requestTracker.track(id, method, params, timeout);
    
    // メッセージを送信
    this.sendMessage(message);
    
    // tools/call の場合は処理中状態に遷移
    if (method === 'tools/call') {
      this.stateManager.transitionTo(MCPServerState.PROCESSING);
      
      // レスポンス後にREADY状態に戻す
      responsePromise.then(
        () => this.stateManager.transitionTo(MCPServerState.READY),
        () => this.stateManager.transitionTo(MCPServerState.READY)
      );
    }
    
    return responsePromise;
  }

  /**
   * 通知を送信（レスポンスを待たない）
   */
  sendNotification(method: string, params?: any): void {
    const message: MCPMessage = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    this.sendMessage(message);
  }

  /**
   * メッセージを処理
   */
  handleMessage(message: MCPMessage): void {
    // IDがある場合はレスポンス
    if ('id' in message && message.id !== undefined) {
      this.handleResponse(message);
    }
    // methodがある場合は通知またはリクエスト
    else if ('method' in message) {
      this.handleNotification(message);
    }
  }

  /**
   * レスポンスを処理
   */
  private handleResponse(message: MCPMessage): void {
    const id = message.id;
    if (id === undefined) return;
    
    // エラーレスポンスの場合
    if (message.error) {
      this.requestTracker.reject(id, new Error(
        `MCP Error ${message.error.code}: ${message.error.message}`
      ));
    }
    // 成功レスポンスの場合
    else if ('result' in message) {
      this.requestTracker.resolve(id, message.result);
    }
  }

  /**
   * 通知を処理
   */
  private handleNotification(message: MCPMessage): void {
    // 通知の処理（必要に応じて実装）
    // 例: progress通知、log通知など
    console.error(`[MCP Notification] ${message.method}:`, message.params);
  }

  /**
   * メッセージを送信
   */
  private sendMessage(message: MCPMessage): void {
    if (!this.outputHandler) {
      throw new Error('Output handler not set');
    }
    
    const jsonString = JSON.stringify(message);
    this.outputHandler(jsonString + '\n');
  }

  /**
   * サーバー機能を取得
   */
  getServerCapabilities(): any {
    return this.serverCapabilities;
  }

  /**
   * クリーンアップ
   */
  cleanup(): void {
    this.requestTracker.cleanup();
    this.serverCapabilities = undefined;
  }
}