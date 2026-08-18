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

  async execute(node: any, context: Record<string, any>): Promise<Record<string, any>> {
    const nodeData = node.data as any;
    const { model, systemPrompt, userPrompt, temperature, maxTokens } = nodeData;

    // 替换上下文变量
    const resolvedUserPrompt = this.resolveVariables(userPrompt, context);

    // 使用增强版 chatWithLLMAndUsage 获取 usage 信息
    const { content, usage } = await this.aiService.chatWithLLMAndUsage(
      resolvedUserPrompt,
      systemPrompt,
      [], // 暂不支持多轮对话历史
      model,
      temperature,
      maxTokens,
    );

    // 记录 Token 使用量（异步，非阻塞）
    const workflowId = context._workflowId as string | undefined;
    const executionId = context._executionId as string | undefined;
    const applicationId = context._applicationId as string | undefined;
    const userId = context._userId as string | undefined;

    if (userId && usage.totalTokens > 0) {
      this.tokenUsageService.recordFromResponse({
        userId,
        applicationId,
        workflowId,
        executionId,
        provider: this.inferProvider(model),
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
  private inferProvider(model: string): string {
    if (model.startsWith('gpt-') || model.startsWith('o1-')) return 'openai';
    if (model.startsWith('claude-')) return 'claude';
    if (model.startsWith('gemini-')) return 'gemini';
    if (model.startsWith('qwen-')) return 'qwen';
    return 'unknown';
  }

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
