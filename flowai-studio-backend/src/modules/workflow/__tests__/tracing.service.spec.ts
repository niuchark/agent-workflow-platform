/**
 * TracingService 单元测试
 *
 * Phase 6.4 测试覆盖:
 * - startTrace / endTrace 生命周期
 * - startSpan / endSpan 生命周期
 * - ID 生成格式
 * - 查询: getTrace, getWorkflowTraces, getSlowTraces, getTraceStats
 * - 容错: 数据库失败不影响业务
 */
import { TracingService } from '../services/tracing.service';

describe('TracingService', () => {
  let service: TracingService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPrisma = {
      workflowTrace: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
        update: jest.fn(),
      },
      spanRecord: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new TracingService(mockPrisma);
  });

  // ============================================================
  // ID 生成
  // ============================================================
  describe('ID Generation', () => {
    it('generateTraceId should return trace_ prefixed ID', () => {
      const id = service.generateTraceId();
      expect(id).toMatch(/^trace_\d+_[a-z0-9]+$/);
    });

    it('generateSpanId should return span_ prefixed ID', () => {
      const id = service.generateSpanId();
      expect(id).toMatch(/^span_\d+_[a-z0-9]+$/);
    });

    it('should generate unique trace IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => service.generateTraceId()));
      expect(ids.size).toBe(100);
    });

    it('should generate unique span IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => service.generateSpanId()));
      expect(ids.size).toBe(100);
    });
  });

  // ============================================================
  // Trace 生命周期
  // ============================================================
  describe('startTrace', () => {
    it('should create a trace record and return traceId', async () => {
      mockPrisma.workflowTrace.create.mockResolvedValue({ traceId: 'trace_123_abc' });

      const traceId = await service.startTrace({
        workflowId: 'wf_1',
        userId: 'user_1',
        applicationId: 'app_1',
        executionId: 'exec_1',
        inputs: { query: 'hello' },
      });

      expect(traceId).toMatch(/^trace_/);
      expect(mockPrisma.workflowTrace.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workflowId: 'wf_1',
            userId: 'user_1',
            applicationId: 'app_1',
            executionId: 'exec_1',
            status: 'running',
          }),
        }),
      );
    });

    it('should stringify inputs as JSON', async () => {
      mockPrisma.workflowTrace.create.mockResolvedValue({});

      await service.startTrace({
        workflowId: 'wf_1',
        inputs: { key: 'value' },
      });

      const createCall = mockPrisma.workflowTrace.create.mock.calls[0][0];
      expect(createCall.data.inputs).toBe('{"key":"value"}');
    });

    it('should handle null inputs', async () => {
      mockPrisma.workflowTrace.create.mockResolvedValue({});

      await service.startTrace({
        workflowId: 'wf_1',
      });

      const createCall = mockPrisma.workflowTrace.create.mock.calls[0][0];
      expect(createCall.data.inputs).toBeNull();
    });

    it('should still return traceId even if create fails', async () => {
      mockPrisma.workflowTrace.create.mockRejectedValue(new Error('DB error'));

      const traceId = await service.startTrace({
        workflowId: 'wf_1',
      });

      expect(traceId).toMatch(/^trace_/);
    });
  });

  describe('endTrace', () => {
    it('should update trace with status and outputs', async () => {
      const startedAt = new Date(Date.now() - 1000);
      mockPrisma.workflowTrace.findUnique.mockResolvedValue({
        traceId: 'trace_1',
        startedAt,
        spans: [{ id: 's1' }, { id: 's2' }],
      });
      mockPrisma.workflowTrace.update.mockResolvedValue({});

      await service.endTrace('trace_1', 'success', { result: 'done' });

      expect(mockPrisma.workflowTrace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { traceId: 'trace_1' },
          data: expect.objectContaining({
            status: 'success',
            spanCount: 2,
            outputs: '{"result":"done"}',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should update trace with error on failure', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue({
        traceId: 'trace_1',
        startedAt: new Date(),
        spans: [],
      });
      mockPrisma.workflowTrace.update.mockResolvedValue({});

      await service.endTrace('trace_1', 'failed', undefined, 'Node timeout');

      expect(mockPrisma.workflowTrace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
            error: 'Node timeout',
          }),
        }),
      );
    });

    it('should not throw if trace not found', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue(null);

      await expect(service.endTrace('nonexistent', 'success')).resolves.toBeUndefined();
    });

    it('should not throw if update fails', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue({
        traceId: 'trace_1',
        startedAt: new Date(),
        spans: [],
      });
      mockPrisma.workflowTrace.update.mockRejectedValue(new Error('DB error'));

      await expect(service.endTrace('trace_1', 'success')).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // Span 生命周期
  // ============================================================
  describe('startSpan', () => {
    it('should create a span record and return spanId', async () => {
      mockPrisma.spanRecord.create.mockResolvedValue({ spanId: 'span_123_abc' });

      const spanId = await service.startSpan({
        traceId: 'trace_1',
        name: 'llm:node_1',
        kind: 'internal',
        attributes: { nodeId: 'node_1', nodeType: 'llm' },
      });

      expect(spanId).toMatch(/^span_/);
      expect(mockPrisma.spanRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            traceId: 'trace_1',
            name: 'llm:node_1',
            kind: 'internal',
            status: 'ok',
          }),
        }),
      );
    });

    it('should stringify attributes as JSON', async () => {
      mockPrisma.spanRecord.create.mockResolvedValue({});

      await service.startSpan({
        traceId: 'trace_1',
        name: 'test',
        attributes: { key: 'value' },
      });

      const createCall = mockPrisma.spanRecord.create.mock.calls[0][0];
      expect(createCall.data.attributes).toBe('{"key":"value"}');
    });

    it('should default kind to internal', async () => {
      mockPrisma.spanRecord.create.mockResolvedValue({});

      await service.startSpan({
        traceId: 'trace_1',
        name: 'test',
      });

      const createCall = mockPrisma.spanRecord.create.mock.calls[0][0];
      expect(createCall.data.kind).toBe('internal');
    });

    it('should still return spanId even if create fails', async () => {
      mockPrisma.spanRecord.create.mockRejectedValue(new Error('DB error'));

      const spanId = await service.startSpan({
        traceId: 'trace_1',
        name: 'test',
      });

      expect(spanId).toMatch(/^span_/);
    });
  });

  describe('endSpan', () => {
    it('should update span with duration and events', async () => {
      const startTime = new Date(Date.now() - 500);
      mockPrisma.spanRecord.findUnique.mockResolvedValue({
        spanId: 'span_1',
        startTime,
      });
      mockPrisma.spanRecord.update.mockResolvedValue({});

      const events = [{ key: 'output_keys', value: ['result'] }];

      await service.endSpan('span_1', 'ok', events);

      expect(mockPrisma.spanRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { spanId: 'span_1' },
          data: expect.objectContaining({
            status: 'ok',
            durationMs: expect.any(Number),
            endTime: expect.any(Date),
            events: JSON.stringify(events),
          }),
        }),
      );
    });

    it('should update span with error status', async () => {
      mockPrisma.spanRecord.findUnique.mockResolvedValue({
        spanId: 'span_1',
        startTime: new Date(),
      });
      mockPrisma.spanRecord.update.mockResolvedValue({});

      const events = [{ key: 'error', value: 'timeout' }];
      await service.endSpan('span_1', 'error', events);

      const updateCall = mockPrisma.spanRecord.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('error');
    });

    it('should not throw if span not found', async () => {
      mockPrisma.spanRecord.findUnique.mockResolvedValue(null);

      await expect(service.endSpan('nonexistent', 'ok')).resolves.toBeUndefined();
    });

    it('should not throw if update fails', async () => {
      mockPrisma.spanRecord.findUnique.mockResolvedValue({
        spanId: 'span_1',
        startTime: new Date(),
      });
      mockPrisma.spanRecord.update.mockRejectedValue(new Error('DB error'));

      await expect(service.endSpan('span_1', 'ok')).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // 查询
  // ============================================================
  describe('getTrace', () => {
    it('should return trace with parsed JSON fields', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue({
        traceId: 'trace_1',
        inputs: '{"query":"hello"}',
        outputs: '{"result":"world"}',
        spans: [
          {
            spanId: 'span_1',
            attributes: '{"nodeType":"llm"}',
            events: '[{"key":"duration","value":100}]',
            startTime: new Date(),
          },
        ],
      });

      const trace = await service.getTrace('trace_1');

      expect(trace).not.toBeNull();
      expect(trace!.inputs).toEqual({ query: 'hello' });
      expect(trace!.outputs).toEqual({ result: 'world' });
      expect(trace!.spans[0].attributes).toEqual({ nodeType: 'llm' });
      expect(trace!.spans[0].events).toEqual([{ key: 'duration', value: 100 }]);
    });

    it('should return null if trace not found', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue(null);

      const trace = await service.getTrace('nonexistent');
      expect(trace).toBeNull();
    });

    it('should handle null JSON fields', async () => {
      mockPrisma.workflowTrace.findUnique.mockResolvedValue({
        traceId: 'trace_1',
        inputs: null,
        outputs: null,
        spans: [
          {
            spanId: 'span_1',
            attributes: null,
            events: null,
            startTime: new Date(),
          },
        ],
      });

      const trace = await service.getTrace('trace_1');

      expect(trace).not.toBeNull();
      expect(trace!.inputs).toBeNull();
      expect(trace!.outputs).toBeNull();
      expect(trace!.spans[0].attributes).toBeNull();
      expect(trace!.spans[0].events).toBeNull();
    });
  });

  describe('getWorkflowTraces', () => {
    it('should return traces with parsed JSON fields', async () => {
      mockPrisma.workflowTrace.findMany.mockResolvedValue([
        {
          traceId: 'trace_1',
          inputs: '{"q":"hello"}',
          outputs: null,
          _count: { spans: 3 },
        },
      ]);

      const traces = await service.getWorkflowTraces('wf_1');

      expect(traces[0].inputs).toEqual({ q: 'hello' });
      expect(traces[0].outputs).toBeNull();
      expect(traces[0]._count.spans).toBe(3);
    });

    it('should use default limit of 20', async () => {
      mockPrisma.workflowTrace.findMany.mockResolvedValue([]);

      await service.getWorkflowTraces('wf_1');

      expect(mockPrisma.workflowTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 }),
      );
    });

    it('should accept custom limit', async () => {
      mockPrisma.workflowTrace.findMany.mockResolvedValue([]);

      await service.getWorkflowTraces('wf_1', 50);

      expect(mockPrisma.workflowTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });
  });

  describe('getSlowTraces', () => {
    it('should query slow traces without workflowId filter', async () => {
      mockPrisma.workflowTrace.findMany.mockResolvedValue([]);

      await service.getSlowTraces();

      expect(mockPrisma.workflowTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { totalMs: { not: null } },
          orderBy: { totalMs: 'desc' },
          take: 10,
        }),
      );
    });

    it('should filter by workflowId when provided', async () => {
      mockPrisma.workflowTrace.findMany.mockResolvedValue([]);

      await service.getSlowTraces('wf_1', 5);

      expect(mockPrisma.workflowTrace.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workflowId: 'wf_1', totalMs: { not: null } },
          take: 5,
        }),
      );
    });
  });

  describe('getTraceStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.workflowTrace.count
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(85)   // success
        .mockResolvedValueOnce(15);  // failed
      mockPrisma.workflowTrace.aggregate.mockResolvedValue({
        _avg: { totalMs: 2500 },
      });

      const stats = await service.getTraceStats();

      expect(stats).toEqual({
        total: 100,
        success: 85,
        failed: 15,
        successRate: '85.0',
        avgDurationMs: 2500,
      });
    });

    it('should filter by workflowId when provided', async () => {
      mockPrisma.workflowTrace.count.mockResolvedValue(0);
      mockPrisma.workflowTrace.aggregate.mockResolvedValue({
        _avg: { totalMs: null },
      });

      await service.getTraceStats('wf_1');

      // All queries should have workflowId filter
      const countCalls = mockPrisma.workflowTrace.count.mock.calls;
      expect(countCalls[0][0].where).toEqual({ workflowId: 'wf_1' });
      expect(countCalls[1][0].where).toEqual({ workflowId: 'wf_1', status: 'success' });
      expect(countCalls[2][0].where).toEqual({ workflowId: 'wf_1', status: 'failed' });
    });

    it('should handle zero traces', async () => {
      mockPrisma.workflowTrace.count.mockResolvedValue(0);
      mockPrisma.workflowTrace.aggregate.mockResolvedValue({
        _avg: { totalMs: null },
      });

      const stats = await service.getTraceStats();

      expect(stats.total).toBe(0);
      expect(stats.successRate).toBe('0');
      expect(stats.avgDurationMs).toBe(0);
    });
  });
});
