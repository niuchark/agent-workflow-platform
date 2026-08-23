import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/services/prisma.service';
import { McpService } from './mcp.service';

describe('McpService security boundaries', () => {
  const prisma = {
    mcpServer: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const config = { get: jest.fn() };
  let service: McpService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new McpService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
  });

  it('requires a command when stdio is the default transport', async () => {
    await expect(service.create('user-1', { name: 'server' })).rejects.toThrow(
      'stdio 模式必须提供启动命令',
    );
  });

  it('does not reveal another user server', async () => {
    prisma.mcpServer.findUnique.mockResolvedValue({ id: 'server-1', userId: 'user-2' });
    await expect(service.findOne('user-1', 'server-1')).rejects.toThrow(NotFoundException);
  });

  it('keeps local process execution disabled by default', async () => {
    prisma.mcpServer.findUnique.mockResolvedValue({
      id: 'server-1',
      userId: 'user-1',
      name: 'server',
      transportType: 'stdio',
      command: '/opt/flowai/mcp-server',
      args: '[]',
      env: null,
      isActive: true,
    });
    config.get.mockImplementation((_key: string, fallback: unknown) => fallback);

    await expect(service.connectServer('user-1', 'server-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('requires an exact absolute executable from the deployment allowlist', async () => {
    prisma.mcpServer.findUnique.mockResolvedValue({
      id: 'server-1',
      userId: 'user-1',
      name: 'server',
      transportType: 'stdio',
      command: '/tmp/untrusted-server',
      args: '[]',
      env: null,
      isActive: true,
    });
    config.get.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'MCP_STDIO_ENABLED') return true;
      if (key === 'MCP_STDIO_COMMAND_ALLOWLIST') return '/opt/flowai/mcp-server';
      return fallback;
    });

    await expect(service.connectServer('user-1', 'server-1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
