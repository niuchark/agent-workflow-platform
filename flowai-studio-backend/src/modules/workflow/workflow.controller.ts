/**
 * 工作流控制器：工作流 CRUD 与执行（普通 / SSE 流式）接口。
 *
 * 执行接口带并发上限与熔断保护；流式执行通过 RxJS Subject
 * 把节点状态实时写入 SSE 响应，客户端断开时自动取消执行。
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { Subject } from 'rxjs';
import { randomUUID } from 'crypto';
import { WorkflowService } from './workflow.service';
import { WorkflowExecutorService } from './services/workflow-executor.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimiterService, CircuitBreakerService, DEFAULT_RATE_LIMITS } from '../../common/services/rate-limit.service';
import { PERMISSIONS } from '../../common/constants/permissions';

/** 工作流 REST 控制器 */
@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowExecutorService: WorkflowExecutorService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /** 创建工作流 */
  @Post()
  create(@CurrentUser('userId') userId: string, @Body() createWorkflowDto: CreateWorkflowDto) {
    return this.workflowService.create(userId, createWorkflowDto);
  }

  /** 获取某应用下的工作流列表 */
  @Get('app/:appId')
  findByApp(@CurrentUser('userId') userId: string, @Param('appId') appId: string) {
    return this.workflowService.findByApp(userId, appId);
  }

  /** 获取工作流详情 */
  @Get(':id')
  findOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.workflowService.findOne(userId, id);
  }

  /** 更新工作流 */
  @Patch(':id')
  update(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowService.update(userId, id, updateWorkflowDto);
  }

  /** 删除工作流 */
  @Delete(':id')
  remove(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.workflowService.remove(userId, id);
  }

  /** 普通方式运行工作流：阻塞等待完整结果 */
  @Post(':id/run')
  async run(@CurrentUser('userId') userId: string, @Param('id') id: string, @Body() runWorkflowDto: RunWorkflowDto) {
    // 在占用执行配额前确认工作流归属，避免越权请求消耗公共资源。
    await this.workflowService.findOne(userId, id, PERMISSIONS.WORKFLOW_EXECUTE);

    const workflowConfig = DEFAULT_RATE_LIMITS['workflow:run'];
    const rateLimit = await this.rateLimiterService.checkRateLimit(
      `rate_limit:workflow:run:${userId}`,
      workflowConfig,
    );
    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: '工作流执行请求过于频繁，请稍后再试',
          retryAfter: rateLimit.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 并发控制
    const concurrentKey = `concurrent:workflow:${userId}`;
    const concurrent = await this.rateLimiterService.acquireConcurrent(
      concurrentKey,
      workflowConfig.maxConcurrent || 0,
    );
    if (!concurrent.allowed) {
      throw new HttpException(
        `并发执行数已达上限 (${workflowConfig.maxConcurrent})，请稍后再试`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 熔断检查
    const circuitAllowed = await this.circuitBreakerService.isAllowed('workflow');
    if (!circuitAllowed) {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
      throw new HttpException('工作流执行已被熔断保护，请稍后再试', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // 注入 userId 供节点执行器使用（如 Token 使用量记录）
    runWorkflowDto.userId = userId;

    try {
      const result = await this.workflowExecutorService.executeWorkflow(id, runWorkflowDto);
      await this.circuitBreakerService.recordSuccess('workflow');
      return result;
    } catch (error) {
      await this.circuitBreakerService.recordFailure('workflow');
      throw error;
    } finally {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
    }
  }

  /** 流式运行工作流：SSE 推送节点级状态 */
  @Post(':id/run/stream')
  async streamRun(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() runWorkflowDto: RunWorkflowDto,
    @Res() res: Response,
  ) {
    // 与非流式入口使用同一归属校验，且必须早于配额与 SSE 初始化。
    await this.workflowService.findOne(userId, id, PERMISSIONS.WORKFLOW_EXECUTE);

    const workflowConfig = DEFAULT_RATE_LIMITS['workflow:run'];
    const rateLimit = await this.rateLimiterService.checkRateLimit(
      `rate_limit:workflow:run:${userId}`,
      workflowConfig,
    );
    if (!rateLimit.allowed) {
      res.status(429).json({
        statusCode: 429,
        message: '工作流执行请求过于频繁，请稍后再试',
        retryAfter: rateLimit.retryAfter,
      });
      return;
    }

    // 并发控制
    const concurrentKey = `concurrent:workflow:${userId}`;
    const concurrent = await this.rateLimiterService.acquireConcurrent(
      concurrentKey,
      workflowConfig.maxConcurrent || 0,
    );
    if (!concurrent.allowed) {
      res.status(429).json({
        statusCode: 429,
        message: `并发执行数已达上限 (${workflowConfig.maxConcurrent})，请稍后再试`,
      });
      return;
    }

    // 熔断检查
    const circuitAllowed = await this.circuitBreakerService.isAllowed('workflow');
    if (!circuitAllowed) {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
      res.status(503).json({
        statusCode: 503,
        message: '工作流执行已被熔断保护，请稍后再试',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // 禁用 Nginx 缓冲，确保 SSE 实时推送
    res.setHeader('X-Accel-Buffering', 'no');

    const sseSubject = new Subject<any>();
    const executionId = `${id}_${randomUUID()}`;
    let releasePromise: Promise<void> | undefined;
    const releaseConcurrent = (): Promise<void> => {
      releasePromise ??= this.rateLimiterService.releaseConcurrent(concurrentKey);
      return releasePromise;
    };

    sseSubject.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      complete: () => {
        res.end();
      },
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      },
    });

    // 客户端断开连接时取消执行（避免资源浪费）
    const handleClose = () => {
      this.workflowExecutorService.cancelExecution(executionId, userId, id);
      void releaseConcurrent().catch(() => undefined);
    };
    res.once('close', handleClose);

    // 注入 userId 供节点执行器使用
    runWorkflowDto.userId = userId;

    try {
      await this.workflowExecutorService.executeWorkflow(id, runWorkflowDto, sseSubject, executionId);
      await this.circuitBreakerService.recordSuccess('workflow');
      sseSubject.complete();
    } catch (error) {
      await this.circuitBreakerService.recordFailure('workflow');
      sseSubject.error(error);
    } finally {
      await releaseConcurrent();
    }
  }

  /**
   * 取消正在运行的工作流执行
   *
   * Phase 4.1: 主动取消机制
   */
  /** 取消正在运行的工作流执行 */
  @Post(':id/cancel/:executionId')
  cancelExecution(
    @CurrentUser('userId') userId: string,
    @Param('id') workflowId: string,
    @Param('executionId') executionId: string,
  ) {
    const cancelled = this.workflowExecutorService.cancelExecution(executionId, userId, workflowId);
    return {
      success: cancelled,
      message: cancelled ? 'Execution cancellation requested' : 'Execution not found or already completed',
    };
  }

  /**
   * 获取正在运行的工作流执行列表
   */
  /** 获取正在运行的工作流执行列表 */
  @Get(':id/running')
  getRunningExecutions(@CurrentUser('userId') userId: string, @Param('id') workflowId: string) {
    return {
      executions: this.workflowExecutorService.getRunningExecutions(userId, workflowId),
    };
  }
}
