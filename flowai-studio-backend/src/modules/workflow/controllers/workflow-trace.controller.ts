/**
 * 工作流 Trace 控制器
 */
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TracingService } from '../services/tracing.service';

@Controller('traces')
@UseGuards(JwtAuthGuard)
export class WorkflowTraceController {
  constructor(private readonly tracingService: TracingService) {}

  /**
   * 获取 Trace 详情
   */
  @Get(':traceId')
  async getTrace(@Param('traceId') traceId: string) {
    return this.tracingService.getTrace(traceId);
  }

  /**
   * 获取工作流的 Trace 列表
   */
  @Get('workflow/:workflowId')
  async getWorkflowTraces(
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.tracingService.getWorkflowTraces(workflowId, limit ? Number(limit) : 20);
  }

  /**
   * 获取慢 Trace
   */
  @Get('slow/list')
  async getSlowTraces(
    @Query('workflowId') workflowId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tracingService.getSlowTraces(workflowId, limit ? Number(limit) : 10);
  }

  /**
   * 获取 Trace 统计
   */
  @Get('stats/overview')
  async getTraceStats(@Query('workflowId') workflowId?: string) {
    return this.tracingService.getTraceStats(workflowId);
  }
}
