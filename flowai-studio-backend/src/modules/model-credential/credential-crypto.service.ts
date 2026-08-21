/**
 * 凭证加密服务：用 AES-256-GCM 加密/解密用户模型 API Key。
 *
 * 密钥来自 MODEL_CREDENTIAL_ENCRYPTION_KEY（32 字节 hex 或 base64）；
 * 生产环境未配置密钥时启动会被 env 校验拦截，开发环境使用固定降级密钥。
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/** 加密后的密文结构 */
export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  tag: string;
}

/** 凭证加密服务 */
@Injectable()
export class CredentialCryptoService {
  private readonly logger = new Logger(CredentialCryptoService.name);
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const configured = this.configService.get<string>('MODEL_CREDENTIAL_ENCRYPTION_KEY');
    this.key = configured ? this.parseKey(configured) : this.developmentKey();
  }

  /** 加密：context 作为 AAD 绑定密文的使用场景（如用户 ID） */
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

  /** 解密：context 必须与加密时一致 */
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

  /** 解析密钥：支持 64 位 hex 或 base64，必须是 32 字节 */
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

  /** 开发环境降级密钥（仅本地使用，生产必须配置正式密钥） */
  private developmentKey(): Buffer {
    this.logger.warn(
      'MODEL_CREDENTIAL_ENCRYPTION_KEY is missing; using an insecure development-only key',
    );
    return createHash('sha256').update('flowai-model-credential-development-key').digest();
  }
}
