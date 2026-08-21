/**
 * 限流与熔断 API：查询限流配置、用户配额与熔断器状态。
 *
 * 用于限流监控页展示各模块的窗口限制、剩余配额，
 * 以及熔断器开关状态和手动重置能力。
 */
import request from './axios'

/** 某个限流模块的窗口配置 */
export interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
  maxConcurrent?: number
}

/** 用户在某限流窗口内的配额使用情况 */
export interface UserQuota {
  name: string
  remaining: number
  max: number
  windowSeconds: number
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
  const res: any = await request.get('/rate-limit/config', { cacheBust: true })
  const payload = res.data ?? res
  return payload.limits ?? {}
}

/** 获取指定用户的配额使用情况 */
export async function getUserQuota(userId: string): Promise<UserQuota[]> {
  const res: any = await request.get(`/rate-limit/quota/${userId}`, { cacheBust: true })
  const payload = res.data ?? res
  return Array.isArray(payload.quotas) ? payload.quotas : []
}

/** 获取所有熔断器当前状态 */
export async function getCircuitBreakers(): Promise<CircuitBreakerStats[]> {
  const res: any = await request.get('/rate-limit/circuit-breakers', { cacheBust: true })
  const payload = res.data ?? res
  return Array.isArray(payload.circuitBreakers) ? payload.circuitBreakers : []
}

/** 手动重置指定熔断器 */
export async function resetCircuitBreaker(name: string): Promise<{ success: boolean; message: string }> {
  return request.post(`/rate-limit/circuit-breakers/${name}/reset`)
}
