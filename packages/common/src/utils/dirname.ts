import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * ESモジュールで__dirnameの代替を提供
 * @param importMetaUrl - import.meta.url を渡す
 * @returns ディレクトリパス
 */
export function getDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}

/**
 * ESモジュールで__filenameの代替を提供
 * @param importMetaUrl - import.meta.url を渡す
 * @returns ファイルパス
 */
export function getFilename(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl);
}