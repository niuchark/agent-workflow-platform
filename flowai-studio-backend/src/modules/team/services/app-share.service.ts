import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../common/services/prisma.service';

@Injectable()
export class AppShareService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成分享链接
   */
  async generateShareLink(userId: string, applicationId: string) {
    await this.assertAppOwner(userId, applicationId);

    // 如果已有分享记录则复用
    const existingShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (existingShare) {
      return {
        shareLink: existingShare.shareLink,
        isPublic: existingShare.isPublic,
      };
    }

    const shareLink = `share-${crypto.randomBytes(16).toString('hex')}`;

    const appShare = await this.prisma.appShare.create({
      data: {
        shareLink,
        isPublic: true,
        applicationId,
      },
      select: { id: true, shareLink: true, isPublic: true },
    });

    // 同时更新 Application.shareLink 以便快速查找
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { shareLink },
    });

    return appShare;
  }

  /**
   * 通过分享链接获取应用（公开访问，无需认证）
   */
  async getSharedApp(shareLink: string) {
    const appShare = await this.prisma.appShare.findUnique({
      where: { shareLink },
      select: {
        isPublic: true,
        embedConfig: true,
        application: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            status: true,
          },
        },
      },
    });

    if (!appShare || !appShare.isPublic) {
      throw new NotFoundException('分享的应用不存在或已关闭分享');
    }

    return {
      ...appShare.application,
      isPublic: appShare.isPublic,
      shareLink,
      embedConfig: appShare.embedConfig,
    };
  }

  /**
   * 更新分享设置
   */
  async updateShareSettings(
    userId: string,
    applicationId: string,
    settings: {
      isPublic?: boolean;
      embedConfig?: { allowedOrigins?: string[]; theme?: string };
    },
  ) {
    await this.assertAppOwner(userId, applicationId);

    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (!appShare) {
      throw new NotFoundException('请先生成分享链接');
    }

    const data: any = {};
    if (settings.isPublic !== undefined) data.isPublic = settings.isPublic;
    if (settings.embedConfig) data.embedConfig = JSON.stringify(settings.embedConfig);

    return this.prisma.appShare.update({
      where: { applicationId },
      data,
      select: {
        id: true,
        shareLink: true,
        isPublic: true,
        embedConfig: true,
      },
    });
  }

  /**
   * 撤销分享链接
   */
  async revokeShareLink(userId: string, applicationId: string) {
    await this.assertAppOwner(userId, applicationId);

    // 删除 AppShare 记录
    const result = await this.prisma.appShare.deleteMany({
      where: { applicationId },
    });

    // 同时清除 Application.shareLink
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { shareLink: null },
    });

    return { success: true, deleted: result.count };
  }

  /**
   * 获取嵌入代码
   */
  async getEmbedCode(userId: string, applicationId: string) {
    const app = await this.assertAppOwner(userId, applicationId);

    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (!appShare) {
      throw new ForbiddenException('请先生成分享链接');
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const shareUrl = `${baseUrl}/share/${appShare.shareLink}`;

    const embedConfig = appShare.embedConfig ? JSON.parse(appShare.embedConfig as string) : {};
    const theme = embedConfig.theme || 'light';

    return {
      shareUrl,
      iframeCode: `<iframe src="${shareUrl}" width="100%" height="600" frameborder="0" style="border-radius: 8px;"></iframe>`,
      scriptTag: `<script src="${baseUrl}/embed.js" data-app="${appShare.shareLink}" data-theme="${theme}"></script>`,
      embedConfig: embedConfig,
    };
  }

  /**
   * 断言应用所有权
   */
  private async assertAppOwner(userId: string, applicationId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!app) throw new NotFoundException('应用不存在');
    if (app.userId !== userId) throw new ForbiddenException('只有应用所有者才能管理分享设置');

    return app;
  }
}
