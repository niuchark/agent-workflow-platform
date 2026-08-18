import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { PrismaService } from '../services/prisma.service';
import { PERMISSIONS } from '../constants/permissions';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let prisma: any;
  let reflector: Reflector;

  const mockPrismaService = {
    user: { findUnique: jest.fn() },
    application: { findUnique: jest.fn() },
    teamApplication: { findFirst: jest.fn() },
    teamMember: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionGuard,
        Reflector,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<PermissionGuard>(PermissionGuard);
    prisma = module.get(PrismaService);
    reflector = module.get(Reflector);

    Object.values(mockPrismaService).forEach((obj: any) =>
      Object.values(obj).forEach((fn: any) => fn.mockReset()),
    );
  });

  const createMockContext = (userId?: string, params?: any) => ({
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { userId } : undefined,
        params: params || {},
      }),
    }),
    getHandler: () => 'testHandler',
  });

  describe('canActivate', () => {
    it('should allow access if no permissions required', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue(null);
      const context = createMockContext('user-1');
      expect(await guard.canActivate(context as any)).toBe(true);
    });

    it('should throw ForbiddenException if user not identified', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.APP_READ]);
      const context = createMockContext();
      await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
    });

    it('should allow access for admin globalRole', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.APP_READ]);
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'admin' });

      const context = createMockContext('admin-1', { id: 'app-1' });
      expect(await guard.canActivate(context as any)).toBe(true);
    });

    it('should allow access for resource owner', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.APP_READ]);
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'member' });
      prisma.application.findUnique.mockResolvedValue({ userId: 'user-1' });

      const context = createMockContext('user-1', { id: 'app-1' });
      expect(await guard.canActivate(context as any)).toBe(true);
    });

    it('should allow access via team membership with sufficient role', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.APP_READ]);
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'member' });
      prisma.application.findUnique.mockResolvedValue({ userId: 'owner-1' });
      prisma.teamApplication.findFirst.mockResolvedValue({
        permission: 'can_edit',
        team: { members: [{ role: 'editor' }] },
      });

      const context = createMockContext('user-1', { id: 'app-1' });
      expect(await guard.canActivate(context as any)).toBe(true);
    });

    it('should throw ForbiddenException if no access path found', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.APP_DELETE]);
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'member' });
      prisma.application.findUnique.mockResolvedValue({ userId: 'owner-1' });
      prisma.teamApplication.findFirst.mockResolvedValue(null);

      const context = createMockContext('user-1', { id: 'app-1' });
      await expect(guard.canActivate(context as any)).rejects.toThrow(ForbiddenException);
    });

    it('should check teamId for team-level permissions', async () => {
      jest.spyOn(reflector, 'get').mockReturnValue([PERMISSIONS.TEAM_UPDATE]);
      prisma.user.findUnique.mockResolvedValue({ globalRole: 'member' });
      prisma.teamMember.findUnique.mockResolvedValue({ role: 'admin' });

      const context = createMockContext('user-1', { teamId: 'team-1' });
      expect(await guard.canActivate(context as any)).toBe(true);
    });
  });
});
