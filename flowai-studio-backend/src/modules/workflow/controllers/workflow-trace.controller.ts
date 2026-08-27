/**
 * 工作流 Trace 控制器
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { TracingService } from '../services/tracing.service';

@Controller('traces')
@UseGuards(JwtAuthGuard)
export class WorkflowTraceController {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * 获取 Trace 详情
   */
  @Get(':traceId')
  async getTrace(@CurrentUser('userId') userId: string, @Param('traceId') traceId: string) {
    return this.tracingService.getTrace(userId, traceId);
  }

  /**
   * 获取工作流的 Trace 列表
   */
  @Get('workflow/:workflowId')
  async getWorkflowTraces(
    @CurrentUser('userId') userId: string,
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.tracingService.getWorkflowTraces(userId, workflowId, limit ? Number(limit) : 20);
  }

  /**
   * 获取慢 Trace
   */
  @Get('slow/list')
  async getSlowTraces(
    @CurrentUser('userId') userId: string,
    @Query('workflowId') workflowId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tracingService.getSlowTraces(userId, workflowId, limit ? Number(limit) : 10);
  }

  /**
   * 获取 Trace 统计
   */
  @Get('stats/overview')
  async getTraceStats(@CurrentUser('userId') userId: string, @Query('workflowId') workflowId?: string) {
    return this.tracingService.getTraceStats(userId, workflowId);
  }
}
