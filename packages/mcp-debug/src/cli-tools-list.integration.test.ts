import { spawn } from 'node:child_process';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDirname } from '@coeiro-operator/common';

const __dirname = getDirname(import.meta.url);
const cliPath = path.join(__dirname, '../dist/cli.js');
const mockServerPath = path.join(__dirname, 'test/tools-list-server.mjs');

interface CLIProcess {
  child: ChildProcessWithoutNullStreams;
  stdout: string;
  stderr: string;
  closed: Promise<{ code: number | null; stdout: string; stderr: string }>;
}

function startCLI(interactive: boolean, mode = 'pages'): CLIProcess {
  const args = [cliPath, ...(interactive ? ['--interactive'] : []), mockServerPath];
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      MCP_DEBUG_TOOLS_LIST_MODE: mode,
    },
    stdio: 'pipe',
  });

  const session: CLIProcess = {
    child,
    stdout: '',
    stderr: '',
    closed: new Promise(resolve => {
      child.once('close', code =>
        resolve({ code, stdout: session.stdout, stderr: session.stderr })
      );
    }),
  };

  child.stdout.on('data', chunk => {
    session.stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    session.stderr += chunk.toString();
  });

  return session;
}

function waitForStdout(
  session: CLIProcess,
  predicate: (stdout: string) => boolean,
  timeoutMs = 5000
): Promise<void> {
  if (predicate(session.stdout)) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      session.child.kill('SIGKILL');
      reject(
        new Error(
          `Timed out waiting for CLI output.\nstdout:\n${session.stdout}\nstderr:\n${session.stderr}`
        )
      );
    }, timeoutMs);

    const onData = () => {
      if (predicate(session.stdout)) {
        cleanup();
        resolve();
      }
    };
    const onClose = (code: number | null) => {
      cleanup();
      reject(
        new Error(
          `CLI exited with code ${code} before expected output.\nstdout:\n${session.stdout}\nstderr:\n${session.stderr}`
        )
      );
    };
    const cleanup = () => {
      clearTimeout(timeout);
      session.child.stdout.off('data', onData);
      session.child.off('close', onClose);
    };

    session.child.stdout.on('data', onData);
    session.child.once('close', onClose);
  });
}

async function runInteractiveCommand(command: string, mode = 'pages'): Promise<CLIProcess> {
  const session = startCLI(true, mode);
  session.child.stdin.write(`${command}\n`);
  await waitForStdout(session, stdout => stdout.includes('> '));
  return session;
}

async function finishInteractive(
  session: CLIProcess
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  session.child.stdin.write('exit\n');
  session.child.stdin.end();
  return session.closed;
}

async function runJSONRPCRequests(
  requests: unknown[],
  mode = 'pages'
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const session = startCLI(false, mode);
  session.child.stdin.end(`${requests.map(request => JSON.stringify(request)).join('\n')}\n`);
  return session.closed;
}

describe('MCP Debug CLI tools/list', () => {
  it('interactive tools shortcut displays names from all pages, not capability keys', async () => {
    const session = await runInteractiveCommand('tools');
    await waitForStdout(session, stdout => stdout.includes('   - echo'));
    const result = await finishInteractive(session);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('   - say');
    expect(result.stdout).toContain('   - echo');
    expect(result.stdout).not.toContain('   - listChanged');
  });

  it('JSON-RPC tools/list returns server tool definitions and forwards the cursor', async () => {
    const result = await runJSONRPCRequests([
      { jsonrpc: '2.0', method: 'tools/list', id: 10 },
      { jsonrpc: '2.0', method: 'tools/list', params: { cursor: 'page-2' }, id: 11 },
    ]);

    expect(result.code).toBe(0);
    const responses = result.stdout
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(responses).toEqual([
      {
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'say',
              description: 'Speak text',
              inputSchema: {
                type: 'object',
                properties: { speechText: { type: 'string' } },
                required: ['speechText'],
              },
            },
          ],
          nextCursor: 'page-2',
        },
        id: 10,
      },
      {
        jsonrpc: '2.0',
        result: {
          tools: [
            {
              name: 'echo',
              description: 'Echo a message',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
        id: 11,
      },
    ]);
  });

  it('empty tool lists stay empty in both CLI paths', async () => {
    const shortcut = await runInteractiveCommand('tools', 'empty');
    await waitForStdout(shortcut, stdout => stdout.includes('No tools available'));
    const shortcutResult = await finishInteractive(shortcut);
    const requestResult = await runJSONRPCRequests(
      [{ jsonrpc: '2.0', method: 'tools/list', id: 12 }],
      'empty'
    );

    expect(shortcutResult.code).toBe(0);
    expect(requestResult.code).toBe(0);
    expect(shortcutResult.stdout).toContain('No tools available');
    expect(JSON.parse(requestResult.stdout.trim())).toEqual({
      jsonrpc: '2.0',
      result: { tools: [] },
      id: 12,
    });
  });

  it('tools/list errors retain the existing interactive and JSON-RPC error handling', async () => {
    const shortcut = await runInteractiveCommand('tools', 'error');
    await waitForStdout(shortcut, stdout => stdout.includes('tools/list unavailable'));
    const shortcutResult = await finishInteractive(shortcut);
    const requestResult = await runJSONRPCRequests(
      [{ jsonrpc: '2.0', method: 'tools/list', id: 13 }],
      'error'
    );

    expect(shortcutResult.code).toBe(0);
    expect(requestResult.code).toBe(0);
    expect(shortcutResult.stdout).toContain('❌ Error: MCP Error -32601: tools/list unavailable');
    expect(JSON.parse(requestResult.stdout.trim())).toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'MCP Error -32601: tools/list unavailable',
      },
      id: 13,
    });
  });

  it('interactive shortcut stops if the server repeats a pagination cursor', async () => {
    const session = await runInteractiveCommand('tools', 'repeated-cursor');
    await waitForStdout(session, stdout => stdout.includes('repeated tools/list cursor'));
    const result = await finishInteractive(session);

    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      'MCP server returned a repeated tools/list cursor: repeated-cursor'
    );
  });
});
