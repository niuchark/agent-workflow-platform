import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { TeamService } from './team.service';
import { PrismaService } from '../../../common/services/prisma.service';

describe('TeamService', () => {
  let service: TeamService;
  let prisma: any;

  const mockPrismaService = {
    team: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    teamApplication: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    application: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TeamService>(TeamService);
    prisma = module.get(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService).forEach((obj) =>
      Object.values(obj).forEach((fn) => fn.mockReset()),
    );
  });

  // ============================================================
  // 团队 CRUD
  // ============================================================

  describe('create', () => {
    it('should create a team with owner as member', async () => {
      const dto = { name: 'Test Team', description: 'A test team' };
      const created = {
        id: 'team-1',
        ...dto,
        avatar: null,
        ownerId: 'user-1',
        members: [{ id: 'member-1', userId: 'user-1', role: 'owner', joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.team.create.mockResolvedValue(created);

      const result = await service.create('user-1', dto);
      expect(result.name).toBe('Test Team');
      expect(result.ownerId).toBe('user-1');
      expect(prisma.team.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ownerId: 'user-1',
            members: { create: { userId: 'user-1', role: 'owner' } },
          }),
        }),
      );
    });
  });

  describe('listMyTeams', () => {
    it('should list teams the user belongs to', async () => {
      const teams = [
        {
          id: 'team-1',
          name: 'Team A',
          description: null,
          avatar: null,
          members: [{ role: 'owner' }],
          _count: { members: 3, teamApplications: 2 },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.team.findMany.mockResolvedValue(teams);

      const result = await service.listMyTeams('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].myRole).toBe('owner');
      expect(result[0].memberCount).toBe(3);
      expect(result[0].appCount).toBe(2);
    });
  });

  describe('getTeam', () => {
    it('should throw NotFoundException for non-existent team', async () => {
      prisma.team.findUnique.mockResolvedValue(null);
      await expect(service.getTeam('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not a member', async () => {
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        members: [],
        teamApplications: [],
      });
      await expect(service.getTeam('user-1', 'team-1')).rejects.toThrow(ForbiddenException);
    });

    it('should return team details for a member', async () => {
      const team = {
        id: 'team-1',
        name: 'Team A',
        description: 'desc',
        avatar: null,
        ownerId: 'owner-1',
        members: [{ userId: 'user-1', role: 'editor', joinedAt: new Date(), user: { id: 'user-1', username: 'test', avatar: null } }],
        teamApplications: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.team.findUnique.mockResolvedValue(team);

      const result = await service.getTeam('user-1', 'team-1');
      expect(result.myRole).toBe('editor');
    });
  });

  describe('delete', () => {
    it('should throw ForbiddenException if not owner', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'owner-1' });
      await expect(service.delete('user-1', 'team-1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete team if owner', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'owner-1' });
      prisma.team.delete.mockResolvedValue({ id: 'team-1' });

      const result = await service.delete('owner-1', 'team-1');
      expect(result.success).toBe(true);
      expect(prisma.team.delete).toHaveBeenCalledWith({ where: { id: 'team-1' } });
    });
  });

  // ============================================================
  // 成员管理
  // ============================================================

  describe('addMember', () => {
    it('should throw ConflictException if user is already a member', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'admin-1' });
      prisma.teamMember.findUnique.mockResolvedValue({ id: 'member-1' });
      await expect(service.addMember('admin-1', 'team-1', { userId: 'user-2', role: 'editor' })).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if adding self', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'user-1' });
      prisma.teamMember.findUnique.mockResolvedValue(null);
      await expect(service.addMember('user-1', 'team-1', { userId: 'user-1', role: 'editor' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('leaveTeam', () => {
    it('should throw BadRequestException if owner tries to leave', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'owner-1' });
      await expect(service.leaveTeam('owner-1', 'team-1')).rejects.toThrow(BadRequestException);
    });

    it('should allow member to leave', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'owner-1' });
      prisma.teamMember.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.leaveTeam('member-1', 'team-1');
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // 团队应用关联
  // ============================================================

  describe('addApp', () => {
    it('should throw NotFoundException if app does not exist', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'admin-1' });
      prisma.application.findUnique.mockResolvedValue(null);
      await expect(service.addApp('admin-1', 'team-1', { applicationId: 'non-existent', permission: 'can_view' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not app owner', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'admin-1' });
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1', userId: 'other-user' });
      await expect(service.addApp('admin-1', 'team-1', { applicationId: 'app-1', permission: 'can_view' })).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException if app already shared to team', async () => {
      prisma.team.findUnique.mockResolvedValue({ id: 'team-1', ownerId: 'admin-1' });
      prisma.application.findUnique.mockResolvedValue({ id: 'app-1', userId: 'admin-1' });
      prisma.teamApplication.findUnique.mockResolvedValue({ id: 'ta-1' });
      await expect(service.addApp('admin-1', 'team-1', { applicationId: 'app-1', permission: 'can_view' })).rejects.toThrow(ConflictException);
    });
  });
});
