import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health.controller';
import { RateLimitController } from './rate-limit.controller';
import { RateLimiterService, CircuitBreakerService } from '../../common/guards/rate-limit.guard';

@Module({
  controllers: [AppController, HealthController, RateLimitController],
  providers: [AppService, RateLimiterService, CircuitBreakerService],
  exports: [RateLimiterService, CircuitBreakerService],
})
export class AppModule {}
