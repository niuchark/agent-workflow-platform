import { ModelCredentialService } from '../model-credential.service';
import axios from 'axios';

describe('ModelCredentialService', () => {
  afterEach(() => jest.restoreAllMocks());

  const existing = {
    id: 'credential-1',
    userId: 'user-a',
    provider: 'qwen',
    baseUrl: 'https://example.com/v1',
    encryptedApiKey: 'encrypted',
    encryptionIv: 'iv',
    encryptionTag: 'tag',
    keyPrefix: 'sk-a',
    keySuffix: 'last',
    status: 'valid',
    isEnabled: true,
    lastTestedAt: null,
    lastTestMessage: null,
    updatedAt: new Date(),
  };

  const setup = () => {
    const prisma = {
      modelCredential: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(existing),
        upsert: jest.fn().mockImplementation(({ update }: any) => Promise.resolve({ ...existing, ...update })),
      },
    };
    const crypto = {
      encrypt: jest.fn().mockReturnValue({ ciphertext: 'new-cipher', iv: 'new-iv', tag: 'new-tag' }),
      decrypt: jest.fn().mockReturnValue('secret'),
    };
    const baseUrlSecurity = { assertAllowed: jest.fn((url: string) => Promise.resolve(url)) };
    const service = new ModelCredentialService(prisma as any, crypto as any, baseUrlSecurity as any);
    return { service, prisma, crypto };
  };

  it('scopes credential listing to the authenticated user', async () => {
    const { service, prisma } = setup();
    await service.list('user-b');
    expect(prisma.modelCredential.findMany).toHaveBeenCalledWith({ where: { userId: 'user-b' } });
  });

  it('retains the encrypted API key when an update omits apiKey', async () => {
    const { service, prisma, crypto } = setup();
    await service.upsert('user-a', 'qwen', { baseUrl: existing.baseUrl });

    const update = prisma.modelCredential.upsert.mock.calls[0][0].update;
    expect(update).not.toHaveProperty('encryptedApiKey');
    expect(crypto.encrypt).not.toHaveBeenCalled();
  });

  it('clears the API key only through clearApiKey', async () => {
    const { service, prisma } = setup();
    await service.upsert('user-a', 'qwen', { baseUrl: existing.baseUrl, clearApiKey: true });

    expect(prisma.modelCredential.upsert.mock.calls[0][0].update).toEqual(expect.objectContaining({
      encryptedApiKey: null,
      encryptionIv: null,
      encryptionTag: null,
      keyPrefix: null,
      keySuffix: null,
      status: 'untested',
      isEnabled: false,
    }));
  });

  it('never returns plaintext and only exposes a mask', async () => {
    const { service, prisma } = setup();
    prisma.modelCredential.findMany.mockResolvedValue([existing]);
    const [summary] = await service.list('user-a');

    expect(summary).toEqual(expect.objectContaining({ hasApiKey: true, apiKeyMasked: 'sk-a********last' }));
    expect(JSON.stringify(summary)).not.toContain('secret');
    expect(summary).not.toHaveProperty('encryptedApiKey');
  });

  it('loads the Qwen model catalog from the provider API', async () => {
    const { service } = setup();
    jest.spyOn(axios, 'get').mockResolvedValue({
      data: {
        output: {
          total: 2,
          models: [
            { model: 'qwen3.7-flash', name: '通义千问3.7-Flash' },
            { model: 'qwen3.7-plus', name: '通义千问3.7-Plus' },
          ],
        },
      },
    });

    const models = await service.listModels('user-a', 'qwen');
    expect(models).toEqual(expect.arrayContaining([
      { id: 'qwen3.7-flash', displayName: '通义千问3.7-Flash（qwen3.7-flash）', provider: 'qwen' },
      { id: 'qwen3.7-plus', displayName: '通义千问3.7-Plus（qwen3.7-plus）', provider: 'qwen' },
      { id: 'qwen-turbo', displayName: 'qwen-turbo', provider: 'qwen' },
    ]));
    expect(axios.get).toHaveBeenCalledWith(
      'https://example.com/api/v1/models',
      expect.objectContaining({ headers: { Authorization: 'Bearer secret' } }),
    );
  });

  it('falls back to common Qwen models when the catalog is unavailable', async () => {
    const { service } = setup();
    jest.spyOn(axios, 'get').mockRejectedValue(new Error('network unavailable'));

    const models = await service.listModels('user-a', 'qwen');
    expect(models).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'qwen3.7-flash', provider: 'qwen' }),
      expect.objectContaining({ id: 'qwen-plus', provider: 'qwen' }),
    ]));
  });
});
