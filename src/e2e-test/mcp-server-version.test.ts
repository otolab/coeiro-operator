import { spawn } from 'child_process';
import { createServer } from 'http';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { getTestEnvironment } from '@coeiro-operator/core';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);

describe('MCP server package metadata', () => {
  test('ビルド済みサーバーのinitialize応答でMCP packageのversionを返すこと', async () => {
    const serverPath = path.resolve(__dirname, '../../packages/mcp/dist/server.js');
    const packageJsonPath = path.resolve(__dirname, '../../packages/mcp/package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      version: string;
    };
    const configDir = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-issue-260-'));
    const speakerApi = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('[]');
    });
    await new Promise<void>(resolve => speakerApi.listen(0, '127.0.0.1', resolve));
    const address = speakerApi.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start the test speaker API');
    }
    const configPath = path.join(configDir, 'config.json');
    await writeFile(
      configPath,
      JSON.stringify({ connection: { host: '127.0.0.1', port: String(address.port) } })
    );
    const child = spawn(process.execPath, [serverPath, '--config', configPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...getTestEnvironment(),
        HOME: configDir,
        NODE_NO_WARNINGS: '1',
      },
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';

    const initializeResponse = new Promise<{
      serverInfo?: { name?: string; version?: string };
    }>((resolve, reject) => {
      let settled = false;
      const finish = (
        error?: Error,
        response?: { serverInfo?: { name?: string; version?: string } }
      ) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(response ?? {});
        }
      };

      const timeout = setTimeout(() => {
        finish(new Error(`MCP initialize timed out. stderr: ${stderrBuffer}`));
      }, 30_000);

      child.on('error', error => finish(error));
      child.on('close', (code, signal) => {
        finish(
          new Error(
            `MCP server exited before initialize completed (code=${code}, signal=${signal}). ` +
              `stderr: ${stderrBuffer}`
          )
        );
      });
      child.stdout.setEncoding('utf-8');
      child.stdout.on('data', chunk => {
        stdoutBuffer += chunk;
        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          let message: {
            id?: number;
            result?: { serverInfo?: { name?: string; version?: string } };
            error?: { code: number; message: string };
          };
          try {
            message = JSON.parse(line) as typeof message;
          } catch (error) {
            finish(new Error(`Invalid MCP response: ${line}`, { cause: error }));
            return;
          }

          if (message.id !== 1) continue;
          if (message.error) {
            finish(
              new Error(`MCP initialize failed (${message.error.code}): ${message.error.message}`)
            );
          } else {
            finish(undefined, message.result);
          }
          return;
        }
      });
      child.stderr.setEncoding('utf-8');
      child.stderr.on('data', chunk => {
        stderrBuffer += chunk;
      });

      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'coeiro-operator-version-test', version: '1.0.0' },
          },
        })}\n`
      );
    });

    try {
      const response = await initializeResponse;
      expect(response.serverInfo?.name).toBe('coeiro-operator');
      expect(response.serverInfo?.version).toBe(packageJson.version);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise<void>(resolve => {
          const stopTimeout = setTimeout(() => {
            child.kill('SIGKILL');
            resolve();
          }, 3_000);
          child.once('close', () => {
            clearTimeout(stopTimeout);
            resolve();
          });
          child.kill('SIGTERM');
        });
      }
      await new Promise<void>(resolve => speakerApi.close(() => resolve()));
      await rm(configDir, { recursive: true, force: true });
    }
  }, 30_000);
});
