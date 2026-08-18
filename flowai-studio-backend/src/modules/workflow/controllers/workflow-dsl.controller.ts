import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { WorkflowDslService } from '../services/workflow-dsl.service';
import { ImportWorkflowDslDto } from '../dto/workflow-dsl.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

/**
 * Workflow DSL Controller — 工作流导入导出 API
 *
 * Phase 6.1: DSL 导入导出
 *
 * 路由说明:
 * - 使用 /workflow-dsl 前缀避免与 /workflows/:id 参数路由冲突
 * - GET  /workflow-dsl/:id/export        — 导出工作流为 YAML/JSON DSL
 * - POST /workflow-dsl/import             — 从 DSL 导入工作流
 * - POST /workflow-dsl/validate           — 校验 DSL 内容（不实际导入）
 */
@Controller('workflow-dsl')
@UseGuards(JwtAuthGuard)
export class WorkflowDslController {
  constructor(private readonly dslService: WorkflowDslService) {}

  /**
   * 导出工作流为 DSL 格式
   *
   * GET /workflow-dsl/:id/export?format=yaml|json
   */
  @Get(':id/export')
  async exportDsl(
    @CurrentUser('userId') userId: string,
    @Param('id') workflowId: string,
    @Query('format') format: 'yaml' | 'json' = 'yaml',
    @Res() res: Response,
  ) {
    const content = await this.dslService.exportDsl(userId, workflowId, format);

    // 设置响应头，支持文件下载
    const filename = `workflow-${workflowId.slice(0, 8)}`;
    if (format === 'yaml') {
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.yaml"`);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    }

    res.send(content);
  }

  /**
   * 从 DSL 导入工作流
   *
   * POST /workflow-dsl/import
   * Body: { dsl: string, format: 'yaml'|'json', applicationId: string, nameOverride?: string }
   */
  @Post('import')
  async importDsl(
    @CurrentUser('userId') userId: string,
    @Body() dto: ImportWorkflowDslDto,
  ) {
    return this.dslService.importDsl(userId, dto);
  }

  /**
   * 校验 DSL 内容（不实际导入）
   *
   * POST /workflow-dsl/validate
   * Body: { dsl: string, format: 'yaml'|'json' }
   */
  @Post('validate')
  async validateDsl(
    @Body() body: { dsl: string; format: 'yaml' | 'json' },
  ) {
    return this.dslService.validateDsl(body.dsl, body.format);
  }
}
