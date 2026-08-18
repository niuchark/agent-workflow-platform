import { Test, TestingModule } from '@nestjs/testing';
import {
  RateLimiterService,
  CircuitBreakerService,
  DEFAULT_RATE_LIMITS,
} from '../rate-limit.guard';
import { RedisService } from '../../services/redis.service';

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let mockRedisService: any;

  beforeEach(async () => {
    mockRedisService = {
      rateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 59 }),
      getClient: jest.fn().mockReturnValue({
        incr: jest.fn().mockResolvedValue(1),
        decr: jest.fn().mockResolvedValue(0),
        expire: jest.fn().mockResolvedValue('OK'),
        set: jest.fn().mockResolvedValue('OK'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
    // Manually inject since we're using a string token
    (service as any).redisService = mockRedisService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkRateLimit', () => {
    it('should allow request when under limit', async () => {
      mockRedisService.rateLimit.mockResolvedValue({ allowed: true, remaining: 59 });
      const result = await service.checkRateLimit('test:key', DEFAULT_RATE_LIMITS['api:user']);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59);
    });

    it('should deny request when over limit', async () => {
      mockRedisService.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, retryAfter: 30 });
      const result = await service.checkRateLimit('test:key', DEFAULT_RATE_LIMITS['api:user']);
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
    });

    it('should allow request when Redis is down', async () => {
      mockRedisService.rateLimit.mockRejectedValue(new Error('Redis down'));
      const result = await service.checkRateLimit('test:key', DEFAULT_RATE_LIMITS['api:user']);
      expect(result.allowed).toBe(true);
    });
  });

  describe('acquireConcurrent', () => {
    it('should allow when under concurrent limit', async () => {
      const result = await service.acquireConcurrent('test:concurrent', 5);
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
    });

    it('should deny when at concurrent limit', async () => {
      const mockClient = mockRedisService.getClient();
      mockClient.incr.mockResolvedValueOnce(6); // Over limit
      const result = await service.acquireConcurrent('test:concurrent', 5);
      expect(result.allowed).toBe(false);
      expect(mockClient.decr).toHaveBeenCalled();
    });

    it('should allow when maxConcurrent is 0 (unlimited)', async () => {
      const result = await service.acquireConcurrent('test:concurrent', 0);
      expect(result.allowed).toBe(true);
    });
  });

  describe('releaseConcurrent', () => {
    it('should decrement counter', async () => {
      await service.releaseConcurrent('test:concurrent');
      const mockClient = mockRedisService.getClient();
      expect(mockClient.decr).toHaveBeenCalled();
    });

    it('should reset negative counter to 0', async () => {
      const mockClient = mockRedisService.getClient();
      mockClient.decr.mockResolvedValueOnce(-1);
      await service.releaseConcurrent('test:concurrent');
      expect(mockClient.set).toHaveBeenCalledWith('test:concurrent', '0', 'EX', 300);
    });
  });
});

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let mockRedisService: any;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue('OK'),
    };

    mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockClient),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    (service as any).redisService = mockRedisService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getState', () => {
    it('should return closed when no state exists', async () => {
      mockClient.get.mockResolvedValue(null);
      const state = await service.getState('test');
      expect(state).toBe('closed');
    });

    it('should return open when state is open and not yet expired', async () => {
      mockClient.get
        .mockResolvedValueOnce('open') // state
        .mockResolvedValueOnce(Date.now().toString()); // openedAt (recent)
      const state = await service.getState('test');
      expect(state).toBe('open');
    });

    it('should return half_open when open duration has passed', async () => {
      mockClient.get
        .mockResolvedValueOnce('open') // state
        .mockResolvedValueOnce((Date.now() - 60000).toString()); // openedAt (long ago)
      const state = await service.getState('test');
      expect(state).toBe('half_open');
    });
  });

  describe('isAllowed', () => {
    it('should allow when circuit is closed', async () => {
      mockClient.get.mockResolvedValue(null);
      const allowed = await service.isAllowed('test');
      expect(allowed).toBe(true);
    });

    it('should deny when circuit is open', async () => {
      mockClient.get
        .mockResolvedValueOnce('open')
        .mockResolvedValueOnce(Date.now().toString());
      const allowed = await service.isAllowed('test');
      expect(allowed).toBe(false);
    });
  });

  describe('recordSuccess', () => {
    it('should close circuit when in half_open state', async () => {
      mockClient.get.mockResolvedValue('half_open');
      await service.recordSuccess('test');
      expect(mockClient.set).toHaveBeenCalledWith('circuit:test:state', 'closed');
      expect(mockClient.del).toHaveBeenCalled();
    });

    it('should not change state when in closed state', async () => {
      mockClient.get.mockResolvedValue(null); // closed
      await service.recordSuccess('test');
      expect(mockClient.set).not.toHaveBeenCalledWith('circuit:test:state', expect.anything());
    });
  });

  describe('recordFailure', () => {
    it('should re-open circuit when in half_open state', async () => {
      mockClient.get.mockResolvedValue('half_open');
      mockClient.incr.mockResolvedValue(1);
      await service.recordFailure('test');
      // Should have called set for open state
      expect(mockClient.set).toHaveBeenCalled();
    });

    it('should open circuit when failures reach threshold', async () => {
      mockClient.get.mockResolvedValue(null); // closed
      mockClient.incr.mockResolvedValue(5); // Hit threshold
      await service.recordFailure('test');
      expect(mockClient.set).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should clear all circuit keys', async () => {
      await service.reset('test');
      expect(mockClient.del).toHaveBeenCalledTimes(4);
    });
  });

  describe('getStats', () => {
    it('should return circuit stats', async () => {
      mockClient.get
        .mockResolvedValueOnce(null) // getState -> closed
        .mockResolvedValueOnce('3') // failures
        .mockResolvedValueOnce(null); // openedAt
      const stats = await service.getStats('test');
      expect(stats.state).toBe('closed');
      expect(stats.failures).toBe(3);
      expect(stats.openedAt).toBeNull();
    });
  });
});
