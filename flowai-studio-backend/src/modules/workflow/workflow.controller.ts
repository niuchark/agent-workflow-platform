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
import { WorkflowService } from './workflow.service';
import { WorkflowExecutorService } from './services/workflow-executor.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { RunWorkflowDto } from './dto/run-workflow.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimiterService, CircuitBreakerService, DEFAULT_RATE_LIMITS } from '../../common/guards/rate-limit.guard';

@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowExecutorService: WorkflowExecutorService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  @Post()
  create(
    @CurrentUser('userId') userId: string,
    @Body() createWorkflowDto: CreateWorkflowDto,
  ) {
    return this.workflowService.create(userId, createWorkflowDto);
  }

  @Get('app/:appId')
  findByApp(
    @CurrentUser('userId') userId: string,
    @Param('appId') appId: string,
  ) {
    return this.workflowService.findByApp(userId, appId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.workflowService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() updateWorkflowDto: UpdateWorkflowDto,
  ) {
    return this.workflowService.update(userId, id, updateWorkflowDto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
  ) {
    return this.workflowService.remove(userId, id);
  }

  @Post(':id/run')
  async run(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() runWorkflowDto: RunWorkflowDto,
  ) {
    // 并发控制
    const concurrentKey = `concurrent:workflow:${userId}`;
    const workflowConfig = DEFAULT_RATE_LIMITS['workflow:run'];
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
      throw new HttpException(
        '工作流执行已被熔断保护，请稍后再试',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
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

  @Post(':id/run/stream')
  async streamRun(
    @CurrentUser('userId') userId: string,
    @Param('id') id: string,
    @Body() runWorkflowDto: RunWorkflowDto,
    @Res() res: Response,
  ) {
    // 并发控制
    const concurrentKey = `concurrent:workflow:${userId}`;
    const workflowConfig = DEFAULT_RATE_LIMITS['workflow:run'];
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
    const executionId = `${id}_${Date.now()}`;

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
    res.on('close', () => {
      this.workflowExecutorService.cancelExecution(executionId);
      this.rateLimiterService.releaseConcurrent(concurrentKey);
    });

    // 注入 userId 供节点执行器使用
    runWorkflowDto.userId = userId;

    try {
      await this.workflowExecutorService.executeWorkflow(
        id,
        runWorkflowDto,
        sseSubject,
        executionId,
      );
      await this.circuitBreakerService.recordSuccess('workflow');
      sseSubject.complete();
    } catch (error) {
      await this.circuitBreakerService.recordFailure('workflow');
      sseSubject.error(error);
    } finally {
      await this.rateLimiterService.releaseConcurrent(concurrentKey);
    }
  }

  /**
   * 取消正在运行的工作流执行
   *
   * Phase 4.1: 主动取消机制
   */
  @Post(':id/cancel/:executionId')
  cancelExecution(
    @CurrentUser('userId') userId: string,
    @Param('executionId') executionId: string,
  ) {
    const cancelled = this.workflowExecutorService.cancelExecution(executionId);
    return {
      success: cancelled,
      message: cancelled
        ? 'Execution cancellation requested'
        : 'Execution not found or already completed',
    };
  }

  /**
   * 获取正在运行的工作流执行列表
   */
  @Get(':id/running')
  getRunningExecutions(@CurrentUser('userId') userId: string) {
    return {
      executions: this.workflowExecutorService.getRunningExecutions(),
    };
  }
}
