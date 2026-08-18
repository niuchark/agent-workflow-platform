import request from './axios'

export interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
  maxConcurrent?: number
}

export interface UserQuota {
  name: string
  remaining: number
  max: number
  windowSeconds: number
}

export interface CircuitBreakerStats {
  name: string
  state: 'closed' | 'open' | 'half_open'
  failures: number
  openedAt: number | null
}

export async function getRateLimitConfig(): Promise<Record<string, RateLimitConfig>> {
  const res: any = await request.get('/rate-limit/config', { cacheBust: true })
  const payload = res.data ?? res
  return payload.limits ?? {}
}

export async function getUserQuota(userId: string): Promise<UserQuota[]> {
  const res: any = await request.get(`/rate-limit/quota/${userId}`, { cacheBust: true })
  const payload = res.data ?? res
  return Array.isArray(payload.quotas) ? payload.quotas : []
}

export async function getCircuitBreakers(): Promise<CircuitBreakerStats[]> {
  const res: any = await request.get('/rate-limit/circuit-breakers', { cacheBust: true })
  const payload = res.data ?? res
  return Array.isArray(payload.circuitBreakers) ? payload.circuitBreakers : []
}

export async function resetCircuitBreaker(name: string): Promise<{ success: boolean; message: string }> {
  return request.post(`/rate-limit/circuit-breakers/${name}/reset`)
}
