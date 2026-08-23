/**
 * 健康检查控制器：Docker HEALTHCHECK / K8s 探针 / 监控面板使用。
 */
import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { CacheService } from '../../common/services/cache.service';

/**
 * 健康检查控制器
 * 用于 Docker HEALTHCHECK、K8s liveness/readiness probe、监控面板
 *
 * Phase 2.4 增强:
 * - 新增缓存系统健康检查（L1 + L2 状态、命中率统计）
 *
 * 竞品对标:
 * - Dify: /health 端点检查 DB + Redis + 向量库
 * - n8n: /healthz 端点
 * - FastGPT: /api/health 端点
 * - 本设计: DB + Redis + pgvector + 多级缓存状态 + 命中率统计
 */
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private cacheService: CacheService,
  ) {}

  /** 综合健康检查：数据库 / Redis / pgvector / 多级缓存 */
  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    const checks: Record<string, any> = {};
    let isHealthy = true;

    // 1. 数据库健康检查
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = { status: 'healthy' };
    } catch {
      checks.database = { status: 'unhealthy' };
      isHealthy = false;
    }

    // 2. Redis 健康检查
    try {
      const redisHealth = await this.redisService.healthCheck();
      checks.redis = redisHealth;
      if (redisHealth.status !== 'healthy') isHealthy = false;
    } catch {
      checks.redis = { status: 'unhealthy' };
      isHealthy = false;
    }

    // 3. pgvector 扩展检查
    try {
      const result = await this.prisma.$queryRaw`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'`;
      checks.pgvector = Array.isArray(result) && result.length > 0
        ? { status: 'healthy', version: result[0].extversion }
        : { status: 'unhealthy', message: 'pgvector extension not installed' };
      if (checks.pgvector.status !== 'healthy') isHealthy = false;
    } catch {
      checks.pgvector = { status: 'unhealthy' };
      isHealthy = false;
    }

    // 4. 多级缓存健康检查
    try {
      const cacheHealth = await this.cacheService.healthCheck();
      checks.cache = cacheHealth;
      if (cacheHealth.status === 'unhealthy') isHealthy = false;
    } catch {
      checks.cache = { status: 'unhealthy' };
      isHealthy = false;
    }

    response.status(isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /** 进程存活探针：不依赖外部服务，避免故障时被无意义重启。 */
  @Get('live')
  live() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  /**
   * 缓存统计端点 — 用于监控面板
   *
   * Phase 2.4 新增:
   * - L1/L2 命中率、缓存大小、回源次数
   * - 互斥锁竞争统计
   */
  /** 缓存统计端点：L1/L2 命中率与缓存大小 */
  @Get('cache-stats')
  getCacheStats() {
    return this.cacheService.getStats();
  }
}
