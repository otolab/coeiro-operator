/**
 * Output Channels Implementation
 * 出力チャネル管理の実装
 */

export type OutputType = 'mcp' | 'control' | 'debug' | 'error';

export interface OutputMessage {
  type: OutputType;
  content: string;
  timestamp: string;
  source?: string;
  metadata?: Record<string, any>;
}

export interface OutputChannel {
  name: string;
  type: OutputType;
  enabled: boolean;
  write(message: OutputMessage): void;
  flush?(): void;
  close?(): void;
}

/**
 * 標準出力チャネル（MCP Response用）
 */
export class StdoutChannel implements OutputChannel {
  name = 'stdout';
  type: OutputType = 'mcp';
  enabled = true;

  write(message: OutputMessage): void {
    if (!this.enabled || message.type !== 'mcp') return;
    
    // MCPレスポンスは改行なしで出力（JSON-RPC仕様）
    process.stdout.write(message.content);
  }

  flush(): void {
    // Node.jsのstdoutは自動的にフラッシュされる
  }
}

/**
 * 標準エラー出力チャネル（エラー用）
 */
export class StderrChannel implements OutputChannel {
  name = 'stderr';
  type: OutputType = 'error';
  enabled = true;

  write(message: OutputMessage): void {
    if (!this.enabled || message.type !== 'error') return;
    
    console.error(message.content);
  }
}

/**
 * 制御応答チャネル（Control Response用）
 */
export class ControlChannel implements OutputChannel {
  name = 'control';
  type: OutputType = 'control';
  enabled = true;

  write(message: OutputMessage): void {
    if (!this.enabled || message.type !== 'control') return;
    
    // 制御応答は標準出力に送信（MCPレスポンスと区別可能な形式）
    console.log(message.content);
  }
}

/**
 * デバッグ出力チャネル（Debug Output用）
 */
export class DebugChannel implements OutputChannel {
  name = 'debug';
  type: OutputType = 'debug';
  enabled = false; // デフォルトで無効

  write(message: OutputMessage): void {
    if (!this.enabled || message.type !== 'debug') return;
    
    // デバッグ出力は標準エラーに送信（通常のログと区別）
    console.error(`DEBUG:${message.content}`);
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}

/**
 * バッファ付き出力チャネル（高頻度出力の制御用）
 */
export class BufferedChannel implements OutputChannel {
  name = 'buffered';
  type: OutputType;
  enabled = true;
  
  private buffer: OutputMessage[] = [];
  private maxBufferSize: number;
  private flushInterval: number;
  private flushTimer?: NodeJS.Timeout;
  private targetChannel: OutputChannel;

  constructor(
    targetChannel: OutputChannel, 
    maxBufferSize: number = 100, 
    flushInterval: number = 1000
  ) {
    this.type = targetChannel.type;
    this.targetChannel = targetChannel;
    this.maxBufferSize = maxBufferSize;
    this.flushInterval = flushInterval;
    
    this.startFlushTimer();
  }

  write(message: OutputMessage): void {
    if (!this.enabled) return;
    
    this.buffer.push(message);
    
    // バッファがフルになったら即座にフラッシュ
    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;
    
    const messages = [...this.buffer];
    this.buffer = [];
    
    // バッファ内のメッセージを対象チャネルに送信
    for (const message of messages) {
      this.targetChannel.write(message);
    }
    
    if (this.targetChannel.flush) {
      this.targetChannel.flush();
    }
  }

  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }
}

/**
 * フィルタ付き出力チャネル（条件付き出力用）
 */
export class FilteredChannel implements OutputChannel {
  name = 'filtered';
  type: OutputType;
  enabled = true;
  
  private targetChannel: OutputChannel;
  private filter: (message: OutputMessage) => boolean;

  constructor(
    targetChannel: OutputChannel, 
    filter: (message: OutputMessage) => boolean
  ) {
    this.type = targetChannel.type;
    this.targetChannel = targetChannel;
    this.filter = filter;
  }

  write(message: OutputMessage): void {
    if (!this.enabled) return;
    
    if (this.filter(message)) {
      this.targetChannel.write(message);
    }
  }

  flush(): void {
    if (this.targetChannel.flush) {
      this.targetChannel.flush();
    }
  }

  close(): void {
    if (this.targetChannel.close) {
      this.targetChannel.close();
    }
  }
}

/**
 * マルチチャネル出力（複数チャネルへの同時出力用）
 */
export class MultiChannel implements OutputChannel {
  name = 'multi';
  type: OutputType;
  enabled = true;
  
  private channels: OutputChannel[];

  constructor(type: OutputType, channels: OutputChannel[]) {
    this.type = type;
    this.channels = channels;
  }

  write(message: OutputMessage): void {
    if (!this.enabled) return;
    
    for (const channel of this.channels) {
      if (channel.enabled && channel.type === message.type) {
        channel.write(message);
      }
    }
  }

  flush(): void {
    for (const channel of this.channels) {
      if (channel.flush) {
        channel.flush();
      }
    }
  }

  close(): void {
    for (const channel of this.channels) {
      if (channel.close) {
        channel.close();
      }
    }
  }

  addChannel(channel: OutputChannel): void {
    this.channels.push(channel);
  }

  removeChannel(channelName: string): boolean {
    const index = this.channels.findIndex(ch => ch.name === channelName);
    if (index >= 0) {
      this.channels.splice(index, 1);
      return true;
    }
    return false;
  }

  getChannels(): OutputChannel[] {
    return [...this.channels];
  }
}