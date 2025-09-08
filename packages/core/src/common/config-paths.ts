/**
 * 共通設定パス管理
 */

import { mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * 設定ディレクトリを決定（ホームディレクトリベース）
 */
export async function getConfigDir(): Promise<string> {
  // ホームディレクトリの ~/.coeiro-operator/ を優先
  const homeDir = join(process.env.HOME || process.env.USERPROFILE || '~', '.coeiro-operator');

  try {
    await mkdir(homeDir, { recursive: true });
    return homeDir;
  } catch {
    // フォールバック: 作業ディレクトリの .coeiroink/
    const workDir = join(process.cwd(), '.coeiroink');
    try {
      await mkdir(workDir, { recursive: true });
      return workDir;
    } catch {
      // 最終フォールバック: /tmp/coeiroink-mcp-shared/
      const tmpDir = '/tmp/coeiroink-mcp-shared';
      try {
        await mkdir(tmpDir, { recursive: true });
      } catch {
        // ディレクトリ作成エラーは無視
      }
      return tmpDir;
    }
  }
}

/**
 * 設定ファイルのパスを取得
 */
export async function getConfigPath(filename: string): Promise<string> {
  const configDir = await getConfigDir();
  return join(configDir, filename);
}
