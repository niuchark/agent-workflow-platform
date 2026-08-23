/**
 * MCP 服务：管理 MCP 服务器配置与活跃连接。
 *
 * 维护一个 serverId → McpClient 的连接池；
 * 连接/断开、工具列表查询与工具调用都先校验归属权。
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAbsolute } from 'path';
import { PrismaService } from '../../common/services/prisma.service';
import { McpClient, McpTool, McpToolResult } from './mcp-client';
import {
  CreateMcpServerDto,
  McpTransportType,
  UpdateMcpServerDto,
} from './dto/mcp.dto';

@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  // 活跃的 MCP Client 连接池：key = serverId
  private clients = new Map<string, McpClient>();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // ========== CRUD ==========

  /** 创建 MCP 服务器：按传输方式校验必填字段 */
  async create(userId: string, dto: CreateMcpServerDto) {
    const transportType = dto.transportType ?? McpTransportType.STDIO;
    this.validateTransportConfig(transportType, dto.command, dto.url);
    this.validateEnvironment(dto.env);

    return this.prisma.mcpServer.create({
      data: {
        name: dto.name,
        description: dto.description,
        transportType,
        command: dto.command,
        args: dto.args ? JSON.stringify(dto.args) : null,
        env: dto.env ? JSON.stringify(dto.env) : null,
        url: dto.url,
        userId,
      },
    });
  }

  /** 获取用户的所有服务器（附带连接状态） */
  async findAll(userId: string) {
    const servers = await this.prisma.mcpServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // 附加连接状态
    return servers.map((s) => ({
      ...s,
      args: s.args ? JSON.parse(s.args) : [],
      env: s.env ? JSON.parse(s.env) : {},
      isConnected: this.clients.has(s.id) && this.clients.get(s.id)!.isConnected(),
    }));
  }

  /** 获取单个服务器（校验归属权，附带连接状态） */
  async findOne(userId: string, id: string) {
    const server = await this.prisma.mcpServer.findUnique({ where: { id } });
    if (!server || server.userId !== userId) {
      throw new NotFoundException('MCP 服务器不存在');
    }
    return {
      ...server,
      args: server.args ? JSON.parse(server.args) : [],
      env: server.env ? JSON.parse(server.env) : {},
      isConnected: this.clients.has(id) && this.clients.get(id)!.isConnected(),
    };
  }

  /** 更新服务器：配置变更前先断开旧连接 */
  async update(userId: string, id: string, dto: UpdateMcpServerDto) {
    const existing = await this.findOne(userId, id);
    const transportType = dto.transportType ?? existing.transportType;
    this.validateTransportConfig(
      transportType,
      dto.command === undefined ? existing.command ?? undefined : dto.command,
      dto.url === undefined ? existing.url ?? undefined : dto.url,
    );
    this.validateEnvironment(dto.env);

    // 如果正在连接，先断开
    if (this.clients.has(id)) {
      this.clients.get(id)!.disconnect();
      this.clients.delete(id);
    }

    return this.prisma.mcpServer.update({
      where: { id },
      data: {
        ...dto,
        args: dto.args ? JSON.stringify(dto.args) : undefined,
        env: dto.env ? JSON.stringify(dto.env) : undefined,
      },
    });
  }

  /** 删除服务器：先断开连接 */
  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    // 断开连接
    if (this.clients.has(id)) {
      this.clients.get(id)!.disconnect();
      this.clients.delete(id);
    }

    return this.prisma.mcpServer.delete({ where: { id } });
  }

  // ========== 连接管理 ==========

  /**
   * 连接到指定 MCP Server
   */
  async connectServer(userId: string, serverId: string): Promise<{ tools: McpTool[] }> {
    const server = await this.findOne(userId, serverId);

    if (server.transportType !== 'stdio') {
      throw new BadRequestException('当前仅支持 stdio 传输方式');
    }

    if (!server.command) {
      throw new BadRequestException('MCP 服务器未配置启动命令');
    }

    if (!server.isActive) {
      throw new BadRequestException('MCP 服务器已停用');
    }

    this.assertStdioExecutionAllowed(server.command);

    // 如果已连接，先断开
    if (this.clients.has(serverId)) {
      this.clients.get(serverId)!.disconnect();
    }

    const args = Array.isArray(server.args) ? server.args : [];
    const env = typeof server.env === 'object' && server.env ? server.env : {};

    const client = new McpClient(server.command, args, env as Record<string, string>);

    try {
      await client.connect();
      this.clients.set(serverId, client);
      this.logger.log(`MCP Server "${server.name}" 连接成功`);

      const tools = await client.listTools();
      return { tools };
    } catch (err) {
      client.disconnect();
      this.logger.warn(
        `MCP Server "${server.name}" 连接失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(`连接 MCP Server "${server.name}" 失败`);
    }
  }

  /**
   * 断开指定 MCP Server
   */
  async disconnectServer(userId: string, serverId: string): Promise<void> {
    await this.findOne(userId, serverId);

    if (this.clients.has(serverId)) {
      this.clients.get(serverId)!.disconnect();
      this.clients.delete(serverId);
      this.logger.log(`MCP Server ${serverId} 已断开`);
    }
  }

  // ========== 工具操作 ==========

  /**
   * 获取已连接服务器的工具列表
   */
  async listTools(userId: string, serverId: string): Promise<McpTool[]> {
    await this.findOne(userId, serverId);

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      throw new BadRequestException('MCP Server 未连接，请先连接');
    }

    return client.listTools();
  }

  /**
   * 调用 MCP 工具
   */
  async callTool(
    userId: string,
    serverId: string,
    toolName: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolResult> {
    await this.findOne(userId, serverId);

    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      throw new BadRequestException('MCP Server 未连接，请先连接');
    }

    try {
      return await client.callTool(toolName, args);
    } catch (err) {
      this.logger.warn(
        `MCP 工具 "${toolName}" 调用失败: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException(`调用工具 "${toolName}" 失败`);
    }
  }

  /**
   * 获取所有已连接服务器的所有工具（聚合）
   */
  async listAllTools(userId: string): Promise<Array<McpTool & { serverId: string; serverName: string }>> {
    const servers = await this.findAll(userId);
    const allTools: Array<McpTool & { serverId: string; serverName: string }> = [];

    for (const server of servers) {
      const client = this.clients.get(server.id);
      if (client && client.isConnected()) {
        try {
          const tools = await client.listTools();
          for (const tool of tools) {
            allTools.push({ ...tool, serverId: server.id, serverName: server.name });
          }
        } catch {
          // 跳过出错的服务器
        }
      }
    }

    return allTools;
  }

  /**
   * 应用关闭时清理所有连接
   */
  /** 应用关闭时清理所有活跃连接 */
  onModuleDestroy() {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }

  private validateTransportConfig(
    transportType: string,
    command?: string,
    url?: string,
  ): void {
    if (transportType === McpTransportType.STDIO && !command?.trim()) {
      throw new BadRequestException('stdio 模式必须提供启动命令 (command)');
    }
    if (transportType === McpTransportType.SSE && !url?.trim()) {
      throw new BadRequestException('SSE 模式必须提供服务器 URL');
    }
  }

  private validateEnvironment(env?: Record<string, string>): void {
    if (!env) return;
    const entries = Object.entries(env);
    if (entries.length > 64) {
      throw new BadRequestException('MCP 环境变量数量不能超过 64 个');
    }
    for (const [key, value] of entries) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== 'string' || value.length > 4096) {
        throw new BadRequestException(`MCP 环境变量格式无效: ${key}`);
      }
    }
  }

  /** Stdio is disabled unless the deployment opts in to an exact executable. */
  private assertStdioExecutionAllowed(command: string): void {
    if (!this.configService.get<boolean>('MCP_STDIO_ENABLED', false)) {
      throw new ServiceUnavailableException('当前部署未启用 stdio MCP');
    }

    const allowedCommands = new Set(
      (this.configService.get<string>('MCP_STDIO_COMMAND_ALLOWLIST', '') || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    );
    if (!isAbsolute(command) || !allowedCommands.has(command)) {
      throw new ForbiddenException('MCP 启动命令不在部署白名单中');
    }
  }
}
