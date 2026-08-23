/**
 * 应用分享服务：分享链接、公开访问与嵌入代码。
 */
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
      return this.serializeShare(existingShare);
    }

    const shareLink = `share-${crypto.randomBytes(16).toString('hex')}`;

    const appShare = await this.prisma.appShare.create({
      data: {
        shareLink,
        isPublic: true,
        applicationId,
      },
    });

    // 同时更新 Application.shareLink 以便快速查找
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { shareLink },
    });

    return this.serializeShare(appShare);
  }

  /** 获取应用当前的分享记录。 */
  async getShareInfo(userId: string, applicationId: string) {
    await this.assertAppOwner(userId, applicationId);
    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });
    if (!appShare) throw new NotFoundException('该应用尚未生成分享链接');
    return this.serializeShare(appShare);
  }

  /**
   * 通过分享链接获取应用（公开访问，无需认证）
   */
  async getSharedApp(shareLink: string, embedded = false) {
    const appShare = await this.prisma.appShare.findUnique({
      where: { shareLink },
      select: {
        id: true,
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

    const embedConfig = this.parseEmbedConfig(appShare.embedConfig);
    if (embedded && !embedConfig.enabled) {
      throw new ForbiddenException('此应用未开启嵌入');
    }

    await this.prisma.appShare.update({
      where: { id: appShare.id },
      data: { accessCount: { increment: 1 } },
    });

    return {
      ...appShare.application,
      isPublic: appShare.isPublic,
      shareLink,
      embedConfig,
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
      embedConfig?: {
        enabled?: boolean;
        width?: string;
        height?: string;
        theme?: 'light' | 'dark' | 'auto';
        showHeader?: boolean;
      };
    },
  ) {
    await this.assertAppOwner(userId, applicationId);

    const appShare = await this.prisma.appShare.findUnique({
      where: { applicationId },
    });

    if (!appShare) {
      throw new NotFoundException('请先生成分享链接');
    }

    const data: { isPublic?: boolean; embedConfig?: string } = {};
    if (settings.isPublic !== undefined) data.isPublic = settings.isPublic;
    if (settings.embedConfig) data.embedConfig = JSON.stringify(settings.embedConfig);

    const updated = await this.prisma.appShare.update({
      where: { applicationId },
      data,
    });
    return this.serializeShare(updated);
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

    const baseUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173');
    const embedConfig = this.parseEmbedConfig(appShare.embedConfig);
    if (!embedConfig.enabled) {
      throw new ForbiddenException('此应用未开启嵌入');
    }
    const shareUrl = new URL(`/share/${appShare.shareLink}`, baseUrl);
    shareUrl.searchParams.set('embedded', '1');
    shareUrl.searchParams.set('theme', embedConfig.theme);
    shareUrl.searchParams.set('showHeader', String(embedConfig.showHeader));

    const url = shareUrl.toString();
    const title = `${app.name} - FlowAI Studio`;
    const iframeCode = `<iframe src="${this.escapeHtmlAttribute(url)}" title="${this.escapeHtmlAttribute(title)}" loading="lazy" style="width:${embedConfig.width};height:${embedConfig.height};border:0;border-radius:8px" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    const scriptPayload = {
      url,
      title,
      width: embedConfig.width,
      height: embedConfig.height,
    };
    const serializedPayload = JSON.stringify(scriptPayload).replace(/</g, '\\u003c');
    const scriptCode = `<script>(function(c,s){var f=document.createElement('iframe');f.src=c.url;f.title=c.title;f.loading='lazy';f.referrerPolicy='strict-origin-when-cross-origin';f.style.width=c.width;f.style.height=c.height;f.style.border='0';f.style.borderRadius='8px';s.parentNode.insertBefore(f,s);})(${serializedPayload},document.currentScript);</script>`;

    return {
      shareUrl: url,
      iframeCode,
      scriptCode,
      // Keep the former key for one release so existing API consumers do not break.
      scriptTag: scriptCode,
      embedConfig,
    };
  }

  /**
   * 断言应用所有权
   */
  private async assertAppOwner(userId: string, applicationId: string) {
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
    });

    if (!app) throw new NotFoundException('应用不存在');

    return app;
  }

  private serializeShare(appShare: {
    id: string;
    applicationId: string;
    shareLink: string;
    isPublic: boolean;
    accessCount: number;
    embedConfig: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      ...appShare,
      embedConfig: this.parseEmbedConfig(appShare.embedConfig),
    };
  }

  private parseEmbedConfig(value: string | null) {
    let config: Record<string, unknown> = {};
    if (value) {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          config = parsed as Record<string, unknown>;
        }
      } catch {
        // Invalid legacy values fall back to safe defaults.
      }
    }

    return {
      enabled: config.enabled !== false,
      width: this.normalizeDimension(config.width, '100%'),
      height: this.normalizeDimension(config.height, '600px'),
      theme: ['light', 'dark', 'auto'].includes(String(config.theme))
        ? config.theme as 'light' | 'dark' | 'auto'
        : 'auto',
      showHeader: config.showHeader !== false,
    };
  }

  private normalizeDimension(value: unknown, fallback: string): string {
    return typeof value === 'string' && /^\d+(?:\.\d+)?(?:px|%|vh|vw|rem|em)$/.test(value)
      ? value
      : fallback;
  }

  private escapeHtmlAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
