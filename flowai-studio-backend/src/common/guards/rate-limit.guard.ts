/**
 * 限流 + 熔断模块
 *
 * 竞品对比:
 * - Dify: Redis Rate Limiting + 每租户并发限制
 * - Coze: 多级限流 (API级/用户级/租户级)
 * - n8n: ThrottlerModule + Redis 存储
 * - 本设计: Redis 令牌桶 + 并发工作流控制 + CircuitBreaker + RateLimitGuard
 */
import {
  Injectable,
  NestMiddleware,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../services/redis.service';

// ============================================================
// 限流配置
// ============================================================

export interface RateLimitConfig {
  /** 窗口时间（秒） */
  windowSeconds: number;
  /** 窗口内最大请求数 */
  maxRequests: number;
  /** 并发执行上限（0 = 不限制） */
  maxConcurrent?: number;
}

/** 默认限流配置 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // API 全局限流
  'api:global': { windowSeconds: 60, maxRequests: 300 },
  // 每用户 API 限流
  'api:user': { windowSeconds: 60, maxRequests: 60 },
  // 工作流执行限流
  'workflow:run': { windowSeconds: 60, maxRequests: 20, maxConcurrent: 5 },
  // AI 模型调用限流
  'ai:call': { windowSeconds: 60, maxRequests: 30 },
  // 知识库操作限流
  'kb:operation': { windowSeconds: 60, maxRequests: 30 },
};

// ============================================================
// 令牌桶限流服务
// ============================================================

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly concurrentMap = new Map<string, number>();

  constructor(private readonly redisService: RedisService) {}

  /**
   * 令牌桶限流检查
   * Redis Lua 脚本保证原子性
   *
   * @param key 限流键 (如 rate_limit:workflow:run:userId)
   * @param config 限流配置
   * @returns 是否允许 + 剩余配额 + 重试等待时间
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig,
  ): Promise<{ allowed: boolean; remaining: number; retryAfter?: number }> {
    try {
      const result = await this.redisService.rateLimit(
        key,
        config.windowSeconds,
        config.maxRequests,
      );
      return result;
    } catch (error) {
      // Redis 不可用时降级：允许请求通过
      this.logger.warn(`Rate limit check failed for ${key}, allowing request: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { allowed: true, remaining: config.maxRequests };
    }
  }

  /**
   * 并发执行控制
   * 使用 Redis INCR/DECR 保证分布式一致性
   */
  async acquireConcurrent(key: string, maxConcurrent: number): Promise<{ allowed: boolean; current: number }> {
    if (maxConcurrent <= 0) return { allowed: true, current: 0 };

    try {
      const client = this.redisService.getClient();
      const current = await client.incr(key);

      // 首次设置 TTL（5分钟自动清理，防止泄漏）
      if (current === 1) {
        await client.expire(key, 300);
      }

      if (current > maxConcurrent) {
        // 超限，回退
        await client.decr(key);
        return { allowed: false, current: current - 1 };
      }

      return { allowed: true, current };
    } catch (error) {
      this.logger.warn(`Concurrent check failed for ${key}, allowing: ${error instanceof Error ? error.message : 'Unknown'}`);
      return { allowed: true, current: 0 };
    }
  }

  /**
   * 释放并发配额
   */
  async releaseConcurrent(key: string): Promise<void> {
    try {
      const client = this.redisService.getClient();
      const current = await client.decr(key);
      // 防止负数
      if (current < 0) {
        await client.set(key, '0', 'EX', 300);
      }
    } catch (error) {
      this.logger.warn(`Concurrent release failed for ${key}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

// ============================================================
// 熔断器服务
// ============================================================

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** 触发熔断的失败次数 */
  failureThreshold: number;
  /** 统计窗口时间（秒） */
  windowSeconds: number;
  /** 熔断持续时间（秒），之后进入半开状态 */
  openDuration: number;
  /** 半开状态允许通过的请求数 */
  halfOpenMaxRequests: number;
}

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowSeconds: 60,
  openDuration: 30,
  halfOpenMaxRequests: 3,
};

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * 获取熔断器状态
   * Redis Key: circuit:{name}:state / circuit:{name}:failures / circuit:{name}:openedAt
   */
  async getState(name: string): Promise<CircuitState> {
    const client = this.redisService.getClient();
    const stateKey = `circuit:${name}:state`;

    try {
      const state = await client.get(stateKey);
      if (!state) return 'closed';

      if (state === 'open') {
        // 检查是否超过 openDuration，进入 half_open
        const openedAt = await client.get(`circuit:${name}:openedAt`);
        const config = await this.getConfig(name);
        if (openedAt && Date.now() - Number(openedAt) > config.openDuration * 1000) {
          await client.set(stateKey, 'half_open', 'EX', config.openDuration);
          return 'half_open';
        }
        return 'open';
      }

      return state as CircuitState;
    } catch {
      return 'closed';
    }
  }

  /**
   * 检查请求是否被允许通过
   */
  async isAllowed(name: string): Promise<boolean> {
    const state = await this.getState(name);

    if (state === 'closed') return true;

    if (state === 'open') return false;

    // half_open: 限制允许的请求数
    if (state === 'half_open') {
      try {
        const client = this.redisService.getClient();
        const config = await this.getConfig(name);
        const halfOpenKey = `circuit:${name}:halfOpenCount`;
        const count = await client.incr(halfOpenKey);

        if (count === 1) {
          await client.expire(halfOpenKey, config.openDuration);
        }

        return count <= config.halfOpenMaxRequests;
      } catch {
        return true;
      }
    }

    return true;
  }

  /**
   * 记录成功
   */
  async recordSuccess(name: string): Promise<void> {
    const client = this.redisService.getClient();
    const state = await this.getState(name);

    if (state === 'half_open') {
      // 半开状态成功 → 关闭熔断器
      this.logger.log(`Circuit [${name}] recovered: half_open -> closed`);
      await client.set(`circuit:${name}:state`, 'closed');
      await client.del(`circuit:${name}:failures`);
      await client.del(`circuit:${name}:openedAt`);
      await client.del(`circuit:${name}:halfOpenCount`);
    }
  }

  /**
   * 记录失败
   */
  async recordFailure(name: string): Promise<void> {
    const client = this.redisService.getClient();
    const config = await this.getConfig(name);

    try {
      const failures = await client.incr(`circuit:${name}:failures`);
      if (failures === 1) {
        await client.expire(`circuit:${name}:failures`, config.windowSeconds);
      }

      const state = await this.getState(name);

      if (state === 'half_open') {
        // 半开状态失败 → 重新打开熔断器
        this.logger.warn(`Circuit [${name}] re-opened: half_open -> open`);
        await this.openCircuit(name);
        return;
      }

      if (state === 'closed' && failures >= config.failureThreshold) {
        // 达到阈值 → 打开熔断器
        this.logger.warn(`Circuit [${name}] opened: failures=${failures} >= threshold=${config.failureThreshold}`);
        await this.openCircuit(name);
      }
    } catch (error) {
      this.logger.error(`Failed to record circuit failure: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * 获取熔断器统计信息
   */
  async getStats(name: string): Promise<{
    state: CircuitState;
    failures: number;
    openedAt: number | null;
  }> {
    const client = this.redisService.getClient();
    const state = await this.getState(name);
    const failures = Number(await client.get(`circuit:${name}:failures`)) || 0;
    const openedAt = await client.get(`circuit:${name}:openedAt`);

    return {
      state,
      failures,
      openedAt: openedAt ? Number(openedAt) : null,
    };
  }

  /**
   * 重置熔断器
   */
  async reset(name: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.del(`circuit:${name}:state`);
    await client.del(`circuit:${name}:failures`);
    await client.del(`circuit:${name}:openedAt`);
    await client.del(`circuit:${name}:halfOpenCount`);
    this.logger.log(`Circuit [${name}] manually reset`);
  }

  private async openCircuit(name: string): Promise<void> {
    const client = this.redisService.getClient();
    const config = await this.getConfig(name);
    await client.set(`circuit:${name}:state`, 'open', 'EX', config.openDuration);
    await client.set(`circuit:${name}:openedAt`, Date.now().toString(), 'EX', config.openDuration);
  }

  private async getConfig(name: string): Promise<CircuitBreakerConfig> {
    // 可扩展: 从数据库/配置中心读取每个熔断器的配置
    return DEFAULT_CIRCUIT_CONFIG;
  }
}

// ============================================================
// 限流中间件
// ============================================================

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly rateLimiterService: RateLimiterService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // 从 JWT 中获取用户 ID（如果有）
    const userId = (req as any).user?.userId || 'anonymous';
    const path = req.path;

    // 1. 全局限流
    const globalResult = await this.rateLimiterService.checkRateLimit(
      'rate_limit:api:global',
      DEFAULT_RATE_LIMITS['api:global'],
    );
    if (!globalResult.allowed) {
      res.status(429).json({
        statusCode: 429,
        message: '请求过于频繁，请稍后再试',
        retryAfter: globalResult.retryAfter,
      });
      return;
    }

    // 2. 用户级限流
    const userResult = await this.rateLimiterService.checkRateLimit(
      `rate_limit:api:user:${userId}`,
      DEFAULT_RATE_LIMITS['api:user'],
    );
    if (!userResult.allowed) {
      res.status(429).json({
        statusCode: 429,
        message: '您的请求过于频繁，请稍后再试',
        retryAfter: userResult.retryAfter,
      });
      return;
    }

    // 3. 设置限流响应头
    res.setHeader('X-RateLimit-Remaining', userResult.remaining.toString());

    // 4. 工作流执行特殊限流 + 熔断
    if (path.includes('/workflows/') && path.includes('/run')) {
      const workflowConfig = DEFAULT_RATE_LIMITS['workflow:run'];

      // 限流检查
      const workflowResult = await this.rateLimiterService.checkRateLimit(
        `rate_limit:workflow:run:${userId}`,
        workflowConfig,
      );
      if (!workflowResult.allowed) {
        res.status(429).json({
          statusCode: 429,
          message: '工作流执行请求过于频繁，请稍后再试',
          retryAfter: workflowResult.retryAfter,
        });
        return;
      }

      // 熔断检查
      const circuitAllowed = await this.circuitBreakerService.isAllowed('workflow');
      if (!circuitAllowed) {
        res.status(503).json({
          statusCode: 503,
          message: '服务暂时不可用，工作流执行已被熔断保护',
        });
        return;
      }
    }

    // 5. AI 模型调用限流
    if (path.includes('/ai/') || path.includes('/chat')) {
      const aiResult = await this.rateLimiterService.checkRateLimit(
        `rate_limit:ai:call:${userId}`,
        DEFAULT_RATE_LIMITS['ai:call'],
      );
      if (!aiResult.allowed) {
        res.status(429).json({
          statusCode: 429,
          message: 'AI 模型调用过于频繁，请稍后再试',
          retryAfter: aiResult.retryAfter,
        });
        return;
      }
    }

    next();
  }
}
