import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { CreateTeamDto, UpdateTeamDto, AddMemberDto, UpdateMemberRoleDto, AddTeamAppDto, UpdateTeamAppPermissionDto } from '../dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // 团队 CRUD
  // ============================================================

  async create(userId: string, dto: CreateTeamDto) {
    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        description: dto.description,
        avatar: dto.avatar,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'owner',
          },
        },
      },
      include: {
        members: { select: { id: true, userId: true, role: true, joinedAt: true } },
      },
    });

    return this.serializeTeam(team);
  }

  async listMyTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        _count: { select: { members: true, teamApplications: true } },
        members: {
          where: { userId },
          select: { role: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      avatar: t.avatar,
      myRole: t.members[0]?.role || 'viewer',
      memberCount: t._count.members,
      appCount: t._count.teamApplications,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  async getTeam(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            joinedAt: true,
            user: { select: { id: true, username: true, avatar: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
        teamApplications: {
          include: {
            application: {
              select: { id: true, name: true, description: true, icon: true, status: true },
            },
          },
        },
      },
    });

    if (!team) throw new NotFoundException('团队不存在');

    // 检查当前用户是否为成员
    const membership = team.members.find((m) => m.userId === userId);
    if (!membership) throw new ForbiddenException('您不是该团队的成员');

    return {
      id: team.id,
      name: team.name,
      description: team.description,
      avatar: team.avatar,
      myRole: membership.role,
      ownerId: team.ownerId,
      members: team.members,
      applications: team.teamApplications.map((ta: any) => ({
        id: ta.id,
        permission: ta.permission,
        addedAt: ta.addedAt,
        application: ta.application,
      })),
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }

  async update(userId: string, teamId: string, dto: UpdateTeamDto) {
    const team = await this.assertTeamAdmin(userId, teamId);

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: dto,
      include: {
        members: { select: { id: true, userId: true, role: true, joinedAt: true } },
      },
    });

    return this.serializeTeam(updated);
  }

  async delete(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('团队不存在');
    if (team.ownerId !== userId) throw new ForbiddenException('只有团队所有者才能删除团队');

    await this.prisma.team.delete({ where: { id: teamId } });
    return { success: true };
  }

  // ============================================================
  // 成员管理
  // ============================================================

  async addMember(userId: string, teamId: string, dto: AddMemberDto) {
    await this.assertTeamAdmin(userId, teamId);

    // 不能添加已存在的成员
    const existing = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: dto.userId } },
    });
    if (existing) throw new ConflictException('该用户已是团队成员');

    // 不能添加自己
    if (dto.userId === userId) throw new BadRequestException('不能添加自己');

    const member = await this.prisma.teamMember.create({
      data: {
        teamId,
        userId: dto.userId,
        role: dto.role,
      },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });

    return {
      id: member.id,
      userId: member.userId,
      role: member.role,
      joinedAt: member.joinedAt,
      user: member.user,
    };
  }

  async updateMemberRole(userId: string, teamId: string, memberId: string, dto: UpdateMemberRoleDto) {
    const team = await this.assertTeamAdmin(userId, teamId);

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.teamId !== teamId) throw new NotFoundException('成员不存在');

    // 不能修改 owner 的角色
    if (member.role === 'owner') throw new ForbiddenException('不能修改所有者角色');

    // owner 不能被降级
    if (team.ownerId === member.userId) throw new ForbiddenException('不能修改所有者角色');

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, username: true, avatar: true } },
      },
    });
  }

  async removeMember(userId: string, teamId: string, memberId: string) {
    const team = await this.assertTeamAdmin(userId, teamId);

    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
    });
    if (!member || member.teamId !== teamId) throw new NotFoundException('成员不存在');

    // 不能移除 owner
    if (team.ownerId === member.userId) throw new ForbiddenException('不能移除团队所有者');

    await this.prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true };
  }

  async leaveTeam(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('团队不存在');

    if (team.ownerId === userId) throw new BadRequestException('团队所有者不能离开团队，请先转让所有权或删除团队');

    await this.prisma.teamMember.deleteMany({
      where: { teamId, userId },
    });

    return { success: true };
  }

  // ============================================================
  // 团队应用关联
  // ============================================================

  async addApp(userId: string, teamId: string, dto: AddTeamAppDto) {
    await this.assertTeamAdmin(userId, teamId);

    // 验证应用存在且用户有权限分享
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
    });
    if (!app) throw new NotFoundException('应用不存在');
    if (app.userId !== userId) throw new ForbiddenException('只有应用所有者才能分享到团队');

    // 检查是否已关联
    const existing = await this.prisma.teamApplication.findUnique({
      where: { teamId_applicationId: { teamId, applicationId: dto.applicationId } },
    });
    if (existing) throw new ConflictException('该应用已分享到此团队');

    const teamApp = await this.prisma.teamApplication.create({
      data: {
        teamId,
        applicationId: dto.applicationId,
        permission: dto.permission,
      },
      include: {
        application: { select: { id: true, name: true, description: true, icon: true, status: true } },
      },
    });

    return {
      id: teamApp.id,
      permission: teamApp.permission,
      addedAt: teamApp.addedAt,
      application: teamApp.application,
    };
  }

  async updateAppPermission(
    userId: string,
    teamId: string,
    teamAppId: string,
    dto: UpdateTeamAppPermissionDto,
  ) {
    await this.assertTeamAdmin(userId, teamId);

    const teamApp = await this.prisma.teamApplication.findUnique({
      where: { id: teamAppId },
    });
    if (!teamApp || teamApp.teamId !== teamId) throw new NotFoundException('团队应用关联不存在');

    return this.prisma.teamApplication.update({
      where: { id: teamAppId },
      data: { permission: dto.permission },
    });
  }

  async removeApp(userId: string, teamId: string, teamAppId: string) {
    await this.assertTeamAdmin(userId, teamId);

    const teamApp = await this.prisma.teamApplication.findUnique({
      where: { id: teamAppId },
    });
    if (!teamApp || teamApp.teamId !== teamId) throw new NotFoundException('团队应用关联不存在');

    await this.prisma.teamApplication.delete({ where: { id: teamAppId } });
    return { success: true };
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  /**
   * 断言当前用户是团队管理员（owner 或 admin）
   */
  private async assertTeamAdmin(userId: string, teamId: string) {
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new NotFoundException('团队不存在');

    if (team.ownerId === userId) return team;

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
      throw new ForbiddenException('需要团队管理员权限');
    }

    return team;
  }

  private serializeTeam(team: any) {
    return {
      id: team.id,
      name: team.name,
      description: team.description,
      avatar: team.avatar,
      ownerId: team.ownerId,
      members: team.members,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
