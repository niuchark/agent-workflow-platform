/**
 * Token 用量控制器：用量明细、成本报表与模型排行查询接口。
 */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TokenUsageService } from '../services/token-usage.service';
import { GetTokenUsageDto, GetCostReportDto, GetModelRankingDto } from '../dto/token-usage.dto';

@Controller('token-usage')
@UseGuards(JwtAuthGuard)
export class TokenUsageController {
  constructor(private tokenUsageService: TokenUsageService) {}

  /**
   * GET /token-usage
   * 查询 Token 使用量列表 + 汇总
   */
  @Get()
  async getUsage(@CurrentUser('userId') userId: string, @Query() dto: GetTokenUsageDto) {
    return this.tokenUsageService.getUsage(userId, dto);
  }

  /**
   * GET /token-usage/cost-report
   * 成本报表（按时间/模型/Provider 分组）
   */
  @Get('cost-report')
  async getCostReport(@CurrentUser('userId') userId: string, @Query() dto: GetCostReportDto) {
    return this.tokenUsageService.getCostReport(userId, dto);
  }

  /**
   * GET /token-usage/model-ranking
   * 模型使用排行
   */
  @Get('model-ranking')
  async getModelRanking(@CurrentUser('userId') userId: string, @Query() dto: GetModelRankingDto) {
    return this.tokenUsageService.getModelRanking(userId, dto.startDate, dto.endDate);
  }
}
