/**
 * 模型凭证服务：用户级凭证的加密存储、测试与模型发现。
 *
 * 凭证按用户隔离，API Key 用 AES-256-GCM 加密落库；
 * 保存前对 Base URL 做 SSRF 安全校验，测试成功后才能启用。
 */
import {
  BadGatewayException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { PrismaService } from '../../common/services/prisma.service';
import { BaseUrlSecurityService } from './base-url-security.service';
import { CredentialCryptoService } from './credential-crypto.service';
import {
  DEFAULT_PROVIDER_BASE_URLS,
  isUserModelProvider,
  ResolvedModelCredential,
  USER_MODEL_PROVIDERS,
  UserModelProvider,
} from './model-credential.types';
import { UpsertModelCredentialDto } from './dto/model-credential.dto';

const QWEN_FALLBACK_MODELS = [
  'qwen3.8-max',
  'qwen3.7-plus',
  'qwen3.7-flash',
  'qwen3-coder-plus',
  'qwen-turbo',
  'qwen-plus',
  'qwen-max',
  'qwen-long',
];

interface QwenCatalogResponse {
  output?: {
    total?: number;
    models?: Array<{ model?: unknown; name?: unknown }>;
  };
}

/** 模型凭证服务 */
@Injectable()
export class ModelCredentialService {
  private readonly logger = new Logger(ModelCredentialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly baseUrlSecurity: BaseUrlSecurityService,
  ) {}

  /** 列出所有供应商的凭证摘要（未配置的给出默认值） */
  async list(userId: string) {
    const credentials = await this.prisma.modelCredential.findMany({ where: { userId } });
    const byProvider = new Map(credentials.map((item) => [item.provider, item]));
    return USER_MODEL_PROVIDERS.map((provider) => {
      const item = byProvider.get(provider);
      return item
        ? this.toSummary(item)
        : {
            provider,
            baseUrl: DEFAULT_PROVIDER_BASE_URLS[provider],
            hasApiKey: false,
            status: 'untested',
            isEnabled: false,
            configured: false,
          };
    });
  }

  /** 保存/更新凭证：安全校验 URL → 加密 Key → upsert */
  async upsert(userId: string, rawProvider: string, dto: UpsertModelCredentialDto) {
    const provider = this.parseProvider(rawProvider);
    const baseUrl = await this.baseUrlSecurity.assertAllowed(dto.baseUrl);
    const existing = await this.prisma.modelCredential.findUnique({
      where: { userId_provider: { userId, provider } },
    });

    const apiKey = dto.apiKey?.trim();
    const clearApiKey = dto.clearApiKey === true;
    const hasRetainedKey = Boolean(existing?.encryptedApiKey) && !clearApiKey;
    if (provider !== 'ollama' && !apiKey && !hasRetainedKey && !clearApiKey) {
      throw new UnprocessableEntityException({
        code: 'MODEL_API_KEY_REQUIRED',
        message: `${provider === 'qwen' ? 'Qwen' : 'OpenAI'} 配置需要 API Key`,
      });
    }

    const secretData = apiKey
      ? this.encryptKey(apiKey, userId, provider)
      : clearApiKey
        ? this.emptySecret()
        : {};

    const saved = await this.prisma.modelCredential.upsert({
      where: { userId_provider: { userId, provider } },
      create: {
        userId,
        provider,
        baseUrl,
        ...secretData,
        status: 'untested',
        isEnabled: false,
      },
      update: {
        baseUrl,
        ...secretData,
        status: 'untested',
        isEnabled: false,
        lastTestedAt: null,
        lastTestMessage: null,
      },
    });
    return this.toSummary(saved);
  }

  /** 删除凭证 */
  async remove(userId: string, rawProvider: string) {
    const provider = this.parseProvider(rawProvider);
    await this.prisma.modelCredential.deleteMany({ where: { userId, provider } });
    return { success: true };
  }

  /** 设置启用状态：只有测试通过的凭证才能启用 */
  async setEnabled(userId: string, rawProvider: string, enabled: boolean) {
    const provider = this.parseProvider(rawProvider);
    const existing = await this.getRecord(userId, provider);
    if (enabled && existing.status !== 'valid') {
      throw new UnprocessableEntityException({
        code: 'MODEL_CREDENTIAL_UNAVAILABLE',
        message: '凭证必须测试成功后才能启用',
      });
    }
    const updated = await this.prisma.modelCredential.update({
      where: { id: existing.id },
      data: { isEnabled: enabled, status: enabled ? 'valid' : 'disabled' },
    });
    return this.toSummary(updated);
  }

  /** 测试连通性：成功标记 valid，失败标记 invalid */
  async test(userId: string, rawProvider: string, model?: string) {
    const provider = this.parseProvider(rawProvider);
    await this.getRecord(userId, provider);
    try {
      const credential = await this.resolveStored(userId, provider, false);
      if (provider === 'qwen') {
        await axios.post(
          `${credential.baseUrl}/chat/completions`,
          {
            model: model || 'qwen-turbo',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1,
          },
          {
            headers: { Authorization: `Bearer ${credential.apiKey}` },
            timeout: 15000,
            maxRedirects: 0,
          },
        );
      } else if (provider === 'openai') {
        await axios.get(`${credential.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${credential.apiKey}` },
          timeout: 15000,
          maxRedirects: 0,
        });
      } else {
        await axios.get(`${credential.baseUrl}/api/tags`, { timeout: 15000, maxRedirects: 0 });
      }

      const updated = await this.prisma.modelCredential.update({
        where: { userId_provider: { userId, provider } },
        data: {
          status: 'valid',
          isEnabled: true,
          lastTestedAt: new Date(),
          lastTestMessage: '连接成功',
        },
      });
      return this.toSummary(updated);
    } catch (error) {
      const response = error instanceof UnprocessableEntityException ? error.getResponse() as any : undefined;
      const safe = response?.code && response?.message
        ? { code: response.code, message: response.message }
        : this.safeUpstreamError(error);
      await this.prisma.modelCredential.update({
        where: { userId_provider: { userId, provider } },
        data: {
          status: 'invalid',
          isEnabled: false,
          lastTestedAt: new Date(),
          lastTestMessage: safe.message,
        },
      });
      if (error instanceof UnprocessableEntityException) throw error;
      throw new BadGatewayException({ code: safe.code, message: safe.message });
    }
  }

  async listModels(userId: string, rawProvider: string) {
    const provider = this.parseProvider(rawProvider);
    const credential = await this.resolveStored(userId, provider, true);
    if (provider === 'qwen') {
      try {
        return await this.listQwenModels(credential.baseUrl, credential.apiKey || '', provider);
      } catch (error) {
        const safe = this.safeUpstreamError(error);
        this.logger.warn(`Qwen model catalog unavailable (${safe.code}); using fallback catalog`);
        return QWEN_FALLBACK_MODELS.map((id) => ({ id, displayName: id, provider }));
      }
    }
    try {
      if (provider === 'openai') {
        const response = await axios.get(`${credential.baseUrl}/models`, {
          headers: { Authorization: `Bearer ${credential.apiKey}` },
          timeout: 15000,
          maxRedirects: 0,
        });
        const items = Array.isArray(response.data?.data) ? response.data.data : [];
        return items
          .map((item: any) => String(item?.id || ''))
          .filter(Boolean)
          .sort()
          .map((id: string) => ({ id, displayName: id, provider }));
      }
      const response = await axios.get(`${credential.baseUrl}/api/tags`, {
        timeout: 15000,
        maxRedirects: 0,
      });
      const items = Array.isArray(response.data?.models) ? response.data.models : [];
      return items
        .map((item: any) => String(item?.name || item?.model || ''))
        .filter(Boolean)
        .map((id: string) => ({ id, displayName: id, provider }));
    } catch (error) {
      const safe = this.safeUpstreamError(error);
      throw new BadGatewayException({ code: safe.code, message: safe.message });
    }
  }

  private async listQwenModels(
    baseUrl: string,
    apiKey: string,
    provider: UserModelProvider,
  ) {
    const catalogUrl = new URL('/api/v1/models', baseUrl).toString();
    const pageSize = 100;
    const models = new Map<string, string>();

    for (let page = 1; page <= 10; page += 1) {
      const params = new URLSearchParams({
        providers: 'qwen',
        capabilities: 'TG',
        page_no: String(page),
        page_size: String(pageSize),
        language: 'zh-CN',
      });
      const response = await axios.get<QwenCatalogResponse>(catalogUrl, {
        params,
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
        maxRedirects: 0,
      });
      const pageModels = Array.isArray(response.data?.output?.models)
        ? response.data.output.models
        : [];

      for (const item of pageModels) {
        const id = typeof item.model === 'string' ? item.model.trim() : '';
        if (!id) continue;
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        models.set(id, name && name !== id ? `${name}（${id}）` : id);
      }

      const total = Number(response.data?.output?.total || 0);
      if (pageModels.length < pageSize || models.size >= total) break;
    }

    if (models.size === 0) throw new Error('Qwen model catalog returned no models');
    for (const id of QWEN_FALLBACK_MODELS) {
      if (!models.has(id)) models.set(id, id);
    }
    return Array.from(models, ([id, displayName]) => ({ id, displayName, provider }));
  }

  async resolveStored(
    userId: string,
    provider: UserModelProvider,
    requireValid = true,
  ): Promise<ResolvedModelCredential> {
    const record = await this.getRecord(userId, provider);
    if (requireValid && (!record.isEnabled || record.status !== 'valid')) {
      throw new UnprocessableEntityException({
        code: 'MODEL_CREDENTIAL_UNAVAILABLE',
        message: `${provider} 模型凭证尚未测试成功或已停用`,
      });
    }
    const baseUrl = await this.baseUrlSecurity.assertAllowed(record.baseUrl);
    let apiKey: string | undefined;
    if (record.encryptedApiKey && record.encryptionIv && record.encryptionTag) {
      apiKey = this.crypto.decrypt(
        {
          ciphertext: record.encryptedApiKey,
          iv: record.encryptionIv,
          tag: record.encryptionTag,
        },
        this.context(userId, provider),
      );
    }
    if (provider !== 'ollama' && !apiKey) {
      throw new UnprocessableEntityException({
        code: 'MODEL_CREDENTIAL_REQUIRED',
        message: `${provider} API Key 尚未配置`,
      });
    }
    return { provider, baseUrl, apiKey };
  }

  private async getRecord(userId: string, provider: UserModelProvider) {
    const record = await this.prisma.modelCredential.findUnique({
      where: { userId_provider: { userId, provider } },
    });
    if (!record) {
      throw new UnprocessableEntityException({
        code: 'MODEL_CREDENTIAL_REQUIRED',
        message: `${provider} 模型服务尚未配置`,
      });
    }
    return record;
  }

  private parseProvider(value: string): UserModelProvider {
    if (!isUserModelProvider(value)) {
      throw new UnprocessableEntityException({
        code: 'MODEL_PROVIDER_NOT_SUPPORTED',
        message: '仅支持 qwen、openai 和 ollama',
      });
    }
    return value;
  }

  private encryptKey(apiKey: string, userId: string, provider: UserModelProvider) {
    const encrypted = this.crypto.encrypt(apiKey, this.context(userId, provider));
    const visibleLength = apiKey.length >= 12 ? 4 : Math.min(2, Math.floor(apiKey.length / 3));
    return {
      encryptedApiKey: encrypted.ciphertext,
      encryptionIv: encrypted.iv,
      encryptionTag: encrypted.tag,
      keyPrefix: apiKey.slice(0, visibleLength),
      keySuffix: visibleLength > 0 ? apiKey.slice(-visibleLength) : '',
    };
  }

  private emptySecret() {
    return {
      encryptedApiKey: null,
      encryptionIv: null,
      encryptionTag: null,
      keyPrefix: null,
      keySuffix: null,
    };
  }

  private context(userId: string, provider: UserModelProvider) {
    return `model-credential:${userId}:${provider}`;
  }

  private toSummary(item: any) {
    return {
      provider: item.provider,
      baseUrl: item.baseUrl,
      hasApiKey: Boolean(item.encryptedApiKey),
      apiKeyMasked: item.keyPrefix && item.keySuffix
        ? `${item.keyPrefix}${'*'.repeat(8)}${item.keySuffix}`
        : undefined,
      status: item.status,
      isEnabled: item.isEnabled,
      configured: true,
      lastTestedAt: item.lastTestedAt,
      lastTestMessage: item.lastTestMessage,
      updatedAt: item.updatedAt,
    };
  }

  private safeUpstreamError(error: unknown) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    if (status === 401 || status === 403) {
      return { code: 'MODEL_UPSTREAM_AUTH_FAILED', message: '上游服务拒绝认证，请检查 API Key' };
    }
    if (axiosError.code === 'ECONNABORTED') {
      return { code: 'MODEL_UPSTREAM_TIMEOUT', message: '模型服务连接超时' };
    }
    return { code: 'MODEL_UPSTREAM_UNAVAILABLE', message: '无法连接模型服务，请检查 Base URL 和服务状态' };
  }
}
