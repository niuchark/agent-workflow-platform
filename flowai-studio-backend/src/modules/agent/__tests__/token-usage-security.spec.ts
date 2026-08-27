import { TokenUsageController } from '../controllers/token-usage.controller';
import { TokenUsageService } from '../services/token-usage.service';

describe('Token usage tenant isolation', () => {
  describe('TokenUsageController', () => {
    const tokenUsageService = {
      getUsage: jest.fn(),
      getCostReport: jest.fn(),
      getModelRanking: jest.fn(),
    };
    const controller = new TokenUsageController(tokenUsageService as any);

    beforeEach(() => jest.clearAllMocks());

    it('passes the JWT userId to every query', async () => {
      await controller.getUsage('jwt-user', {});
      await controller.getCostReport('jwt-user', {});
      await controller.getModelRanking('jwt-user', {
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T23:59:59.000Z',
      });

      expect(tokenUsageService.getUsage).toHaveBeenCalledWith('jwt-user', {});
      expect(tokenUsageService.getCostReport).toHaveBeenCalledWith('jwt-user', {});
      expect(tokenUsageService.getModelRanking).toHaveBeenCalledWith(
        'jwt-user',
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T23:59:59.000Z',
      );
    });
  });

  describe('TokenUsageService parameterized reports', () => {
    let service: TokenUsageService;
    let prisma: any;

    beforeEach(() => {
      prisma = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        tokenUsageRecord: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: {
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              cost: 0,
            },
            _count: 0,
          }),
        },
      };
      service = new TokenUsageService(prisma, {
        estimateCost: jest.fn(),
      } as any);
    });

    it('binds user and application filters instead of interpolating them', async () => {
      const userId = `user' OR 1=1 --`;
      const applicationId = `app' OR "applicationId" IS NOT NULL --`;

      await service.getCostReport(userId, {
        applicationId,
        startDate: '2026-01-01T00:00:00.000Z',
        groupBy: 'day',
      });

      const query = prisma.$queryRaw.mock.calls[0][0];
      const sqlText = query.strings.join('');
      expect(sqlText).not.toContain(userId);
      expect(sqlText).not.toContain(applicationId);
      expect(query.values).toEqual(expect.arrayContaining([userId, applicationId, expect.any(Date)]));
      expect(prisma.tokenUsageRecord.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId, applicationId }),
        }),
      );
    });

    it('binds ranking dates and userId instead of interpolating them', async () => {
      const userId = `user'; DROP TABLE "token_usage_records"; --`;
      const startDate = '2026-01-01T00:00:00.000Z';
      const endDate = '2026-02-01T00:00:00.000Z';

      await service.getModelRanking(userId, startDate, endDate);

      const query = prisma.$queryRaw.mock.calls[0][0];
      const sqlText = query.strings.join('');
      expect(sqlText).not.toContain(userId);
      expect(sqlText).not.toContain(startDate);
      expect(sqlText).not.toContain(endDate);
      expect(query.values).toEqual([userId, new Date(startDate), new Date(endDate)]);
    });
  });
});
