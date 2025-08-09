/**
 * Log Accumulator Implementation
 * ログ蓄積・管理機能の実装
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  LogEntry, 
  LogAccumulator, 
  LogQueryOptions, 
  LogStats, 
  LogFilter, 
  LogStream,
  ArchiveConfig,
  LogLevel
} from './types.js';

export class DebugLogAccumulator implements LogAccumulator {
  private entries: LogEntry[] = [];
  private maxEntries: number;
  private streams: Map<string, LogStream> = new Map();
  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    quiet: 0, error: 1, warn: 2, info: 3, verbose: 4, debug: 5
  };

  constructor(maxEntries: number = 2000) {
    this.maxEntries = maxEntries;
  }

  addEntry(entry: LogEntry): void {
    // IDが未設定の場合は生成
    if (!entry.id) {
      entry.id = uuidv4();
    }

    this.entries.push(entry);

    // 最大エントリ数を超えた場合、古いものを削除
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // アクティブなストリームに配信
    this.deliverToStreams(entry);
  }

  private deliverToStreams(entry: LogEntry): void {
    for (const [streamId, stream] of this.streams) {
      if (!stream.isActive) continue;
      
      if (this.matchesFilter(entry, stream.filter)) {
        try {
          stream.callback(entry);
          stream.stats.entriesDelivered++;
          stream.stats.lastDelivery = new Date();
        } catch (error) {
          console.error(`Stream ${streamId} delivery failed:`, error);
          stream.stats.entriesDropped++;
        }
      }
    }
  }

  private matchesFilter(entry: LogEntry, filter: LogFilter): boolean {
    // レベルフィルター
    if (filter.level && filter.level.length > 0) {
      if (!filter.level.includes(entry.level)) {
        return false;
      }
    }

    // ソースフィルター
    if (filter.source && filter.source.length > 0) {
      if (!entry.source || !filter.source.includes(entry.source)) {
        return false;
      }
    }

    // 検索フィルター
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const messageMatch = entry.message.toLowerCase().includes(searchLower);
      const formattedMatch = entry.formatted.toLowerCase().includes(searchLower);
      if (!messageMatch && !formattedMatch) {
        return false;
      }
    }

    // 時刻フィルター
    const entryTime = new Date(entry.timestamp);
    if (filter.since && entryTime < filter.since) {
      return false;
    }
    if (filter.until && entryTime > filter.until) {
      return false;
    }

    // コンテキストフィルター
    if (filter.context && entry.context) {
      for (const [key, value] of Object.entries(filter.context)) {
        if (entry.context[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  getEntries(options: LogQueryOptions = {}): LogEntry[] {
    let filtered = [...this.entries];

    // レベルフィルター
    if (options.level) {
      const levels = Array.isArray(options.level) ? options.level : [options.level];
      filtered = filtered.filter(entry => levels.includes(entry.level));
    }

    // ソースフィルター
    if (options.source) {
      const sources = Array.isArray(options.source) ? options.source : [options.source];
      filtered = filtered.filter(entry => entry.source && sources.includes(entry.source));
    }

    // 時刻フィルター
    if (options.since) {
      const sinceTime = options.since.getTime();
      filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() >= sinceTime);
    }
    if (options.until) {
      const untilTime = options.until.getTime();
      filtered = filtered.filter(entry => new Date(entry.timestamp).getTime() <= untilTime);
    }

    // 検索フィルター
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(searchLower) ||
        entry.formatted.toLowerCase().includes(searchLower)
      );
    }

    // コンテキストフィルター
    if (options.context && Object.keys(options.context).length > 0) {
      filtered = filtered.filter(entry => {
        if (!entry.context) return false;
        return Object.entries(options.context!).every(([key, value]) => 
          entry.context![key] === value
        );
      });
    }

    // ソート
    if (options.sortOrder) {
      filtered.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return options.sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      });
    }

    // オフセットと制限
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;
    return filtered.slice(start, end);
  }

  clearEntries(): void {
    const count = this.entries.length;
    this.entries = [];
    console.info(`Cleared ${count} log entries`);
  }

  getStats(): LogStats {
    const stats: LogStats = {
      totalEntries: this.entries.length,
      entriesByLevel: {
        quiet: 0, error: 0, warn: 0, info: 0, verbose: 0, debug: 0
      },
      entriesBySource: {},
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp,
      memoryUsage: {
        estimatedSize: this.estimateMemoryUsage(),
        maxSize: this.maxEntries * 1024, // 概算
        utilizationPercent: (this.entries.length / this.maxEntries) * 100
      },
      streaming: {
        isActive: this.streams.size > 0,
        activeStreams: Array.from(this.streams.values()).filter(s => s.isActive).length,
        totalStreamed: Array.from(this.streams.values()).reduce((sum, s) => sum + s.stats.entriesDelivered, 0),
        droppedEntries: Array.from(this.streams.values()).reduce((sum, s) => sum + s.stats.entriesDropped, 0)
      }
    };

    // レベル別・ソース別統計
    this.entries.forEach(entry => {
      stats.entriesByLevel[entry.level]++;
      if (entry.source) {
        stats.entriesBySource[entry.source] = (stats.entriesBySource[entry.source] || 0) + 1;
      }
    });

    return stats;
  }

  private estimateMemoryUsage(): number {
    return this.entries.reduce((size, entry) => {
      return size + JSON.stringify(entry).length * 2; // 概算（UTF-16）
    }, 0);
  }

  createStream(filter: LogFilter, callback: (entry: LogEntry) => void): string {
    const streamId = uuidv4();
    const stream: LogStream = {
      id: streamId,
      filter,
      callback,
      isActive: true,
      created: new Date(),
      stats: {
        entriesDelivered: 0,
        entriesDropped: 0
      }
    };

    this.streams.set(streamId, stream);
    return streamId;
  }

  destroyStream(streamId: string): boolean {
    return this.streams.delete(streamId);
  }

  async archive(options: ArchiveConfig = {
    enabled: false,
    retentionDays: 30,
    compressionLevel: 6,
    archivePath: './logs/archive',
    maxArchiveSize: 100 * 1024 * 1024 // 100MB
  }): Promise<void> {
    if (!options.enabled) return;
    
    // TODO: アーカイブ機能の実装
    console.warn('Archive functionality not yet implemented');
  }

  search(query: string, options: LogQueryOptions = {}): LogEntry[] {
    return this.getEntries({
      ...options,
      search: query
    });
  }

  export(format: 'json' | 'csv' | 'txt', options: LogQueryOptions = {}): string {
    const entries = this.getEntries(options);
    
    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);
      
      case 'csv':
        if (entries.length === 0) return '';
        const headers = ['timestamp', 'level', 'source', 'message'];
        const csvRows = [headers.join(',')];
        entries.forEach(entry => {
          const row = [
            entry.timestamp,
            entry.level,
            entry.source || '',
            `"${entry.message.replace(/"/g, '""')}"`
          ];
          csvRows.push(row.join(','));
        });
        return csvRows.join('\n');
      
      case 'txt':
        return entries.map(entry => entry.formatted).join('\n');
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // メンテナンス機能
  setMaxEntries(maxEntries: number): void {
    this.maxEntries = maxEntries;
    
    // 現在のエントリ数が新しい上限を超えている場合は調整
    if (this.entries.length > this.maxEntries) {
      const excess = this.entries.length - this.maxEntries;
      this.entries.splice(0, excess);
    }
  }

  getMaxEntries(): number {
    return this.maxEntries;
  }

  // デバッグ用
  _getStreams(): Map<string, LogStream> {
    return this.streams;
  }
}