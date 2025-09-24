import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface BackgroundConfig {
  imagePath?: string;
  opacity?: number;  // 0.0 - 1.0
  mode?: 'stretch' | 'tile' | 'fit' | 'fill';
  position?: 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left' | 'center';
  scale?: number;  // 0.0 - 1.0 (画像のサイズ比率)
}

export class TerminalBackground {
  private pythonScriptPath: string;
  private pythonEnvPath: string;

  constructor() {
    const packageRoot = path.join(__dirname, '..');
    this.pythonScriptPath = path.join(packageRoot, 'python', 'set_background.py');
    this.pythonEnvPath = path.join(packageRoot, 'python', '.venv');
  }

  /**
   * iTerm2の背景画像を設定
   */
  async setBackground(config: BackgroundConfig): Promise<void> {
    // 位置とスケールが指定されている場合は画像を前処理
    if (config.imagePath && (config.position || config.scale)) {
      const processedPath = await this.processImage(config);
      config = { ...config, imagePath: processedPath };
    }

    return new Promise((resolve, reject) => {
      // uvが利用可能か確認
      if (!this.isUvAvailable()) {
        reject(new Error('uv is not available. Please install uv first.'));
        return;
      }

      // 設定をJSON文字列に変換
      const configJson = JSON.stringify(config);

      // uvでPythonスクリプトを実行
      const pythonProjectDir = path.resolve(path.dirname(this.pythonScriptPath));
      const proc = spawn('uv', ['run', '--project', pythonProjectDir, 'python', this.pythonScriptPath, configJson]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve();
          }
        } catch (error) {
          // JSON以外の出力がある場合（iTerm2 APIの接続メッセージなど）
          if (stdout.includes('success')) {
            resolve();
          } else {
            reject(new Error(`Failed to parse response: ${stdout}`));
          }
        }
      });

      proc.on('error', (error) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * 画像を前処理（位置とサイズ調整）
   */
  private async processImage(config: BackgroundConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isUvAvailable()) {
        reject(new Error('uv is not available'));
        return;
      }

      const packageRoot = path.join(__dirname, '..');
      const processScript = path.join(packageRoot, 'python', 'process_image.py');
      const pythonProjectDir = path.resolve(path.join(packageRoot, 'python'));

      // ターミナルサイズを取得
      const terminalSize = this.getTerminalSize();

      const processConfig = {
        sourcePath: config.imagePath,
        outputPath: `/tmp/bg_processed_${Date.now()}.png`,
        position: config.position || 'bottom-right',
        scale: config.scale || 0.2,
        opacity: 1.0,  // 画像処理では透明度を適用しない（iTerm2側で制御）
        terminalSize: terminalSize
      };

      const proc = spawn('uv', ['run', '--project', pythonProjectDir, 'python', processScript, JSON.stringify(processConfig)]);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      proc.on('close', (code: any) => {
        if (code !== 0) {
          reject(new Error(`Image processing failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.outputPath);
          }
        } catch (error) {
          reject(new Error(`Failed to parse response: ${stdout}`));
        }
      });

      proc.on('error', (error: any) => {
        reject(new Error(`Failed to spawn Python process: ${error.message}`));
      });
    });
  }

  /**
   * 背景画像をクリア
   */
  async clearBackground(): Promise<void> {
    return this.setBackground({ imagePath: '' });
  }

  /**
   * iTerm2で実行中かチェック
   */
  isITerm2(): boolean {
    return process.env.TERM_PROGRAM === 'iTerm.app';
  }

  /**
   * uvが利用可能かチェック
   */
  private isUvAvailable(): boolean {
    try {
      const { execSync } = require('child_process');
      execSync('which uv', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ターミナルのサイズを取得（ピクセル単位で推定）
   */
  private getTerminalSize(): [number, number] | null {
    try {
      const cols = process.stdout.columns || 80;
      const rows = process.stdout.rows || 24;

      // 一般的な文字サイズから推定（1文字あたり約8x16ピクセル）
      const charWidth = 10;
      const charHeight = 20;

      return [cols * charWidth, rows * charHeight];
    } catch {
      return null;
    }
  }
}

// デフォルトエクスポート
export default TerminalBackground;