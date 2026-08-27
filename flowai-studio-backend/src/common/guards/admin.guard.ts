/** 仅允许全局管理员访问系统级管理接口。 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../services/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const user = userId
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { globalRole: true },
        })
      : null;

    if (user?.globalRole !== 'admin') {
      throw new ForbiddenException('仅系统管理员可访问此功能');
    }

    return true;
  }
}
