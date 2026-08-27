/**
 * 限流与熔断 API：查询限流配置、用户配额与熔断器状态。
 *
 * 用于限流监控页展示各模块的窗口限制、剩余配额，
 * 以及熔断器开关状态和手动重置能力。
 */
import request, { getResponseData } from './axios'

/** 某个限流模块的窗口配置 */
export interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
  maxConcurrent?: number
}

/** 熔断器状态快照 */
export interface CircuitBreakerStats {
  name: string
  state: 'closed' | 'open' | 'half_open'
  failures: number
  openedAt: number | null
}

/** 获取全局限流配置（按模块名分组） */
export async function getRateLimitConfig(): Promise<Record<string, RateLimitConfig>> {
  const payload = getResponseData<{ limits: Record<string, RateLimitConfig> }>(
    await request.get('/rate-limit/config', { cacheBust: true }),
  )
  return payload.limits
}

/** 获取所有熔断器当前状态 */
export async function getCircuitBreakers(): Promise<CircuitBreakerStats[]> {
  const payload = getResponseData<{ circuitBreakers: CircuitBreakerStats[] }>(
    await request.get('/rate-limit/circuit-breakers', { cacheBust: true }),
  )
  return Array.isArray(payload.circuitBreakers) ? payload.circuitBreakers : []
}

/** 手动重置指定熔断器 */
export async function resetCircuitBreaker(name: string): Promise<{ success: boolean; message: string }> {
  return getResponseData(
    await request.post(`/rate-limit/circuit-breakers/${name}/reset`),
  )
}
