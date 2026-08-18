import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { LLMProviderFactory } from '../providers/llm-provider.factory';
import { RecordTokenUsageDto, GetTokenUsageDto, GetCostReportDto } from '../dto/token-usage.dto';

@Injectable()
export class TokenUsageService {
  private readonly logger = new Logger(TokenUsageService.name);

  /** 批量写入缓冲区 */
  private buffer: RecordTokenUsageDto[] = [];
  /** 缓冲区刷新间隔 (ms) */
  private readonly FLUSH_INTERVAL = 10_000;
  /** 缓冲区最大条目 */
  private readonly BUFFER_MAX = 100;

  constructor(
    private prisma: PrismaService,
    private llmFactory: LLMProviderFactory,
  ) {
    // 定时刷新缓冲区
    setInterval(() => this.flush(), this.FLUSH_INTERVAL).unref();
  }

  // ============================================================
  // 记录使用量（内存缓冲 → 批量写入）
  // ============================================================

  /**
   * 记录一次 LLM 调用的 Token 使用量
   * 写入内存缓冲区，定时或达到阈值后批量刷入数据库
   */
  recordUsage(dto: RecordTokenUsageDto): void {
    // 自动计算成本（如果未提供）
    if (dto.cost === undefined || dto.cost === 0) {
      dto.cost = this.llmFactory.estimateCost(
        dto.model,
        dto.promptTokens,
        dto.completionTokens,
      );
    }

    if (!dto.callType) {
      dto.callType = 'chat' as any;
    }

    this.buffer.push(dto);

    // 达到缓冲区阈值立即刷入
    if (this.buffer.length >= this.BUFFER_MAX) {
      this.flush().catch((err) =>
        this.logger.error('Failed to flush token usage buffer', err),
      );
    }
  }

  /**
   * 便捷方法：从 LLMResponse 中提取并记录使用量
   */
  recordFromResponse(params: {
    userId: string;
    applicationId?: string;
    workflowId?: string;
    executionId?: string;
    provider: string;
    model: string;
    usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    callType?: 'chat' | 'embedding' | 'agent';
  }): void {
    this.recordUsage({
      userId: params.userId,
      applicationId: params.applicationId,
      workflowId: params.workflowId,
      executionId: params.executionId,
      provider: params.provider,
      model: params.model,
      promptTokens: params.usage.promptTokens,
      completionTokens: params.usage.completionTokens,
      totalTokens: params.usage.totalTokens,
      callType: params.callType as any,
    });
  }

  /**
   * 将缓冲区中的记录批量写入数据库
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    // 取出缓冲区数据，清空缓冲区
    const batch = this.buffer.splice(0, this.buffer.length);

    try {
      await this.prisma.tokenUsageRecord.createMany({
        data: batch.map((dto) => ({
          userId: dto.userId,
          applicationId: dto.applicationId || null,
          workflowId: dto.workflowId || null,
          executionId: dto.executionId || null,
          provider: dto.provider,
          model: dto.model,
          promptTokens: dto.promptTokens,
          completionTokens: dto.completionTokens,
          totalTokens: dto.totalTokens,
          cost: dto.cost || 0,
          callType: dto.callType || 'chat',
        })),
      });
      this.logger.debug(`Flushed ${batch.length} token usage records`);
    } catch (error) {
      this.logger.error('Failed to flush token usage records', error);
      // 写入失败时重新放回缓冲区（避免数据丢失）
      this.buffer.unshift(...batch);
    }
  }

  // ============================================================
  // 查询使用量
  // ============================================================

  /**
   * 查询 Token 使用量列表
   */
  async getUsage(userId: string, dto: GetTokenUsageDto) {
    const where: any = { userId };

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }
    if (dto.applicationId) where.applicationId = dto.applicationId;
    if (dto.model) where.model = dto.model;
    if (dto.provider) where.provider = dto.provider;
    if (dto.callType) where.callType = dto.callType;

    const [records, total] = await Promise.all([
      this.prisma.tokenUsageRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.tokenUsageRecord.count({ where }),
    ]);

