/**
 * 应用模块：提供应用 CRUD、健康检查与限流监控接口。
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { RateLimitController } from './rate-limit.controller';
import { RateLimiterService, CircuitBreakerService } from '../../common/guards/rate-limit.guard';

/** 应用模块：注册控制器与限流/熔断服务 */
@Module({
  controllers: [AppController, HealthController, RateLimitController],
  providers: [AppService, RateLimiterService, CircuitBreakerService],
  exports: [RateLimiterService, CircuitBreakerService],
})
export class AppModule {}
