import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { PrismaService } from '../../../common/services/prisma.service';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let prisma: any;

  const mockPrismaService = {
    apiKey: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    prisma = module.get(PrismaService);

    Object.values(mockPrismaService.apiKey).forEach((fn) => fn.mockReset());
  });

  describe('createApiKey', () => {
    it('should create an API key and return the plaintext key once', async () => {
      const dbResult = {
        id: 'key-1',
        name: 'Test Key',
        keyPrefix: 'sk-abc',
        scopes: '["app:read","workflow:execute"]',
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        applicationId: null,
      };

      prisma.apiKey.create.mockResolvedValue(dbResult);

      const result = await service.createApiKey('user-1', {
        name: 'Test Key',
        scopes: ['app:read', 'workflow:execute'],
      });

      expect(result.name).toBe('Test Key');
      expect(result.key).toMatch(/^sk-[a-f0-9]{64}$/);
      expect(result.scopes).toEqual(['app:read', 'workflow:execute']);
      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Key',
            keyPrefix: expect.stringMatching(/^sk-[a-f0-9]{4}$/),
          }),
        }),
      );
    });
  });

  describe('listApiKeys', () => {
    it('should list user API keys', async () => {
      const keys = [
        {
          id: 'key-1',
          name: 'Key 1',
          keyPrefix: 'sk-abc',
          scopes: '["app:read"]',
          isActive: true,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: new Date(),
          applicationId: null,
        },
      ];

      prisma.apiKey.findMany.mockResolvedValue(keys);

      const result = await service.listApiKeys('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].scopes).toEqual(['app:read']);
    });

    it('should filter by applicationId', async () => {
      prisma.apiKey.findMany.mockResolvedValue([]);
      await service.listApiKeys('user-1', 'app-1');
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ applicationId: 'app-1' }),
        }),
      );
    });
  });

  describe('deleteApiKey', () => {
    it('should throw NotFoundException if key does not exist', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      await expect(service.deleteApiKey('user-1', 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', userId: 'other-user' });
      await expect(service.deleteApiKey('user-1', 'key-1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete key if owner', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', userId: 'user-1' });
      prisma.apiKey.delete.mockResolvedValue({ id: 'key-1' });

      const result = await service.deleteApiKey('user-1', 'key-1');
      expect(result.success).toBe(true);
    });
  });

  describe('toggleApiKey', () => {
    it('should toggle key active state', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({ id: 'key-1', userId: 'user-1' });
      prisma.apiKey.update.mockResolvedValue({ id: 'key-1', name: 'Key 1', isActive: false });

      const result = await service.toggleApiKey('user-1', 'key-1', false);
      expect(result.isActive).toBe(false);
    });
  });

  describe('validateApiKey', () => {
    it('should return null for invalid key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue(null);
      const result = await service.validateApiKey('sk-invalid');
      expect(result).toBeNull();
    });

    it('should return null for inactive key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        userId: 'user-1',
        applicationId: null,
        scopes: '["app:read"]',
        isActive: false,
        expiresAt: null,
      });
      const result = await service.validateApiKey('sk-inactive');
      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        userId: 'user-1',
        applicationId: null,
        scopes: '["app:read"]',
        isActive: true,
        expiresAt: new Date('2020-01-01'),
      });
      const result = await service.validateApiKey('sk-expired');
      expect(result).toBeNull();
    });

    it('should return key info for valid key', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        userId: 'user-1',
        applicationId: 'app-1',
        scopes: '["app:read","workflow:execute"]',
        isActive: true,
        expiresAt: null,
      });
      prisma.apiKey.update.mockResolvedValue({});

      const result = await service.validateApiKey('sk-valid');
      expect(result).toEqual({
        userId: 'user-1',
        applicationId: 'app-1',
        scopes: ['app:read', 'workflow:execute'],
      });
    });
  });
});
