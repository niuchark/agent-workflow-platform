/**
 * 限流 & 熔断管理控制器
 * 提供运行时状态查询和配置管理
 */
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimiterService, CircuitBreakerService, DEFAULT_RATE_LIMITS } from '../../common/guards/rate-limit.guard';

@Controller('rate-limit')
@UseGuards(JwtAuthGuard)
export class RateLimitController {
  constructor(
    private readonly rateLimiterService: RateLimiterService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * 获取所有限流配置
   */
  @Get('config')
  getConfig() {
    return {
      limits: DEFAULT_RATE_LIMITS,
    };
  }

  /**
   * 获取用户剩余配额
   */
  @Get('quota/:userId')
  async getUserQuota(@Param('userId') userId: string) {
    const checks = await Promise.all(
      Object.entries(DEFAULT_RATE_LIMITS).map(async ([name, config]) => {
        const result = await this.rateLimiterService.checkRateLimit(
          `rate_limit:${name.replace(':', ':')}${name.includes('global') ? '' : `:${userId}`}`,
          config,
        );
        return {
          name,
          remaining: result.remaining,
          max: config.maxRequests,
          windowSeconds: config.windowSeconds,
        };
      }),
    );

    return { quotas: checks };
  }

  /**
   * 获取所有熔断器状态
   */
  @Get('circuit-breakers')
  async getCircuitBreakers() {
    const circuits = ['workflow', 'ai', 'knowledge_base'];
    const stats = await Promise.all(
      circuits.map(async (name) => ({
        name,
        ...(await this.circuitBreakerService.getStats(name)),
      })),
    );

    return { circuitBreakers: stats };
  }

  /**
   * 重置熔断器
   */
  @Post('circuit-breakers/:name/reset')
  async resetCircuitBreaker(@Param('name') name: string) {
    await this.circuitBreakerService.reset(name);
    return { success: true, message: `Circuit breaker [${name}] has been reset` };
  }
}
