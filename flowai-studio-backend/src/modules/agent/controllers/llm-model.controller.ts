/**
 * LLM 模型管理 Controller
 *
 * 提供模型列表、能力查询、健康检查、成本估算等 API
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LLMModelService } from '../services/llm-model.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('llm')
@UseGuards(JwtAuthGuard)
export class LLMModelController {
  constructor(private readonly llmModelService: LLMModelService) {}

  /**
   * GET /llm/models
   * 获取所有可用模型（按 Provider 分组）
   */
  @Get('models')
  getModels(@CurrentUser('userId') userId: string) {
    return this.llmModelService.getModelsGroupByProvider(userId);
  }

  /**
   * GET /llm/models/list
   * 获取所有模型（扁平列表）
   */
  @Get('models/list')
  getAllModels(@CurrentUser('userId') userId: string) {
    return this.llmModelService.getAllModels(userId);
  }

  /**
   * GET /llm/models/:modelId
   * 获取指定模型信息
   */
  @Get('models/:modelId')
  getModelInfo(@Param('modelId') modelId: string) {
    return this.llmModelService.getModelInfo(modelId);
  }

  /**
   * GET /llm/health
   * 健康检查所有 LLM Provider
   */
  @Get('health')
  async healthCheck(@CurrentUser('userId') userId: string) {
    return this.llmModelService.healthCheck(userId);
  }

  /**
   * GET /llm/cost?modelId=xxx&promptTokens=1000&completionTokens=500
   * 估算 Token 成本
   */
  @Get('cost')
  estimateCost(
    @Query('modelId') modelId: string,
    @Query('promptTokens') promptTokens: string,
    @Query('completionTokens') completionTokens: string,
  ) {
    return this.llmModelService.estimateCost(
      modelId,
      parseInt(promptTokens, 10) || 0,
      parseInt(completionTokens, 10) || 0,
    );
  }

  /**
   * GET /llm/ollama/discover
   * 发现 Ollama 本地模型
   */
  @Get('ollama/discover')
  async discoverOllamaModels(@CurrentUser('userId') userId: string) {
    return this.llmModelService.discoverOllamaModels(userId);
  }
}
