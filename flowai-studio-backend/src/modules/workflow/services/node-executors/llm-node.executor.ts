/**
 * 大模型节点执行器：调用 LLM 生成回答并记录 Token 用量。
 */
import { Injectable } from '@nestjs/common';
import { INodeExecutor } from '../../types';
import { AiService } from '../../../ai/ai.service';
import { TokenUsageService } from '../../../agent/services/token-usage.service';

@Injectable()
export class LLMNodeExecutor implements INodeExecutor {
  constructor(
    private readonly aiService: AiService,
    private readonly tokenUsageService: TokenUsageService,
  ) {}

  /** 解析提示词 → 调用模型 → 异步记录用量 → 返回 result */
  async execute(
    node: any,
    context: Record<string, any>,
    signal?: AbortSignal,
  ): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { model, provider, systemPrompt, userPrompt, temperature, maxTokens } = nodeData;

    // 替换上下文变量
    const resolvedUserPrompt = this.resolveVariables(userPrompt, context);

    // 使用增强版 chatWithLLMAndUsage 获取 usage 信息
    const userId = context._userId as string | undefined;
    if (!userId) throw new Error('MODEL_CREDENTIAL_REQUIRED: workflow user is missing');
    const { content, usage } = await this.aiService.chatWithLLMAndUsage(
      userId,
      resolvedUserPrompt,
      systemPrompt,
      [], // 暂不支持多轮对话历史
      model,
      temperature,
      maxTokens,
      provider,
      signal,
    );

    // 记录 Token 使用量（异步，非阻塞）
    const workflowId = context._workflowId as string | undefined;
    const executionId = context._executionId as string | undefined;
    const applicationId = context._applicationId as string | undefined;
    if (userId && usage.totalTokens > 0) {
      this.tokenUsageService.recordFromResponse({
        userId,
        applicationId,
        workflowId,
        executionId,
        provider: provider || this.inferProvider(model),
        model,
        usage,
        callType: 'chat',
      });
    }

    return { result: content };
  }

  /**
   * 根据模型名称推断 Provider
   */
  /** 根据模型名称推断 Provider */
  private inferProvider(model: string): string {
    if (model.startsWith('gpt-') || model.startsWith('o1-')) return 'openai';
    if (model.startsWith('claude-')) return 'claude';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('qwen-')) return 'qwen';
    if (model.includes(':')) return 'ollama';
    return 'qwen';
  }

  /** 把提示词模板中的变量引用替换为上下文实际值 */
  private resolveVariables(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(.+?)\}\}/g, (match, p1) => {
      const keys = p1.trim().split('.');
      let value = context;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return match;
        }
      }
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    });
  }
}
