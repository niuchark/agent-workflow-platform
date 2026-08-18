/**
 * 全链路 Tracing 服务
 *
 * 竞品对比:
 * - Dify: 基于 OpenTelemetry 的 Tracing，记录 LLM 调用 / 工具调用 / 工作流节点
 * - Coze: 自研 Trace 体系，支持节点级耗时分析
 * - n8n: 执行日志 + 节点执行统计
 * - 本设计: WorkflowTrace + SpanRecord + 自动插桩，支持 trace 树状可视化
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/services/prisma.service';
import { randomUUID } from 'crypto';

export interface StartTraceParams {
  workflowId: string;
  userId?: string;
  applicationId?: string;
  executionId?: string;
  inputs?: Record<string, any>;
}

export interface StartSpanParams {
  traceId: string;
  name: string;
  parentSpanId?: string;
  kind?: 'internal' | 'client' | 'server';
  attributes?: Record<string, any>;
}

@Injectable()
export class TracingService {
  private readonly logger = new Logger(TracingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成 Trace ID
   */
  generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * 生成 Span ID
   */
  generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  /**
   * 开始一个 Trace
   */
  async startTrace(params: StartTraceParams): Promise<string> {
    const traceId = this.generateTraceId();

    try {
      await this.prisma.workflowTrace.create({
        data: {
          traceId,
          workflowId: params.workflowId,
          userId: params.userId,
          applicationId: params.applicationId,
          executionId: params.executionId,
          inputs: params.inputs ? JSON.stringify(params.inputs) : null,
          status: 'running',
        },
      });

      return traceId;
    } catch (error) {
      this.logger.warn(`Failed to start trace: ${error instanceof Error ? error.message : 'Unknown'}`);
      return traceId; // 仍然返回 traceId，不影响业务
    }
  }

  /**
   * 结束一个 Trace
   */
  async endTrace(traceId: string, status: string, outputs?: Record<string, any>, error?: string): Promise<void> {
    try {
      // 计算 trace 的总耗时
      const trace = await this.prisma.workflowTrace.findUnique({
        where: { traceId },
        include: { spans: true },
      });

      if (!trace) return;

      const totalMs = Date.now() - trace.startedAt.getTime();

      await this.prisma.workflowTrace.update({
        where: { traceId },
        data: {
          status,
          totalMs,
          spanCount: trace.spans.length,
          outputs: outputs ? JSON.stringify(outputs) : null,
          error: error || null,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to end trace ${traceId}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  /**
   * 开始一个 Span
   */
  async startSpan(params: StartSpanParams): Promise<string> {
    const spanId = this.generateSpanId();

    try {
      await this.prisma.spanRecord.create({
        data: {
          spanId,
          traceId: params.traceId,
          parentSpanId: params.parentSpanId || null,
          name: params.name,
          kind: params.kind || 'internal',
          status: 'ok',
          startTime: new Date(),
          attributes: params.attributes ? JSON.stringify(params.attributes) : null,
        },
      });

      return spanId;
    } catch (error) {
      this.logger.warn(`Failed to start span: ${error instanceof Error ? error.message : 'Unknown'}`);
      return spanId; // 不影响业务
    }
  }

  /**
   * 结束一个 Span
   */
  async endSpan(spanId: string, status?: string, events?: Record<string, any>[]): Promise<void> {
    try {
      const span = await this.prisma.spanRecord.findUnique({
        where: { spanId },
      });

      if (!span) return;

      const endTime = new Date();
      const durationMs = endTime.getTime() - span.startTime.getTime();

      await this.prisma.spanRecord.update({
        where: { spanId },
        data: {
          endTime,
          durationMs,
          status: status || span.status,
          events: events ? JSON.stringify(events) : null,
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to end span ${spanId}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * 查询 Trace 详情
   */
  async getTrace(traceId: string) {
    const trace = await this.prisma.workflowTrace.findUnique({
      where: { traceId },
      include: {
        spans: { orderBy: { startTime: 'asc' } },
      },
    });

    if (!trace) return null;

    return {
      ...trace,
      inputs: trace.inputs ? JSON.parse(trace.inputs) : null,
      outputs: trace.outputs ? JSON.parse(trace.outputs) : null,
      spans: trace.spans.map((span) => ({
        ...span,
        attributes: span.attributes ? JSON.parse(span.attributes) : null,
        events: span.events ? JSON.parse(span.events) : null,
      })),
    };
  }

  /**
   * 查询工作流的 Trace 列表
   */
  async getWorkflowTraces(workflowId: string, limit: number = 20) {
    const traces = await this.prisma.workflowTrace.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { spans: true } },
      },
    });

    return traces.map((t) => ({
      ...t,
      inputs: t.inputs ? JSON.parse(t.inputs) : null,
      outputs: t.outputs ? JSON.parse(t.outputs) : null,
    }));
  }

  /**
   * 查询慢 Trace（按耗时排序）
   */
  async getSlowTraces(workflowId?: string, limit: number = 10) {
    const where = workflowId ? { workflowId, totalMs: { not: null } } : { totalMs: { not: null } };

    return this.prisma.workflowTrace.findMany({
      where,
      orderBy: { totalMs: 'desc' },
      take: limit,
    });
  }

  /**
   * 获取 Trace 统计
   */
  async getTraceStats(workflowId?: string) {
    const where = workflowId ? { workflowId } : {};

    const [total, success, failed, avgDuration] = await Promise.all([
      this.prisma.workflowTrace.count({ where }),
      this.prisma.workflowTrace.count({ where: { ...where, status: 'success' } }),
      this.prisma.workflowTrace.count({ where: { ...where, status: 'failed' } }),
      this.prisma.workflowTrace.aggregate({
        where: { ...where, totalMs: { not: null } },
        _avg: { totalMs: true },
      }),
    ]);

    return {
      total,
      success,
      failed,
      successRate: total > 0 ? (success / total * 100).toFixed(1) : '0',
      avgDurationMs: avgDuration._avg.totalMs || 0,
    };
  }
}
