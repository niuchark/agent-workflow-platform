import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { AppShareService } from './app-share.service';

describe('AppShareService', () => {
  const prisma = {
    application: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    appShare: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
  let service: AppShareService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AppShareService(prisma as unknown as PrismaService);
  });

  it('returns normalized share settings for the owner', async () => {
    const createdAt = new Date('2026-08-23T00:00:00Z');
    prisma.application.findFirst.mockResolvedValue({ id: 'app-1', userId: 'user-1' });
    prisma.appShare.findUnique.mockResolvedValue({
      id: 'share-1',
      applicationId: 'app-1',
      shareLink: 'share-token',
      isPublic: true,
      accessCount: 2,
      embedConfig: '{"width":"80%","theme":"dark","showHeader":false}',
      createdAt,
      updatedAt: createdAt,
    });

    await expect(service.getShareInfo('user-1', 'app-1')).resolves.toMatchObject({
      applicationId: 'app-1',
      embedConfig: {
        width: '80%',
        height: '600px',
        theme: 'dark',
        showHeader: false,
      },
    });
  });

  it('escapes an application name before embedding it in script code', async () => {
    prisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      userId: 'user-1',
      name: '</script><script>alert(1)</script>',
    });
    prisma.appShare.findUnique.mockResolvedValue({
      shareLink: 'share-token',
      embedConfig: null,
    });

    const result = await service.getEmbedCode('user-1', 'app-1');

    expect(result.scriptCode.match(/<\/script>/g)).toHaveLength(1);
    expect(result.scriptCode).not.toContain('</script><script>alert(1)');
    expect(result.scriptCode).toContain('\\u003c/script>');
    expect(result.scriptTag).toBe(result.scriptCode);
  });

  it('does not expose whether an application belongs to another user', async () => {
    prisma.application.findFirst.mockResolvedValue(null);
    await expect(service.getShareInfo('user-1', 'app-2')).rejects.toThrow(NotFoundException);
  });

  it('rejects embed code generation when embedding is disabled', async () => {
    prisma.application.findFirst.mockResolvedValue({
      id: 'app-1',
      userId: 'user-1',
      name: 'Private embed',
    });
    prisma.appShare.findUnique.mockResolvedValue({
      shareLink: 'share-token',
      embedConfig: '{"enabled":false}',
    });

    await expect(service.getEmbedCode('user-1', 'app-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('keeps normal sharing available while rejecting disabled embeds', async () => {
    prisma.appShare.findUnique.mockResolvedValue({
      id: 'share-1',
      isPublic: true,
      embedConfig: '{"enabled":false}',
      application: { id: 'app-1', name: 'Shared app' },
    });
    prisma.appShare.update.mockResolvedValue({});

    await expect(service.getSharedApp('share-token')).resolves.toMatchObject({
      id: 'app-1',
      embedConfig: { enabled: false },
    });

    await expect(service.getSharedApp('share-token', true)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.appShare.update).toHaveBeenCalledTimes(1);
  });
});
