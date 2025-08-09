/**
 * Output Manager Implementation
 * 出力管理システムの実装
 */

import { 
  OutputChannel, 
  OutputMessage, 
  OutputType,
  StdoutChannel,
  StderrChannel,
  ControlChannel,
  DebugChannel,
  BufferedChannel,
  FilteredChannel,
  MultiChannel
} from './channels';

export interface OutputConfig {
  enableDebugOutput: boolean;
  bufferSize: number;
  flushInterval: number;
  enableMcpOutput: boolean;
  enableControlOutput: boolean;
  filters: {
    [type in OutputType]?: (message: OutputMessage) => boolean;
  };
}

export class OutputManager {
  private channels: Map<string, OutputChannel> = new Map();
  private config: OutputConfig;
  private stats: {
    totalMessages: number;
    messagesByType: Record<OutputType, number>;
    errors: number;
  };

  constructor(config: Partial<OutputConfig> = {}) {
    this.config = {
      enableDebugOutput: false,
      bufferSize: 100,
      flushInterval: 1000,
      enableMcpOutput: true,
      enableControlOutput: true,
      filters: {},
      ...config
    };

    this.stats = {
      totalMessages: 0,
      messagesByType: {
        mcp: 0,
        control: 0,
        debug: 0,
        error: 0
      },
      errors: 0
    };

    this.initializeChannels();
  }

  private initializeChannels(): void {
    // 基本チャネルの設定
    const stdoutChannel = new StdoutChannel();
    const stderrChannel = new StderrChannel();
    const controlChannel = new ControlChannel();
    const debugChannel = new DebugChannel();

    // 設定に基づく有効/無効の制御
    stdoutChannel.enabled = this.config.enableMcpOutput;
    controlChannel.enabled = this.config.enableControlOutput;
    debugChannel.enabled = this.config.enableDebugOutput;

    // フィルタ付きチャネルの作成
    if (this.config.filters.mcp) {
      const filteredStdout = new FilteredChannel(stdoutChannel, this.config.filters.mcp);
      this.channels.set('stdout', filteredStdout);
    } else {
      this.channels.set('stdout', stdoutChannel);
    }

    if (this.config.filters.error) {
      const filteredStderr = new FilteredChannel(stderrChannel, this.config.filters.error);
      this.channels.set('stderr', filteredStderr);
    } else {
      this.channels.set('stderr', stderrChannel);
    }

    if (this.config.filters.control) {
      const filteredControl = new FilteredChannel(controlChannel, this.config.filters.control);
      this.channels.set('control', filteredControl);
    } else {
      this.channels.set('control', controlChannel);
    }

    if (this.config.filters.debug) {
      const filteredDebug = new FilteredChannel(debugChannel, this.config.filters.debug);
      this.channels.set('debug', filteredDebug);
    } else {
      this.channels.set('debug', debugChannel);
    }

    // バッファ付きチャネルの作成（高頻度出力用）
    if (this.config.bufferSize > 1) {
      const bufferedDebug = new BufferedChannel(
        this.channels.get('debug')!,
        this.config.bufferSize,
        this.config.flushInterval
      );
      this.channels.set('debug-buffered', bufferedDebug);
    }
  }

  /**
   * メッセージを適切なチャネルに出力
   */
  write(type: OutputType, content: string, source?: string, metadata?: Record<string, any>): void {
    const message: OutputMessage = {
      type,
      content,
      timestamp: new Date().toISOString(),
      source,
      metadata
    };

    try {
      this.writeMessage(message);
      this.updateStats(message);
    } catch (error) {
      this.stats.errors++;
      // エラー処理 - 標準エラーに直接出力
      console.error(`OutputManager error: ${error}`, { message });
    }
  }

  private writeMessage(message: OutputMessage): void {
    switch (message.type) {
      case 'mcp':
        const mcpChannel = this.channels.get('stdout');
        if (mcpChannel) {
          mcpChannel.write(message);
        }
        break;

      case 'control':
        const controlChannel = this.channels.get('control');
        if (controlChannel) {
          controlChannel.write(message);
        }
        break;

      case 'debug':
        // バッファ付きチャネルがあればそちらを優先
        const debugChannel = this.channels.get('debug-buffered') || this.channels.get('debug');
        if (debugChannel) {
          debugChannel.write(message);
        }
        break;

      case 'error':
        const errorChannel = this.channels.get('stderr');
        if (errorChannel) {
          errorChannel.write(message);
        }
        break;
    }
  }

