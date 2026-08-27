/**
 * 限流与熔断监控页面：展示熔断器状态并提供手动重置。
 *
 * 同时展示一份限流策略说明（窗口/上限/并发），
 * 帮助管理员快速了解当前服务的保护配置。
 */
import { useState, useEffect } from 'react'
import { Spin, Tag, Button, message, Progress } from 'antd'
import { SafetyOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import {
  getCircuitBreakers,
  getRateLimitConfig,
  resetCircuitBreaker,
  CircuitBreakerStats,
  RateLimitConfig,
} from '../utils/rateLimitApi'

/** 熔断器状态 → 标签颜色与文案 */
const CIRCUIT_STATE_MAP: Record<string, { color: string; label: string }> = {
  closed: { color: 'green', label: '关闭（正常）' },
  open: { color: 'red', label: '熔断（拒绝）' },
  half_open: { color: 'orange', label: '半开（探测）' },
}

/** 熔断器名称 → 中文名 */
const CIRCUIT_NAME_MAP: Record<string, string> = {
  workflow: '工作流执行',
  ai: 'AI 模型调用',
  knowledge_base: '知识库操作',
}

/** 限流规则名称 → 中文名 */
const LIMIT_NAME_MAP: Record<string, string> = {
  'api:global': '全局限流',
  'api:user': '用户限流',
  'workflow:run': '工作流执行',
  'ai:call': 'AI 模型调用',
  'kb:operation': '知识库操作',
}

/** 限流监控页面组件 */
const RateLimitMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [circuits, setCircuits] = useState<CircuitBreakerStats[]>([])
  const [limits, setLimits] = useState<Record<string, RateLimitConfig>>({})

  /** 加载熔断器数据 */
  const loadData = async () => {
    setLoading(true)
    try {
      const [circuitData, limitData] = await Promise.all([
        getCircuitBreakers(),
        getRateLimitConfig(),
      ])
      setCircuits(Array.isArray(circuitData) ? circuitData : [])
      setLimits(limitData)
    } catch (err) {
      console.error('Failed to load rate limit data:', err)
      setCircuits([])
      setLimits({})
      message.error('加载限流监控数据失败')
    } finally {
      setLoading(false)
    }
  }

  // 进入页面时加载一次
  useEffect(() => {
    loadData()
  }, [])

  /** 手动重置熔断器并刷新列表 */
  const handleReset = async (name: string) => {
    try {
      await resetCircuitBreaker(name)
      message.success(`熔断器 [${CIRCUIT_NAME_MAP[name] || name}] 已重置`)
      loadData()
    } catch {
      message.error('重置失败')
    }
  }

  /** 剩余配额百分比（用于进度条展示） */
  const getQuotaPercent = (remaining: number, max: number) => {
    if (max === 0) return 100
    return Math.round((remaining / max) * 100)
  }

  return (
    <div className="rate-limit-page">
      <div className="rate-limit-toolbar">
        <h2><SafetyOutlined style={{ marginRight: 8 }} />限流 & 熔断监控</h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {loading ? (
        <div className="rate-limit-loading"><Spin size="large" /></div>
      ) : (
        <>
          {/* 熔断器状态 */}
          <div className="rate-limit-section">
            <h3><ThunderboltOutlined style={{ color: '#f59e0b', marginRight: 8 }} />熔断器状态</h3>
            <div className="circuit-grid">
              {circuits.map((circuit) => {
                const stateInfo = CIRCUIT_STATE_MAP[circuit.state] || { color: 'default', label: circuit.state }
                return (
                  <div className="circuit-card" key={circuit.name}>
                    <div className="circuit-card-header">
                      <span className="circuit-card-name">
                        {CIRCUIT_NAME_MAP[circuit.name] || circuit.name}
                      </span>
                      <Tag color={stateInfo.color}>{stateInfo.label}</Tag>
                    </div>
                    <div className="circuit-card-detail">
                      <span>失败次数: {circuit.failures}</span>
                      {circuit.openedAt && (
                        <span>熔断时间: {new Date(circuit.openedAt).toLocaleString('zh-CN')}</span>
                      )}
                      {circuit.state !== 'closed' && (
                        <Progress
                          percent={getQuotaPercent(
                            circuit.failures,
                            5, // threshold
                          )}
                          status={circuit.state === 'open' ? 'exception' : 'active'}
                          size="small"
                        />
                      )}
                    </div>
                    <div className="circuit-card-actions">
                      <Button
                        size="small"
                        type="link"
                        onClick={() => handleReset(circuit.name)}
                        disabled={circuit.state === 'closed'}
                      >
                        重置熔断器
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 限流配置说明 */}
          <div className="rate-limit-section">
            <h3><SafetyOutlined style={{ color: '#3b82f6', marginRight: 8 }} />限流策略</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
              {Object.entries(limits).map(([name, config]) => (
                <div key={name} style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{LIMIT_NAME_MAP[name] || name}</div>
                  <div style={{ fontSize: 13, color: '#666' }}>
                    窗口: {config.windowSeconds}秒 | 上限: {config.maxRequests}次
                    {config.maxConcurrent ? ` | 并发: ${config.maxConcurrent}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default RateLimitMonitor
