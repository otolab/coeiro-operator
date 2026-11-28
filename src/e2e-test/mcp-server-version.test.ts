import { spawn, type ChildProcess } from 'child_process';
import { createServer, type Server } from 'http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import { describe, expect, test } from 'vitest';
import { getTestEnvironment } from '@coeiro-operator/core';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);
const INITIALIZE_TIMEOUT_MS = 10_000;
const VITEST_TIMEOUT_MS = 45_000;

interface InitializeResponse {
  serverInfo?: { name?: string; version?: string };
}

interface TestResources {
  configDir?: string;
  speakerApi?: Server;
  child?: ChildProcess;
}

interface InitializeTestOptions {
  serverPath: string;
  tempRoot: string;
  timeoutMs?: number;
  resources?: TestResources;
  writeConfig?: (configPath: string, contents: string) => Promise<void>;
}

async function runInitializeTest({
  serverPath,
  tempRoot,
  timeoutMs = INITIALIZE_TIMEOUT_MS,
  resources,
  writeConfig = (configPath, contents) => writeFile(configPath, contents),
}: InitializeTestOptions): Promise<InitializeResponse> {
  let configDir: string | undefined;
  let speakerApi: Server | undefined;
  let child: ChildProcess | undefined;
  let childClosed = false;
  let childClosePromise: Promise<void> | undefined;

  try {
    configDir = await mkdtemp(path.join(tempRoot, 'coeiro-operator-issue-260-'));
    if (resources) resources.configDir = configDir;

    speakerApi = createServer((_request, response) => {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        Connection: 'close',
      });
      response.end('[]');
    });
    if (resources) resources.speakerApi = speakerApi;
    await listen(speakerApi);

    const address = speakerApi.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to start the test speaker API');
    }

    const configPath = path.join(configDir, 'config.json');
    await writeConfig(
      configPath,
      JSON.stringify({ connection: { host: '127.0.0.1', port: String(address.port) } })
    );

    const spawnedChild = spawn(process.execPath, [serverPath, '--config', configPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...getTestEnvironment(),
        HOME: configDir,
        NODE_NO_WARNINGS: '1',
      },
    });
    child = spawnedChild;
    if (resources) resources.child = spawnedChild;
    childClosePromise = new Promise(resolve => {
      spawnedChild.once('close', () => {
        childClosed = true;
        resolve();
      });
    });

    return await waitForInitializeResponse(child, timeoutMs);
  } finally {
    try {
      if (child && childClosePromise) {
        await stopChild(child, childClosePromise, () => childClosed);
      }
    } finally {
      try {
        if (speakerApi) await closeServer(speakerApi);
      } finally {
        if (configDir) await rm(configDir, { recursive: true, force: true });
      }
    }
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      server.off('listening', onListening);
      reject(error);
    };

    server.once('listening', onListening);
    server.once('error', onError);
    server.listen(0, '127.0.0.1');
  });
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function stopChild(
  child: ChildProcess,
  closePromise: Promise<void>,
  hasClosed: () => boolean
): Promise<void> {
  if (hasClosed()) return;

  if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
  }

  const closedAfterTerm = await waitForCloseOrTimeout(closePromise, 2_000);
  if (!closedAfterTerm && child.pid !== undefined) {
    child.kill('SIGKILL');
  }

  await closePromise;
}

async function waitForCloseOrTimeout(
  closePromise: Promise<void>,
  timeoutMs: number
): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const closed = await Promise.race([
    closePromise.then(() => true),
    new Promise<boolean>(resolve => {
      timeout = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timeout) clearTimeout(timeout);
  return closed;
}

function waitForInitializeResponse(
  child: ChildProcess,
  timeoutMs: number
): Promise<InitializeResponse> {
  let stdoutBuffer = '';
  let stderrBuffer = '';

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error, response?: InitializeResponse) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (error) {
        reject(error);
      } else {
        resolve(response ?? {});
      }
    };

    child.on('error', error => finish(error));
    child.on('close', (code, signal) => {
      finish(
        new Error(
          `MCP server exited before initialize completed (code=${code}, signal=${signal}). ` +
            `stderr: ${stderrBuffer}`
        )
      );
    });
    child.once('spawn', () => {
      if (settled) return;
      timeout = setTimeout(() => {
        finish(new Error(`MCP initialize timed out after ${timeoutMs}ms. stderr: ${stderrBuffer}`));
      }, timeoutMs);
    });
    child.stdin.on('error', error => finish(error));
    child.stdout.setEncoding('utf-8');
    child.stdout.on('data', chunk => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;

        let message: {
          id?: number;
          result?: InitializeResponse;
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

    try {
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
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

describe('MCP server package metadata', () => {
  test(
    'ビルド済みサーバーのinitialize応答でMCP packageのversionを返すこと',
    async () => {
      const serverPath = path.resolve(__dirname, '../../packages/mcp/dist/server.js');
      const packageJsonPath = path.resolve(__dirname, '../../packages/mcp/package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
        version: string;
      };
      const tempRoot = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-issue-260-test-'));
      const resources: TestResources = {};

      try {
        const response = await runInitializeTest({ serverPath, tempRoot, resources });
        expect(response.serverInfo?.name).toBe('coeiro-operator');
        expect(response.serverInfo?.version).toBe(packageJson.version);
        expect(resources.speakerApi?.listening).toBe(false);
        expect(
          resources.child &&
            (resources.child.exitCode !== null || resources.child.signalCode !== null)
        ).toBe(true);
        expect(await readdir(tempRoot)).toEqual([]);
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    VITEST_TIMEOUT_MS
  );

  test(
    '設定準備に失敗した場合もspeaker APIと一時ディレクトリを回収すること',
    async () => {
      const serverPath = path.resolve(__dirname, '../../packages/mcp/dist/server.js');
      const tempRoot = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-issue-260-setup-'));
      const resources: TestResources = {};

      try {
        await expect(
          runInitializeTest({
            serverPath,
            tempRoot,
            resources,
            writeConfig: async () => {
              throw new Error('forced config preparation failure');
            },
          })
        ).rejects.toThrow('forced config preparation failure');

        expect(resources.speakerApi?.listening).toBe(false);
        expect(resources.child).toBeUndefined();
        expect(await readdir(tempRoot)).toEqual([]);
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    VITEST_TIMEOUT_MS
  );

  test(
    'initialize timeout時に診断を返し、speaker API・一時ディレクトリ・子プロセスを回収すること',
    async () => {
      const tempRoot = await mkdtemp(path.join(tmpdir(), 'coeiro-operator-issue-260-timeout-'));
      const unresponsiveServerPath = path.join(tempRoot, 'unresponsive-server.mjs');
      const resources: TestResources = {};

      try {
        await writeFile(unresponsiveServerPath, 'setInterval(() => {}, 1_000);\n');
        await expect(
          runInitializeTest({
            serverPath: unresponsiveServerPath,
            tempRoot,
            timeoutMs: 500,
            resources,
          })
        ).rejects.toThrow(/MCP initialize timed out after 500ms\. stderr:/);

        expect(resources.speakerApi?.listening).toBe(false);
        expect(resources.configDir).toBeDefined();
        expect(resources.child?.pid).toBeDefined();
        expect(
          resources.child &&
            (resources.child.exitCode !== null || resources.child.signalCode !== null)
        ).toBe(true);
        expect(await readdir(tempRoot)).toEqual(['unresponsive-server.mjs']);
      } finally {
        await rm(tempRoot, { recursive: true, force: true });
      }
    },
    VITEST_TIMEOUT_MS
  );
});
