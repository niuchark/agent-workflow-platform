/**
 * LLM 模型管理 Service
 *
 * 提供:
 * - 模型列表查询（按 Provider 分组）
 * - 模型能力查询
 * - Provider 健康检查
 * - Token 成本估算
 * - Ollama 本地模型发现
 */
import { Injectable, Logger } from '@nestjs/common';
import { LLMProviderFactory } from '../providers/llm-provider.factory';
import {
  LLMModelInfo,
  LLMProviderType,
} from '../interfaces/llm-provider.interface';
import { ModelCredentialService } from '../../model-credential/model-credential.service';
import { UserModelProvider } from '../../model-credential/model-credential.types';

@Injectable()
export class LLMModelService {
  private readonly logger = new Logger(LLMModelService.name);

  constructor(
    private readonly providerFactory: LLMProviderFactory,
    private readonly modelCredentials: ModelCredentialService,
  ) {}

  /**
   * 获取所有可用模型（按 Provider 分组）
   */
  async getModelsGroupByProvider(userId: string): Promise<Record<string, {
    provider: LLMProviderType;
    description: string;
    models: LLMModelInfo[];
  }>> {
    const summaries = await this.modelCredentials.list(userId);
    const result: Record<string, {
      provider: LLMProviderType;
      description: string;
      models: LLMModelInfo[];
    }> = {};

    for (const summary of summaries) {
      const type = summary.provider as UserModelProvider;
      const description = `${type} 用户模型服务`;
      if (!summary.isEnabled || summary.status !== 'valid') {
        result[type] = { provider: type, description, models: [] };
        continue;
      }
      try {
        const discovered = await this.modelCredentials.listModels(userId, type);
        result[type] = {
          provider: type,
          description,
          models: discovered.map((model: any) => this.toModelInfo(type, model.id, model.displayName)),
        };
      } catch {
        result[type] = {
          provider: type,
          description,
          models: [],
        };
      }
    }

    return result;
  }

  /**
   * 获取所有模型（扁平列表）
   */
  async getAllModels(userId: string): Promise<LLMModelInfo[]> {
    const groups = await this.getModelsGroupByProvider(userId);
    return Object.values(groups).flatMap((group) => group.models);
  }

  /**
   * 获取指定模型信息
   */
  getModelInfo(modelId: string): LLMModelInfo | undefined {
    return this.providerFactory.getModelInfo(modelId);
  }

  /**
   * 健康检查所有 Provider
   */
  async healthCheck(userId: string): Promise<Record<string, {
    available: boolean;
    models: number;
  }>> {
    const groups = await this.getModelsGroupByProvider(userId);
    return Object.fromEntries(Object.entries(groups).map(([provider, group]) => [
      provider,
      { available: group.models.length > 0, models: group.models.length },
    ]));
  }

  /**
   * 估算 Token 成本
   */
  estimateCost(modelId: string, promptTokens: number, completionTokens: number): {
    modelId: string;
    promptTokens: number;
    completionTokens: number;
    costUSD: number;
  } {
    const cost = this.providerFactory.estimateCost(modelId, promptTokens, completionTokens);
    return {
      modelId,
      promptTokens,
      completionTokens,
      costUSD: cost,
    };
  }

  /**
   * 发现 Ollama 本地模型
   */
  async discoverOllamaModels(userId: string): Promise<LLMModelInfo[]> {
    try {
      const models = await this.modelCredentials.listModels(userId, 'ollama');
      return models.map((model: any) => this.toModelInfo('ollama', model.id, model.displayName));
    } catch {
      this.logger.warn('Failed to discover Ollama models');
      return [];
    }
  }

  private toModelInfo(provider: UserModelProvider, id: string, displayName: string): LLMModelInfo {
    const known = this.providerFactory.getModelInfo(id);
    if (known && known.provider === provider) return known;
    return {
      id,
      displayName,
      provider,
      capabilities: {
        functionCalling: provider !== 'ollama',
        vision: false,
        streaming: true,
        jsonMode: provider !== 'ollama',
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
      },
    };
  }
}
