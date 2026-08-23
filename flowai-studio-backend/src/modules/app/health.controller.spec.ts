import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { CacheService } from '../../common/services/cache.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const redis = { healthCheck: jest.fn() };
  const cache = { healthCheck: jest.fn(), getStats: jest.fn() };
  const response = { status: jest.fn() };
  let controller: HealthController;

  beforeEach(() => {
    jest.clearAllMocks();
    response.status.mockReturnValue(response);
    controller = new HealthController(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      cache as unknown as CacheService,
    );
  });

  it('returns 200 when required dependencies are ready', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ extname: 'vector', extversion: '0.8.0' }]);
    redis.healthCheck.mockResolvedValue({ status: 'healthy', latency: 1 });
    cache.healthCheck.mockResolvedValue({ status: 'healthy' });

    const result = await controller.check(response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(result.status).toBe('healthy');
  });

  it('returns 503 without leaking an internal dependency error', async () => {
    prisma.$queryRaw
      .mockRejectedValueOnce(new Error('postgresql://user:password@private-host'))
      .mockResolvedValueOnce([{ extname: 'vector', extversion: '0.8.0' }]);
    redis.healthCheck.mockResolvedValue({ status: 'healthy', latency: 1 });
    cache.healthCheck.mockResolvedValue({ status: 'healthy' });

    const result = await controller.check(response as unknown as Response);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result.status).toBe('degraded');
    expect(result.checks.database).toEqual({ status: 'unhealthy' });
  });

  it('provides an external-dependency-free liveness response', () => {
    expect(controller.live().status).toBe('healthy');
  });
});
