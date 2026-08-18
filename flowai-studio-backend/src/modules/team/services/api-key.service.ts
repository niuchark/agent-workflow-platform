import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../common/services/prisma.service';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建 API 密钥
   * 返回完整的明文密钥（仅此一次），数据库仅存储哈希
   */
  async createApiKey(
    userId: string,
    data: {
      name: string;
      applicationId?: string;
      scopes?: string[];
      expiresAt?: Date;
    },
  ) {
    // 生成密钥: sk-{random32bytes}
    const rawKey = `sk-${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 7); // sk-xxxx

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: JSON.stringify(data.scopes || ['app:read', 'workflow:execute']),
        applicationId: data.applicationId,
        expiresAt: data.expiresAt,
        userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
        applicationId: true,
      },
    });

    // 仅在创建时返回完整密钥
    return {
      ...apiKey,
      scopes: JSON.parse(apiKey.scopes as string),
      key: rawKey, // 明文密钥，仅返回一次
    };
  }

  /**
   * 列出用户的所有 API 密钥
   */
  async listApiKeys(userId: string, applicationId?: string) {
    const where: any = { userId };
    if (applicationId) where.applicationId = applicationId;

    const keys = await this.prisma.apiKey.findMany({
      where,
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
        applicationId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      ...k,
      scopes: JSON.parse(k.scopes as string),
    }));
  }

  /**
   * 删除 API 密钥
   */
  async deleteApiKey(userId: string, keyId: string) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API 密钥不存在');
    if (key.userId !== userId) throw new ForbiddenException('无权删除此密钥');

    await this.prisma.apiKey.delete({ where: { id: keyId } });
    return { success: true };
  }

  /**
   * 启用/禁用 API 密钥
   */
  async toggleApiKey(userId: string, keyId: string, isActive: boolean) {
    const key = await this.prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key) throw new NotFoundException('API 密钥不存在');
    if (key.userId !== userId) throw new ForbiddenException('无权操作此密钥');

    return this.prisma.apiKey.update({
      where: { id: keyId },
      data: { isActive },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });
  }

  /**
   * 验证 API 密钥（用于 API 请求认证）
   * 返回密钥关联的用户 ID 和权限范围
   */
  async validateApiKey(rawKey: string): Promise<{
    userId: string;
    applicationId: string | null;
    scopes: string[];
  } | null> {
    const keyHash = this.hashKey(rawKey);

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: {
        userId: true,
        applicationId: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
      },
    });

    if (!apiKey) return null;
    if (!apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // 更新最后使用时间（异步，不阻塞请求）
    this.prisma.apiKey
      .update({
        where: { keyHash },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});

    return {
      userId: apiKey.userId,
      applicationId: apiKey.applicationId,
      scopes: JSON.parse(apiKey.scopes as string),
    };
  }

  /**
   * SHA-256 哈希密钥
   */
  private hashKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }
}
