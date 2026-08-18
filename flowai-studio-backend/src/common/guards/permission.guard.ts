import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, hasPermission, ROLES, Role } from '../constants/permissions';
import { PrismaService } from '../services/prisma.service';

/**
 * RBAC 权限守卫
 *
 * 检查逻辑（按优先级）:
 * 1. 管理员全局角色 → 直接放行
 * 2. 资源所有者 → 直接放行
 * 3. 团队成员角色 → 按角色权限映射检查
 * 4. 团队应用权限 → 按 team_applications.permission 映射检查
 * 5. 都不满足 → 403
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<Permission[]>(
      PERMISSIONS_KEY,
      context.getHandler(),
    );

    // 如果接口没有标记权限要求，直接放行（由 JwtAuthGuard 处理认证）
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('无法识别用户身份');
    }

    // 1. 检查全局角色
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { globalRole: true },
    });

    if (user?.globalRole === 'admin') {
      return true; // 管理员放行
    }

    // 2. 提取资源 ID（从路由参数中获取）
    const appId = request.params?.appId || request.params?.id;
    const teamId = request.params?.teamId;

    // 3. 如果有 appId，检查所有权和团队权限
    if (appId) {
      const app = await this.prisma.application.findUnique({
        where: { id: appId },
        select: { userId: true },
      });

      if (!app) {
        return true; // 资源不存在的情况交给后续逻辑处理（NotFoundException）
      }

      // 3a. 所有者直接放行
      if (app.userId === userId) {
        return true;
      }

      // 3b. 检查团队成员权限
      const teamAccess = await this.prisma.teamApplication.findFirst({
        where: { applicationId: appId },
        include: {
          team: {
            include: {
              members: {
                where: { userId },
                select: { role: true },
              },
            },
          },
        },
      });

      if (teamAccess && teamAccess.team.members.length > 0) {
        const memberRole = teamAccess.team.members[0].role as Role;
        const teamAppPerm = teamAccess.permission as any;

        // 检查角色权限或团队应用权限
        const hasAccess = requiredPermissions.every(
          (perm) =>
            hasPermission(memberRole, perm) ||
            this.checkTeamAppPermission(teamAppPerm, perm),
        );

        if (hasAccess) return true;
      }
    }

    // 4. 如果有 teamId，检查团队成员角色
    if (teamId) {
      const membership = await this.prisma.teamMember.findUnique({
        where: { teamId_userId: { teamId, userId } },
        select: { role: true },
      });

      if (membership) {
        const role = membership.role as Role;
        const hasAccess = requiredPermissions.every((perm) =>
          hasPermission(role, perm),
        );
        if (hasAccess) return true;
      }
    }

    throw new ForbiddenException('您没有执行此操作的权限');
  }

  /**
   * 检查团队应用权限级别是否覆盖指定操作
   */
  private checkTeamAppPermission(
    teamAppPerm: string,
    permission: Permission,
  ): boolean {
    const editPerms: Permission[] = [
      'app:read' as Permission,
      'app:update' as Permission,
      'workflow:create' as Permission,
      'workflow:read' as Permission,
      'workflow:update' as Permission,
      'workflow:execute' as Permission,
    ];
    const viewPerms: Permission[] = [
      'app:read' as Permission,
      'workflow:read' as Permission,
    ];

    if (teamAppPerm === 'full_access') return true;
    if (teamAppPerm === 'can_edit') return editPerms.includes(permission);
    if (teamAppPerm === 'can_view') return viewPerms.includes(permission);
    return false;
  }
}
