/**
 * Token 用量与成本统计 API：查询用量明细、成本报表与模型排行。
 *
 * 供成本统计页展示按时间/应用/模型/供应商维度聚合的
 * token 消耗与费用数据。
 */
import request from './axios'

/** 一段查询时间内的汇总统计 */
export interface TokenUsageSummary {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  callCount: number
}

/** 单次 LLM 调用的用量记录 */
export interface TokenUsageRecord {
  id: string
  userId: string
  applicationId: string | null
  workflowId: string | null
  executionId: string | null
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  callType: string
  createdAt: string
}

/** Token 用量查询响应：明细 + 总数 + 汇总 */
export interface TokenUsageResponse {
  records: TokenUsageRecord[]
  total: number
  summary: TokenUsageSummary
}

/** 成本报表中的一组聚合结果 */
export interface CostReportGroup {
  groupKey: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  callCount: number
}

/** 成本报表响应：分组结果 + 总计 */
export interface CostReportResponse {
  groups: CostReportGroup[]
  total: TokenUsageSummary
}

/** 模型排行中的单项 */
export interface ModelRankingItem {
  model: string
  provider: string
  totalTokens: number
  cost: number
  callCount: number
}

/**
 * 查询 Token 使用量
 */
export async function getTokenUsage(params?: {
  startDate?: string
  endDate?: string
  applicationId?: string
  model?: string
  provider?: string
  callType?: string
}): Promise<TokenUsageResponse> {
  const res: any = await request.get('/token-usage', { params, cacheBust: true })
  return res.data ?? res
}

/**
 * 获取成本报表
 */
export async function getCostReport(params?: {
  startDate?: string
  endDate?: string
  applicationId?: string
  groupBy?: 'day' | 'week' | 'month' | 'model' | 'provider'
}): Promise<CostReportResponse> {
  const res: any = await request.get('/token-usage/cost-report', { params, cacheBust: true })
  return res.data ?? res
}

/**
 * 获取模型使用排行
 */
export async function getModelRanking(params?: {
  startDate?: string
  endDate?: string
}): Promise<ModelRankingItem[]> {
  const res: any = await request.get('/token-usage/model-ranking', { params, cacheBust: true })
  return res.data ?? res
}
