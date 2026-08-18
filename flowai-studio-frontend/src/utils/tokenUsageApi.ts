import request from './axios'

export interface TokenUsageSummary {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  callCount: number
}

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

export interface TokenUsageResponse {
  records: TokenUsageRecord[]
  total: number
  summary: TokenUsageSummary
}

export interface CostReportGroup {
  groupKey: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  callCount: number
}

export interface CostReportResponse {
  groups: CostReportGroup[]
  total: TokenUsageSummary
}

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
