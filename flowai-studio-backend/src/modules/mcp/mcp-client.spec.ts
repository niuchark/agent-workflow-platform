import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { McpClient } from './mcp-client';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

describe('McpClient process isolation', () => {
  it('does not use a shell or pass backend secrets to the child process', async () => {
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & Record<string, unknown>;
    child.stdout = stdout;
    child.stderr = stderr;
    child.killed = false;
    child.kill = jest.fn(() => {
      child.killed = true;
      return true;
    });
    child.stdin = {
      writable: true,
      write: jest.fn((raw: string) => {
        const request = JSON.parse(raw) as { id?: number; method?: string };
        if (request.method === 'initialize') {
          process.nextTick(() => {
            stdout.emit(
              'data',
              Buffer.from(`${JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: { capabilities: {} },
              })}\n`),
            );
          });
        }
        return true;
      }),
    };
    (spawn as jest.Mock).mockReturnValue(child);

    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'must-not-leak';
    try {
      const client = new McpClient('/opt/flowai/mcp-server', [], {
        MCP_TOKEN: 'user-token',
        NODE_OPTIONS: '--require /tmp/evil.js',
      });
      await client.connect();

      expect(spawn).toHaveBeenCalledWith(
        '/opt/flowai/mcp-server',
        [],
        expect.objectContaining({
          shell: false,
          env: expect.objectContaining({ MCP_TOKEN: 'user-token' }),
        }),
      );
      const options = (spawn as jest.Mock).mock.calls[0][2] as {
        env: Record<string, string>;
      };
      expect(options.env.JWT_SECRET).toBeUndefined();
      expect(options.env.NODE_OPTIONS).toBeUndefined();
      client.disconnect();
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
    }
  });
});
