import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId: 'user-1' } }),
    }),
  } as ExecutionContext;
  const guard = new AdminGuard(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('allows a global administrator', async () => {
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'admin' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('rejects a regular member', async () => {
    prisma.user.findUnique.mockResolvedValue({ globalRole: 'member' });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
