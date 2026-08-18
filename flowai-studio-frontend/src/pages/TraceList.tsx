import { useState, useEffect } from 'react'
import {
  Spin, Table, Tag, Button, Input, Card, Statistic, Row, Col, message,
} from 'antd'
import {
  ReloadOutlined, SearchOutlined, NodeIndexOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import {
  getSlowTraces, getTraceStats,
  TraceListItem, SlowTrace, TraceStats,
} from '../utils/traceApi'
import './TraceList.css'

const STATUS_MAP: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  running: { color: 'processing', icon: <ClockCircleOutlined />, label: '运行中' },
  success: { color: 'success', icon: <CheckCircleOutlined />, label: '成功' },
  failed: { color: 'error', icon: <CloseCircleOutlined />, label: '失败' },
  cancelled: { color: 'default', icon: <CloseCircleOutlined />, label: '已取消' },
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

const TraceList: React.FC = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [slowTraces, setSlowTraces] = useState<SlowTrace[]>([])
  const [stats, setStats] = useState<TraceStats | null>(null)
  const [workflowIdFilter, setWorkflowIdFilter] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [tracesData, statsData] = await Promise.all([
        getSlowTraces(workflowIdFilter || undefined, 50),
        getTraceStats(workflowIdFilter || undefined),
      ])
      setSlowTraces(tracesData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load trace data:', err)
      message.error('加载追踪数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const columns = [
    {
      title: 'Trace ID',
      dataIndex: 'traceId',
      key: 'traceId',
      width: 220,
      render: (text: string) => (
        <a onClick={() => navigate(`/trace-detail?traceId=${text}`)} style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {text}
        </a>
      ),
    },
    {
      title: '工作流',
      dataIndex: 'workflowId',
      key: 'workflowId',
      width: 160,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const info = STATUS_MAP[status] || { color: 'default', icon: null, label: status }
        return <Tag color={info.color} icon={info.icon}>{info.label}</Tag>
      },
    },
    {
      title: '耗时',
      dataIndex: 'totalMs',
      key: 'totalMs',
      width: 100,
      sorter: (a: SlowTrace, b: SlowTrace) => (a.totalMs || 0) - (b.totalMs || 0),
      render: (ms: number | null) => {
        const text = formatDuration(ms)
        const color = ms == null ? undefined : ms > 30000 ? '#ef4444' : ms > 10000 ? '#f59e0b' : '#22c55e'
        return <span style={{ color, fontWeight: 500 }}>{text}</span>
      },
    },
    {
      title: 'Span 数',
      dataIndex: 'spanCount',
      key: 'spanCount',
      width: 90,
    },
    {
      title: '开始时间',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 180,
      render: (iso: string) => formatTime(iso),
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (iso: string | null) => formatTime(iso),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: SlowTrace) => (
        <a onClick={() => navigate(`/trace-detail?traceId=${record.traceId}`)}>详情</a>
      ),
    },
  ]

  return (
    <div className="trace-list-page">
      <div className="trace-list-toolbar">
        <h2><NodeIndexOutlined style={{ marginRight: 8 }} />全链路追踪</h2>
        <div className="trace-list-toolbar-actions">
          <Input
            placeholder="按 Workflow ID 筛选"
            prefix={<SearchOutlined />}
            value={workflowIdFilter}
            onChange={(e) => setWorkflowIdFilter(e.target.value)}
            onPressEnter={loadData}
            style={{ width: 240 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="trace-list-loading"><Spin size="large" /></div>
      ) : (
        <>
          {/* 统计概览 */}
          {stats && (
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="总追踪数" value={stats.total} prefix={<NodeIndexOutlined />} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="成功数"
                    value={stats.success}
                    prefix={<CheckCircleOutlined style={{ color: '#22c55e' }} />}
                    valueStyle={{ color: '#22c55e' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="失败数"
                    value={stats.failed}
                    prefix={<CloseCircleOutlined style={{ color: '#ef4444' }} />}
                    valueStyle={{ color: '#ef4444' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic
                    title="成功率 / 平均耗时"
                    value={`${stats.successRate}% / ${formatDuration(stats.avgDurationMs)}`}
                    valueStyle={{ fontSize: 18 }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* 慢追踪列表 */}
          <Card title="追踪列表（按耗时排序）" size="small">
            <Table
              columns={columns}
              dataSource={slowTraces}
              rowKey="traceId"
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
              scroll={{ x: 1100 }}
            />
          </Card>
        </>
      )}
    </div>
  )
}

export default TraceList
