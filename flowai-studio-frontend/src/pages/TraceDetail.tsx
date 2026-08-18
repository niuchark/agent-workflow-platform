import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Spin, Tag, Card, Descriptions, Table, Button, message, Empty } from 'antd'
import {
  ArrowLeftOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { getTraceDetail, TraceDetail as TraceDetailType, SpanRecord } from '../utils/traceApi'
import './TraceDetail.css'

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: 'processing', icon: <ClockCircleOutlined />, label: '运行中' },
  success: { color: 'success', icon: <CheckCircleOutlined />, label: '成功' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
  cancelled: { color: 'default', icon: <CloseCircleOutlined />, label: '已取消' },
  ok: { color: 'success', icon: <CheckCircleOutlined />, label: 'OK' },
  error: { color: 'error', icon: <CloseCircleOutlined />, label: 'Error' },
  timeout: { color: 'warning', icon: <ClockCircleOutlined />, label: 'Timeout' },
}

const formatDuration = (ms: number | null | undefined): string => {
  if (ms == null) return '-'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

const formatTime = (iso: string | null | undefined): string => {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

/** 瀑布图行：计算每个 span 相对于 trace 开始的偏移 */
interface WaterfallRow {
  span: SpanRecord
  offsetMs: number
  durationMs: number
  barWidthPercent: number
  barLeftPercent: number
}

const TraceDetailPage: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const traceId = searchParams.get('traceId') || ''

  const [loading, setLoading] = useState(false)
  const [trace, setTrace] = useState<TraceDetailType | null>(null)

  const loadData = async () => {
    if (!traceId) return
    setLoading(true)
    try {
      const data = await getTraceDetail(traceId)
      setTrace(data)
    } catch (err) {
      console.error('Failed to load trace detail:', err)
      message.error('加载追踪详情失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [traceId])

  /** 计算瀑布图数据 */
  const waterfallData = useMemo<WaterfallRow[]>(() => {
    if (!trace || !trace.spans.length) return []

    const traceStart = new Date(trace.startedAt).getTime()
    const traceEnd = trace.completedAt
      ? new Date(trace.completedAt).getTime()
      : Math.max(...trace.spans.map((s) => new Date(s.endTime || s.startTime).getTime()))
    const totalDuration = traceEnd - traceStart || 1 // avoid division by zero

    return trace.spans.map((span) => {
      const spanStart = new Date(span.startTime).getTime()
      const spanEnd = span.endTime ? new Date(span.endTime).getTime() : spanStart
      const offsetMs = spanStart - traceStart
      const durationMs = spanEnd - spanStart

      return {
        span,
        offsetMs,
        durationMs,
        barLeftPercent: Math.max(0, (offsetMs / totalDuration) * 100),
        barWidthPercent: Math.max(0.5, (durationMs / totalDuration) * 100), // min 0.5% for visibility
      }
    })
  }, [trace])

  if (!traceId) {
    return (
      <div className="trace-detail-page">
        <Empty description="未指定 Trace ID" />
      </div>
    )
  }

  if (loading && !trace) {
    return (
      <div className="trace-detail-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (!trace) {
    return (
      <div className="trace-detail-page">
        <Empty description="追踪数据未找到" />
      </div>
    )
  }

  const traceStatus = STATUS_MAP[trace.status] || { color: 'default', icon: null, label: trace.status }

  /** Span 表格列定义 */
  const spanColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: SpanRecord) => {
        const indent = record.parentSpanId ? 16 : 0
        return (
          <span style={{ paddingLeft: indent, fontFamily: 'monospace', fontSize: 12 }}>
            {name}
          </span>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const info = STATUS_MAP[status] || { color: 'default', icon: null, label: status }
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>
      },
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 90,
      render: (ms: number | null) => (
        <span style={{ color: ms != null && ms > 30000 ? '#ef4444' : ms != null && ms > 10000 ? '#f59e0b' : '#22c55e', fontWeight: 500 }}>
          {formatDuration(ms)}
        </span>
      ),
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 180,
      render: (iso: string) => formatTime(iso),
    },
    {
      title: '属性',
      dataIndex: 'attributes',
      key: 'attributes',
      ellipsis: true,
      render: (attrs: Record<string, any> | null) => {
        if (!attrs) return '-'
        return (
          <span style={{ fontSize: 12, color: '#666' }}>
            {Object.entries(attrs).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ')}
          </span>
        )
      },
    },
  ]

  return (
    <div className="trace-detail-page">
      {/* 工具栏 */}
      <div className="trace-detail-toolbar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/trace-list')}>
          返回列表
        </Button>
        <h2 style={{ margin: '0 16px', fontSize: 18 }}>
          追踪详情
          <Tag color={traceStatus.color} icon={traceStatus.icon} style={{ marginLeft: 12 }}>
            {traceStatus.label}
          </Tag>
        </h2>
        <span style={{ fontFamily: 'monospace', color: '#666', fontSize: 13 }}>{traceId}</span>
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 基本信息 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Descriptions column={4} size="small">
          <Descriptions.Item label="工作流 ID">{trace.workflowId}</Descriptions.Item>
          <Descriptions.Item label="执行 ID">{trace.executionId || '-'}</Descriptions.Item>
          <Descriptions.Item label="总耗时">
            <span style={{ fontWeight: 600, color: '#1890ff' }}>{formatDuration(trace.totalMs)}</span>
          </Descriptions.Item>
          <Descriptions.Item label="Span 数">{trace.spanCount}</Descriptions.Item>
          <Descriptions.Item label="开始时间">{formatTime(trace.startedAt)}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{formatTime(trace.completedAt)}</Descriptions.Item>
          <Descriptions.Item label="用户 ID">{trace.userId || '-'}</Descriptions.Item>
          <Descriptions.Item label="应用 ID">{trace.applicationId || '-'}</Descriptions.Item>
        </Descriptions>
        {trace.error && (
          <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 6, color: '#dc2626', fontSize: 13 }}>
            <strong>错误信息：</strong>{trace.error}
          </div>
        )}
      </Card>

      {/* 输入/输出 */}
      {(trace.inputs || trace.outputs) && (
        <Card size="small" title="输入 / 输出" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {trace.inputs && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#3b82f6' }}>输入</div>
                <pre className="trace-json-block">{JSON.stringify(trace.inputs, null, 2)}</pre>
              </div>
            )}
            {trace.outputs && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4, color: '#22c55e' }}>输出</div>
                <pre className="trace-json-block">{JSON.stringify(trace.outputs, null, 2)}</pre>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* 瀑布图 */}
      {waterfallData.length > 0 && (
        <Card size="small" title="执行时间线（瀑布图）" style={{ marginBottom: 16 }}>
          <div className="trace-waterfall">
            {/* 时间刻度 */}
            <div className="trace-waterfall-header">
              <div className="trace-waterfall-label">Span</div>
              <div className="trace-waterfall-bar-area">
                <div className="trace-waterfall-timeline">
                  <span>0ms</span>
                  <span>{formatDuration(trace.totalMs)}</span>
                </div>
              </div>
            </div>
            {/* 瀑布行 */}
            {waterfallData.map((row) => {
              const statusInfo = STATUS_MAP[row.span.status] || { color: 'default', label: row.span.status }
              const barColor = row.span.status === 'error' ? '#ef4444'
                : row.span.status === 'timeout' ? '#f59e0b'
                : '#3b82f6'
              return (
                <div className="trace-waterfall-row" key={row.span.spanId}>
                  <div className="trace-waterfall-label">
                    <span style={{ paddingLeft: row.span.parentSpanId ? 12 : 0, fontSize: 12, fontFamily: 'monospace' }}>
                      {row.span.name}
                    </span>
                  </div>
                  <div className="trace-waterfall-bar-area">
                    <div
                      className="trace-waterfall-bar"
                      style={{
                        left: `${row.barLeftPercent}%`,
                        width: `${row.barWidthPercent}%`,
                        background: barColor,
                      }}
                      title={`${row.span.name}: ${formatDuration(row.durationMs)} (${row.span.status})`}
                    />
                    <span className="trace-waterfall-duration" style={{ left: `${row.barLeftPercent + row.barWidthPercent + 0.5}%` }}>
                      {formatDuration(row.durationMs)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Span 明细表 */}
      <Card size="small" title="Span 明细">
        <Table
          columns={spanColumns}
          dataSource={trace.spans}
          rowKey="spanId"
          size="small"
          pagination={false}
          expandable={{
            rowExpandable: () => true,
            expandedRowRender: (record) => (
              <div style={{ padding: '4px 0' }}>
                {record.events && record.events.length > 0 && (
                  <div>
                    <strong>事件：</strong>
                    <pre className="trace-json-block">{JSON.stringify(record.events, null, 2)}</pre>
                  </div>
                )}
                {record.attributes && (
                  <div>
                    <strong>属性：</strong>
                    <pre className="trace-json-block">{JSON.stringify(record.attributes, null, 2)}</pre>
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#999' }}>
                  spanId: {record.spanId} | parentSpanId: {record.parentSpanId || '(root)'} | kind: {record.kind}
                </div>
              </div>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default TraceDetailPage
