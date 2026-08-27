/**
 * 限流 & 熔断管理控制器
 * 提供运行时状态查询和配置管理
 */
import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CircuitBreakerService, DEFAULT_RATE_LIMITS } from '../../common/services/rate-limit.service';

@Controller('rate-limit')
@UseGuards(JwtAuthGuard, AdminGuard)
export class RateLimitController {
  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /** 获取所有限流配置 */
  @Get('config')
  getConfig() {
    return {
      limits: DEFAULT_RATE_LIMITS,
    };
  }

  /** 获取所有熔断器状态 */
  @Get('circuit-breakers')
  async getCircuitBreakers() {
    const circuits = ['workflow'];
    const stats = await Promise.all(
      circuits.map(async (name) => ({
        name,
        ...(await this.circuitBreakerService.getStats(name)),
      })),
    );

    return { circuitBreakers: stats };
  }

  /** 重置指定熔断器 */
  @Post('circuit-breakers/:name/reset')
  async resetCircuitBreaker(@Param('name') name: string) {
    await this.circuitBreakerService.reset(name);
    return { success: true, message: `Circuit breaker [${name}] has been reset` };
  }
}
