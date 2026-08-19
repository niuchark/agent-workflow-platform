import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

@Injectable()
export class CredentialCryptoService {
  private readonly logger = new Logger(CredentialCryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('MODEL_CREDENTIAL_ENCRYPTION_KEY');
    this.key = configured ? this.parseKey(configured) : this.developmentKey();
  }

  encrypt(value: string, context: string): EncryptedSecret {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
    };
  }

  decrypt(secret: EncryptedSecret, context: string): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(secret.iv, 'base64'),
    );
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(Buffer.from(secret.tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(secret.ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private parseKey(raw: string): Buffer {
    const trimmed = raw.trim();
    const key = /^[a-f\d]{64}$/i.test(trimmed)
      ? Buffer.from(trimmed, 'hex')
      : Buffer.from(trimmed, 'base64');
    if (key.length !== 32) {
      throw new Error('MODEL_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }
    return key;
  }

  private developmentKey(): Buffer {
    this.logger.warn(
      'MODEL_CREDENTIAL_ENCRYPTION_KEY is missing; using an insecure development-only key',
    );
    return createHash('sha256').update('flowai-model-credential-development-key').digest();
  }
}
