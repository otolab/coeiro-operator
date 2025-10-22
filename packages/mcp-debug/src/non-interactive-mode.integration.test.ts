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
  const echoServerPath = path.join(__dirname, '../dist/echo-server.js');

  it('should wait for response before shutting down', async () => {
    const cliPath = path.join(__dirname, '../dist/cli.js');

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

  it('should handle multiple requests sequentially without errors', async () => {
    const cliPath = path.join(__dirname, '../../dist/cli.js');

    // 3つのリクエストを送信
    const request1 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'request 1' },
      },
      id: 1,
    });

    const request2 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'request 2' },
      },
      id: 2,
    });

    const request3 = JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'echo',
        arguments: { message: 'request 3' },
      },
      id: 3,
    });

    return new Promise((resolve, reject) => {
      const child = spawn('node', [cliPath, echoServerPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const receivedResponses = new Set<number>();

      child.stdout.on('data', (data) => {
        stdout += data.toString();

        // JSON応答をチェック
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.trim() && line.startsWith('{')) {
            try {
              const response = JSON.parse(line);
              if (response.jsonrpc === '2.0' && typeof response.id === 'number') {
                // エラーレスポンスの場合
                if (response.error) {
                  reject(new Error(`Error in response ${response.id}: ${response.error.message}`));
                  return;
                }
                // 正常なレスポンスの場合
                if (response.result) {
                  receivedResponses.add(response.id);

                  // 全てのレスポンスを受信したら成功
                  if (receivedResponses.size === 3) {
                    // 全てのIDが揃っているか確認
                    if (receivedResponses.has(1) && receivedResponses.has(2) && receivedResponses.has(3)) {
                      resolve(undefined);
                    } else {
                      reject(new Error(`Unexpected response IDs: ${Array.from(receivedResponses).join(', ')}`));
                    }
                  }
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
        if (receivedResponses.size !== 3) {
          console.error('=== DEBUG OUTPUT ===');
          console.error('STDOUT:', stdout);
          console.error('STDERR:', stderr);
          console.error('Exit code:', code);
          console.error('Received responses:', Array.from(receivedResponses));
          reject(new Error(`Process exited with code ${code}. Received ${receivedResponses.size}/3 responses`));
        }
      });

      // 3つのリクエストを連続送信
      child.stdin.write(request1 + '\n');
      child.stdin.write(request2 + '\n');
      child.stdin.write(request3 + '\n');
      child.stdin.end();
    });
  }, 10000);
});