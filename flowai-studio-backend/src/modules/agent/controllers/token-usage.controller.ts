import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TokenUsageService } from '../services/token-usage.service';
import { GetTokenUsageDto, GetCostReportDto } from '../dto/token-usage.dto';

@Controller('token-usage')
@UseGuards(JwtAuthGuard)
export class TokenUsageController {
  constructor(private tokenUsageService: TokenUsageService) {}

  /**
   * GET /token-usage
   * 查询 Token 使用量列表 + 汇总
   */
  @Get()
  async getUsage(@Request() req: any, @Query() dto: GetTokenUsageDto) {
    return this.tokenUsageService.getUsage(req.user.id, dto);
  }

  /**
   * GET /token-usage/cost-report
   * 成本报表（按时间/模型/Provider 分组）
   */
  @Get('cost-report')
  async getCostReport(@Request() req: any, @Query() dto: GetCostReportDto) {
    return this.tokenUsageService.getCostReport(req.user.id, dto);
  }

  /**
   * GET /token-usage/model-ranking
   * 模型使用排行
   */
  @Get('model-ranking')
  async getModelRanking(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tokenUsageService.getModelRanking(req.user.id, startDate, endDate);
  }
}