  private updateStats(message: OutputMessage): void {
    this.stats.totalMessages++;
    this.stats.messagesByType[message.type]++;
  }

  /**
   * MCP レスポンスの出力
   */
  writeMcpResponse(jsonRpcResponse: string): void {
    this.write('mcp', jsonRpcResponse + '\n', 'mcp-server');
  }

  /**
   * 制御レスポンスの出力
   */
  writeControlResponse(response: string): void {
    this.write('control', response, 'control-handler');
  }

  /**
   * デバッグ出力
   */
  writeDebug(message: string, source?: string): void {
    if (this.config.enableDebugOutput) {
      this.write('debug', message, source || 'debug');
    }
  }

  /**
   * エラー出力
   */
  writeError(message: string, source?: string): void {
    this.write('error', message, source || 'error');
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<OutputConfig>): void {
    this.config = { ...this.config, ...config };
    
    // チャネルの再初期化
    this.shutdown();
    this.channels.clear();
    this.initializeChannels();
  }

  /**
   * デバッグ出力の有効/無効
   */
  enableDebugOutput(): void {
    this.config.enableDebugOutput = true;
    const debugChannel = this.channels.get('debug');
    if (debugChannel instanceof DebugChannel) {
      debugChannel.enable();
    }
  }

  disableDebugOutput(): void {
    this.config.enableDebugOutput = false;
    const debugChannel = this.channels.get('debug');
    if (debugChannel instanceof DebugChannel) {
      debugChannel.disable();
    }
  }

  /**
   * MCP出力の有効/無効
   */
  enableMcpOutput(): void {
    this.config.enableMcpOutput = true;
    const mcpChannel = this.channels.get('stdout');
    if (mcpChannel) {
      mcpChannel.enabled = true;
    }
  }

  disableMcpOutput(): void {
    this.config.enableMcpOutput = false;
    const mcpChannel = this.channels.get('stdout');
    if (mcpChannel) {
      mcpChannel.enabled = false;
    }
  }

  /**
   * すべてのチャネルをフラッシュ
   */
  flush(): void {
    for (const channel of this.channels.values()) {
      if (channel.flush) {
        channel.flush();
      }
    }
  }

  /**
   * 統計情報の取得
   */
  getStats() {
    return {
      ...this.stats,
      channelCount: this.channels.size,
      enabledChannels: Array.from(this.channels.values()).filter(ch => ch.enabled).length,
      config: this.config
    };
  }

  /**
   * チャネル情報の取得
   */
  getChannelInfo() {
    const info: Array<{
      name: string;
      type: OutputType;
      enabled: boolean;
      className: string;
    }> = [];

    for (const [name, channel] of this.channels) {
      info.push({
        name,
        type: channel.type,
        enabled: channel.enabled,
        className: channel.constructor.name
      });
    }

    return info;
  }

  /**
   * カスタムチャネルの追加
   */
  addChannel(name: string, channel: OutputChannel): void {
    this.channels.set(name, channel);
  }

  /**
   * チャネルの削除
   */
  removeChannel(name: string): boolean {
    const channel = this.channels.get(name);
    if (channel) {
      if (channel.close) {
        channel.close();
      }
      return this.channels.delete(name);
    }
    return false;
  }

  /**
   * シャットダウン処理
   */
  shutdown(): void {
    for (const [name, channel] of this.channels) {
      try {
        if (channel.flush) {
          channel.flush();
        }
        if (channel.close) {
          channel.close();
        }
      } catch (error) {
        console.error(`Error closing channel ${name}:`, error);
      }
    }
  }

  /**
   * テスト用ヘルパー
   */
  _testChannels() {
    this.write('mcp', '{"jsonrpc":"2.0","result":"test","id":1}', 'test');
    this.write('control', 'CTRL_RESPONSE:test:ok', 'test');
    this.write('debug', 'Debug message', 'test');
    this.write('error', 'Error message', 'test');
  }
}