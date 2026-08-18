import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateAppDto } from './dto/create-app.dto';
import { UpdateAppDto } from './dto/update-app.dto';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  /**
   * 检查用户是否有权访问应用 (owner 或团队成员)
   */
  private async assertAppAccess(userId: string, appId: string): Promise<void> {
    const app = await this.prisma.application.findUnique({
      where: { id: appId },
      include: {
        teamApplications: {
          include: {
            team: {
              include: {
                members: { where: { userId } },
              },
            },
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException('Application not found');
    }

    // 应用所有者有完全访问权
    if (app.userId === userId) {
      return;
    }

    // 检查团队成员权限
    const teamApp = app.teamApplications.find((ta) =>
      ta.team.members.length > 0,
    );

    if (!teamApp) {
      throw new ForbiddenException('You do not have permission to access this application');
    }
  }

  /**
   * 检查团队成员是否有特定级别的权限
   */
  private async checkTeamAccess(
    userId: string,
    appId: string,
    requiredPermission: 'full_access' | 'can_edit' | 'can_view',
  ): Promise<boolean> {
    const teamApp = await this.prisma.teamApplication.findFirst({
      where: {
        applicationId: appId,
        team: {
          members: { some: { userId } },
        },
      },
      include: {
        team: {
          include: {
            members: { where: { userId } },
          },
        },
      },
    });

    if (!teamApp) return false;

    const permissionLevels = ['can_view', 'can_edit', 'full_access'];
    const userLevel = permissionLevels.indexOf(teamApp.permission);
    const requiredLevel = permissionLevels.indexOf(requiredPermission);

    return userLevel >= requiredLevel;
  }

  async create(userId: string, createAppDto: CreateAppDto) {
    return this.prisma.application.create({
      data: {
        ...createAppDto,
        userId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findAll(userId: string) {
    // 获取用户自己的应用
    const ownedApps = await this.prisma.application.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 获取通过团队可以访问的应用
    const teamApps = await this.prisma.teamApplication.findMany({
      where: {
        team: {
          members: { some: { userId } },
        },
        application: {
          userId: { not: userId }, // 排除自己的应用（已在上面的 ownedApps 中）
        },
      },
      include: {
        application: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const teamAppResults = teamApps.map((ta) => ({
      ...ta.application,
      accessType: ta.permission,
    }));

    const ownedAppResults = ownedApps.map((app) => ({
      ...app,
      accessType: 'owner' as const,
    }));

    return [...ownedAppResults, ...teamAppResults];
  }

  async findOne(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        workflows: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    return app;
  }

  async update(userId: string, id: string, updateAppDto: UpdateAppDto) {
    await this.assertAppAccess(userId, id);

    // 非所有者需要 can_edit 权限
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasEdit = await this.checkTeamAccess(userId, id, 'can_edit');
      if (!hasEdit) {
        throw new ForbiddenException('You do not have permission to update this application');
      }
    }

    return this.prisma.application.update({
      where: { id },
      data: updateAppDto,
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasFull = await this.checkTeamAccess(userId, id, 'full_access');
      if (!hasFull) {
        throw new ForbiddenException('You do not have permission to delete this application');
      }
    }

    await this.prisma.application.delete({ where: { id } });
    return { success: true };
  }

  async publish(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasEdit = await this.checkTeamAccess(userId, id, 'can_edit');
      if (!hasEdit) {
        throw new ForbiddenException('You do not have permission to publish this application');
      }
    }

    return this.prisma.application.update({
      where: { id },
      data: { status: 'published' },
      select: { id: true, name: true, status: true },
    });
  }

  async unpublish(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasEdit = await this.checkTeamAccess(userId, id, 'can_edit');
      if (!hasEdit) {
        throw new ForbiddenException('You do not have permission to unpublish this application');
      }
    }

    return this.prisma.application.update({
      where: { id },
      data: { status: 'draft' },
      select: { id: true, name: true, status: true },
    });
  }

  async archive(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasFull = await this.checkTeamAccess(userId, id, 'full_access');
      if (!hasFull) {
        throw new ForbiddenException('You do not have permission to archive this application');
      }
    }

    return this.prisma.application.update({
      where: { id },
      data: { status: 'archived' },
      select: { id: true, name: true, status: true },
    });
  }

  async unarchive(userId: string, id: string) {
    await this.assertAppAccess(userId, id);

    const app = await this.prisma.application.findUnique({ where: { id } });
    if (!app) throw new NotFoundException('Application not found');
    if (app.userId !== userId) {
      const hasFull = await this.checkTeamAccess(userId, id, 'full_access');
      if (!hasFull) {
        throw new ForbiddenException('You do not have permission to unarchive this application');
      }
    }

    return this.prisma.application.update({
      where: { id },
      data: { status: 'draft' },
      select: { id: true, name: true, status: true },
    });
  }
}
