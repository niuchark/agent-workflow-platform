import { ModelCredentialService } from '../model-credential.service';

describe('ModelCredentialService', () => {
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
});

