/**
 * 非インタラクティブモードのテスト
 * レスポンスを待たずに終了する問題を検証
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { describe, it } from 'vitest';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);

describe('MCP Debug Non-Interactive Mode', () => {
  // 既存のecho-serverを使用
  const echoServerPath = path.join(__dirname, '../../dist/echo-server.js');

  it('should wait for response before shutting down', async () => {
    const cliPath = path.join(__dirname, '../../dist/cli.js');

    // echoツールを呼び出す
    const jsonRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'test message' },
      },
      id: 1,
    });

    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, echoServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let responseReceived = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();

        // JSON応答をチェック
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.jsonrpc === '2.0' && response.id === 1) {
                responseReceived = true;

                // エラーレスポンスの場合
                if (response.error) {
                  reject(new Error(`Error: ${response.error.message}`));
                }
                // 正常なレスポンスの場合
                else if (response.result) {
                  resolve(response.result);
                }
              }
            } catch {
              // JSONパースエラーは無視
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!responseReceived) {
          console.error('=== DEBUG OUTPUT ===');
          console.error('STDOUT:', stdout);
          console.error('STDERR:', stderr);
          console.error('Exit code:', code);
          reject(new Error(`Process exited with code ${code} without sending response`));
        }
      });

      // リクエストを送信
      child.stdin.write(jsonRequest + '\n');
      child.stdin.end();
    });
  }, 10000); // 10秒のタイムアウト

  it('should handle echo tool correctly', async () => {
    const cliPath = path.join(__dirname, '../../dist/cli.js');

    // echoツールを呼び出す（別のメッセージ）
    const jsonRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'another test' },
      },
      id: 1,
    });

    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, echoServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let responseReceived = false;

      child.stdout.on('data', (data) => {
        stdout += data.toString();

        // JSON応答をチェック
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.jsonrpc === '2.0' && response.id === 1) {
                responseReceived = true;

                if (response.error) {
                  reject(new Error(`Error: ${response.error.message}`));
                } else if (response.result) {
                  resolve(response.result);
                }
              }
            } catch {
              // JSONパースエラーは無視
            }
          }
        }
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (!responseReceived) {
          console.error('=== DEBUG OUTPUT ===');
          console.error('STDOUT:', stdout);
          console.error('STDERR:', stderr);
          console.error('Exit code:', code);
          reject(new Error(`Process exited with code ${code} without sending response`));
        }
      });

      // リクエストを送信
      child.stdin.write(jsonRequest + '\n');
      child.stdin.end();
    });
  }, 10000);
});