    // 汇总统计
    const summary = await this.prisma.tokenUsageRecord.aggregate({
      where,
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        cost: true,
      },
      _count: true,
    });

    return {
      records,
      total,
      summary: {
        promptTokens: summary._sum.promptTokens || 0,
        completionTokens: summary._sum.completionTokens || 0,
        totalTokens: summary._sum.totalTokens || 0,
        cost: summary._sum.cost || 0,
        callCount: summary._count,
      },
    };
  }

  // ============================================================
  // 成本报表
  // ============================================================

  /**
   * 获取成本报表
   * 支持按 day/week/month/model/provider 分组
   */
  async getCostReport(userId: string, dto: GetCostReportDto) {
    const where: any = { userId };

    if (dto.startDate || dto.endDate) {
      where.createdAt = {};
      if (dto.startDate) where.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) where.createdAt.lte = new Date(dto.endDate);
    }
    if (dto.applicationId) where.applicationId = dto.applicationId;

    const groupBy = dto.groupBy || 'day';

    // 使用原始 SQL 进行分组查询（Prisma 不支持 groupBy + date trunc）
    let groupExpr: string;
    switch (groupBy) {
      case 'day':
        groupExpr = `DATE("createdAt")`;
        break;
      case 'week':
        groupExpr = `DATE_TRUNC('week', "createdAt")`;
        break;
      case 'month':
        groupExpr = `DATE_TRUNC('month', "createdAt")`;
        break;
      case 'model':
        groupExpr = `"model"`;
        break;
      case 'provider':
        groupExpr = `"provider"`;
        break;
      default:
        groupExpr = `DATE("createdAt")`;
    }

    const whereClause = this.buildWhereClause(where);
    const query = `
      SELECT 
        ${groupExpr} AS "groupKey",
        SUM("promptTokens") AS "promptTokens",
        SUM("completionTokens") AS "completionTokens",
        SUM("totalTokens") AS "totalTokens",
        SUM("cost") AS "cost",
        COUNT(*) AS "callCount"
      FROM "token_usage_records"
      WHERE ${whereClause}
      GROUP BY ${groupExpr}
      ORDER BY "groupKey" ASC
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(query);

    // 总计
    const total = await this.prisma.tokenUsageRecord.aggregate({
      where,
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cost: true },
      _count: true,
    });

    return {
      groups: rows.map((r) => ({
        groupKey: r.groupKey instanceof Date ? r.groupKey.toISOString() : String(r.groupKey),
        promptTokens: Number(r.promptTokens),
        completionTokens: Number(r.completionTokens),
        totalTokens: Number(r.totalTokens),
        cost: Number(r.cost),
        callCount: Number(r.callCount),
      })),
      total: {
        promptTokens: total._sum.promptTokens || 0,
        completionTokens: total._sum.completionTokens || 0,
        totalTokens: total._sum.totalTokens || 0,
        cost: total._sum.cost || 0,
        callCount: total._count,
      },
    };
  }

  /**
   * 获取模型使用排行
   */
  async getModelRanking(userId: string, startDate?: string, endDate?: string) {
    const where: any = { userId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        "model",
        "provider",
        SUM("totalTokens") AS "totalTokens",
        SUM("cost") AS "cost",
        COUNT(*) AS "callCount"
      FROM "token_usage_records"
      WHERE "userId" = '${userId}'
      ${startDate ? `AND "createdAt" >= '${startDate}'` : ''}
      ${endDate ? `AND "createdAt" <= '${endDate}'` : ''}
      GROUP BY "model", "provider"
      ORDER BY "cost" DESC
      LIMIT 20
    `);

    return rows.map((r) => ({
      model: r.model,
      provider: r.provider,
      totalTokens: Number(r.totalTokens),
      cost: Number(r.cost),
      callCount: Number(r.callCount),
    }));
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 构建 SQL WHERE 子句
   */
  private buildWhereClause(where: any): string {
    const conditions: string[] = [];

    if (where.userId) conditions.push(`"userId" = '${where.userId}'`);

    if (where.createdAt) {
      if (where.createdAt.gte)
        conditions.push(`"createdAt" >= '${where.createdAt.gte.toISOString()}'`);
      if (where.createdAt.lte)
        conditions.push(`"createdAt" <= '${where.createdAt.lte.toISOString()}'`);
    }

    if (where.applicationId) conditions.push(`"applicationId" = '${where.applicationId}'`);

    return conditions.join(' AND ') || '1=1';
  }
}
