import { ConfigService } from '@nestjs/config';
import { CredentialCryptoService } from '../credential-crypto.service';

describe('CredentialCryptoService', () => {
  const keyA = Buffer.alloc(32, 1).toString('base64');
  const keyB = Buffer.alloc(32, 2).toString('base64');

  const create = (key: string) => new CredentialCryptoService({
    get: jest.fn().mockReturnValue(key),
  } as unknown as ConfigService);

  it('encrypts and decrypts with AES-256-GCM and contextual AAD', () => {
    const service = create(keyA);
    const encrypted = service.encrypt('sk-private-value', 'model-credential:user-a:qwen');

    expect(encrypted.ciphertext).not.toContain('sk-private-value');
    expect(service.decrypt(encrypted, 'model-credential:user-a:qwen')).toBe('sk-private-value');
  });

  it('rejects a different master key', () => {
    const encrypted = create(keyA).encrypt('secret', 'context');
    expect(() => create(keyB).decrypt(encrypted, 'context')).toThrow();
  });

  it('rejects tampered ciphertext and a different user/provider context', () => {
    const service = create(keyA);
    const encrypted = service.encrypt('secret', 'model-credential:user-a:qwen');
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from('tampered').toString('base64'),
    };

    expect(() => service.decrypt(tampered, 'model-credential:user-a:qwen')).toThrow();
    expect(() => service.decrypt(encrypted, 'model-credential:user-b:qwen')).toThrow();
  });

  it('requires an exact 32-byte decoded master key', () => {
    expect(() => create(Buffer.alloc(16).toString('base64'))).toThrow(
      'MODEL_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes',
    );
  });
});

