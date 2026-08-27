/**
 * 应用模块：提供应用 CRUD、健康检查与限流监控接口。
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { RateLimitController } from './rate-limit.controller';
import { CircuitBreakerService } from '../../common/services/rate-limit.service';
import { AdminGuard } from '../../common/guards/admin.guard';

/** 应用模块：注册控制器与限流/熔断服务 */
@Module({
  controllers: [AppController, HealthController, RateLimitController],
  providers: [AppService, CircuitBreakerService, AdminGuard],
  exports: [CircuitBreakerService],
})
export class AppModule {}
