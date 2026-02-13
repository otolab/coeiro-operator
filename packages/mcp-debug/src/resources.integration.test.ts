/**
 * リソース機能の統合テスト
 * echo-serverのリソースをMCPプロトコル経由でテスト
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { describe, it, expect } from 'vitest';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);

describe('MCP Debug Resource Integration', () => {
  const echoServerPath = path.join(__dirname, '../dist/echo-server.js');
  const cliPath = path.join(__dirname, '../dist/cli.js');

  it('should list available resources via resources/list', async () => {
    const jsonRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'resources/list',
      params: {},
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
                  expect(response.result.resources).toBeDefined();
                  expect(Array.isArray(response.result.resources)).toBe(true);
                  expect(response.result.resources.length).toBeGreaterThanOrEqual(2);

                  const uris = response.result.resources.map((r: { uri: string }) => r.uri);
                  expect(uris).toContain('echo://server/info');
                  expect(uris).toContain('echo://server/config');

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

      child.stdin.write(jsonRequest + '\n');
      child.stdin.end();
    });
  }, 10000);

  it('should read a text resource via resources/read', async () => {
    const jsonRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: { uri: 'echo://server/info' },
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
                  expect(response.result.contents).toBeDefined();
                  expect(response.result.contents.length).toBe(1);
                  expect(response.result.contents[0].uri).toBe('echo://server/info');
                  expect(response.result.contents[0].mimeType).toBe('text/plain');
                  expect(response.result.contents[0].text).toContain('Echo MCP Server');

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

      child.stdin.write(jsonRequest + '\n');
      child.stdin.end();
    });
  }, 10000);

  it('should read a JSON resource via resources/read', async () => {
    const jsonRequest = JSON.stringify({
      jsonrpc: '2.0',
      method: 'resources/read',
      params: { uri: 'echo://server/config' },
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
                  expect(response.result.contents).toBeDefined();
                  expect(response.result.contents[0].mimeType).toBe('application/json');

                  const config = JSON.parse(response.result.contents[0].text);
                  expect(config.serverName).toBe('echo-mcp-server');
                  expect(config.version).toBe('1.0.0');

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

      child.stdin.write(jsonRequest + '\n');
      child.stdin.end();
    });
  }, 10000);
});
