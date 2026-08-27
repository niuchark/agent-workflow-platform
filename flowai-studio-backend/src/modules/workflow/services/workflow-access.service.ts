import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import {
  Permission,
  TeamAppPermission,
  teamAppHasPermission,
} from '../../../common/constants/permissions';

interface WorkflowApplication {
  id: string;
  userId: string;
}

/** 工作流资源权限：所有者或具有对应团队应用权限的成员。 */
@Injectable()
export class WorkflowAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertPermission(
    userId: string,
    application: WorkflowApplication,
    permission: Permission,
  ): Promise<'owner' | TeamAppPermission> {
    if (application.userId === userId) {
      return 'owner';
    }

    const teamApplications = await this.prisma.teamApplication.findMany({
      where: {
        applicationId: application.id,
        team: { members: { some: { userId } } },
      },
      select: { permission: true },
    });

    const access = teamApplications.find((teamApplication) =>
      teamAppHasPermission(teamApplication.permission as TeamAppPermission, permission),
    );

    if (!access) {
      throw new ForbiddenException('You do not have permission to access this workflow');
    }

    return access.permission as TeamAppPermission;
  }
}
