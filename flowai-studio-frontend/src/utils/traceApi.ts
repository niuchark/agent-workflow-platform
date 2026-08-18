import request from './axios'

/** Span 记录 */
export interface SpanRecord {
  id: string
  spanId: string
  traceId: string
  parentSpanId: string | null
  name: string
  kind: string
  status: string
  startTime: string
  endTime: string | null
  durationMs: number | null
  attributes: Record<string, any> | null
  events: Record<string, any>[] | null
}

/** Trace 详情 */
export interface TraceDetail {
  id: string
  traceId: string
  workflowId: string
  userId: string | null
  applicationId: string | null
  executionId: string | null
  status: string
  totalMs: number | null
  spanCount: number
  inputs: Record<string, any> | null
  outputs: Record<string, any> | null
  error: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
  spans: SpanRecord[]
}

/** Trace 列表项 */
export interface TraceListItem {
  id: string
  traceId: string
  workflowId: string
  userId: string | null
  applicationId: string | null
  executionId: string | null
  status: string
  totalMs: number | null
  spanCount: number
  inputs: Record<string, any> | null
  outputs: Record<string, any> | null
  error: string | null
  startedAt: string
  completedAt: string | null
  createdAt: string
  _count?: { spans: number }
}

/** 慢 Trace */
export interface SlowTrace {
  id: string
  traceId: string
  workflowId: string
  status: string
  totalMs: number | null
  spanCount: number
  startedAt: string
  completedAt: string | null
  createdAt: string
}

/** Trace 统计 */
export interface TraceStats {
  total: number
  success: number
  failed: number
  successRate: string
  avgDurationMs: number | null
}

/** 获取 Trace 详情 */
export async function getTraceDetail(traceId: string): Promise<TraceDetail> {
  const res: any = await request.get(`/traces/${traceId}`)
  return res
}

/** 获取工作流 Trace 列表 */
export async function getWorkflowTraces(workflowId: string, limit?: number): Promise<TraceListItem[]> {
  const res: any = await request.get(`/traces/workflow/${workflowId}`, {
    params: { limit: limit || 20 },
  })
  return res
}

/** 获取慢 Trace 列表 */
export async function getSlowTraces(workflowId?: string, limit?: number): Promise<SlowTrace[]> {
  const res: any = await request.get('/traces/slow/list', {
    params: { workflowId, limit: limit || 10 },
  })
  return res
}

/** 获取 Trace 统计概览 */
export async function getTraceStats(workflowId?: string): Promise<TraceStats> {
  const res: any = await request.get('/traces/stats/overview', {
    params: { workflowId },
  })
  return res
}
