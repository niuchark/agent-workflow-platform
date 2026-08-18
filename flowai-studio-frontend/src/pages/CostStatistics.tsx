import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DatePicker, Select, Spin, Empty, Table, Tag,
} from 'antd'
import {
  DollarOutlined, ThunderboltOutlined, ApiOutlined,
  RiseOutlined, FireOutlined,
} from '@ant-design/icons'
import { Column } from '@ant-design/plots'
import { Pie } from '@ant-design/charts'
import dayjs, { Dayjs } from 'dayjs'
import {
  getTokenUsage,
  getCostReport,
  getModelRanking,
  TokenUsageSummary,
  TokenUsageRecord,
  CostReportGroup,
  ModelRankingItem,
} from '../utils/tokenUsageApi'
import { useStore } from '../store'
import './CostStatistics.css'

const { RangePicker } = DatePicker

const CostStatistics: React.FC = () => {
  const { apps, fetchApps } = useStore()
  const initDone = useRef(false)

  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [applicationId, setApplicationId] = useState<string | undefined>()
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day')

  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<TokenUsageSummary | null>(null)
  const [records, setRecords] = useState<TokenUsageRecord[]>([])
  const [costGroups, setCostGroups] = useState<CostReportGroup[]>([])
  const [modelRanking, setModelRanking] = useState<ModelRankingItem[]>([])
  const [recordsTotal, setRecordsTotal] = useState(0)
  const [recordsPage, setRecordsPage] = useState(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      if (applicationId) params.applicationId = applicationId

      const [usageRes, reportRes, rankingRes] = await Promise.all([
        getTokenUsage(params),
        getCostReport({ ...params, groupBy }),
        getModelRanking({ startDate: params.startDate, endDate: params.endDate }),
      ])

      setSummary(usageRes.summary)
      setRecords(usageRes.records)
      setRecordsTotal(usageRes.total)
      setCostGroups(reportRes.groups)
      setModelRanking(rankingRes)
    } catch (err) {
      console.error('Failed to load cost statistics:', err)
    } finally {
      setLoading(false)
    }
  }, [dateRange, applicationId, groupBy])

  const loadRecords = useCallback(async (page: number) => {
    try {
      const params: Record<string, string> = {}
      if (dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD')
      if (dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD')
      if (applicationId) params.applicationId = applicationId

      const res = await getTokenUsage(params)
      setRecords(res.records)
      setRecordsTotal(res.total)
      setRecordsPage(page)
    } catch (err) {
      console.error('Failed to load records:', err)
    }
  }, [dateRange, applicationId])

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    fetchApps()
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M'
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const formatCost = (cost: number) => {
    if (cost >= 1) return `$${cost.toFixed(2)}`
    if (cost >= 0.01) return `$${cost.toFixed(4)}`
    return `$${cost.toFixed(6)}`
  }

  const trendData = costGroups.map((g) => [
    { time: g.groupKey, value: g.promptTokens, type: '输入 Token' },
    { time: g.groupKey, value: g.completionTokens, type: '输出 Token' },
  ]).flat()

  const costByModel = modelRanking.map((m) => ({
    model: `${m.provider}/${m.model}`,
    value: Number(m.cost.toFixed(6)),
  }))

  const rankingData = modelRanking.slice(0, 10).map((m) => ({
    model: m.model,
    cost: Number(m.cost.toFixed(4)),
  }))

  const recordColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      render: (model: string, record: TokenUsageRecord) => (
        <Tag color="purple">{record.provider}/{model}</Tag>
      ),
    },
    {
      title: '调用类型',
      dataIndex: 'callType',
      key: 'callType',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '输入 Token',
      dataIndex: 'promptTokens',
      key: 'promptTokens',
      width: 120,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '输出 Token',
      dataIndex: 'completionTokens',
      key: 'completionTokens',
      width: 120,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '总 Token',
      dataIndex: 'totalTokens',
      key: 'totalTokens',
      width: 120,
      render: (v: number) => formatNumber(v),
    },
    {
      title: '费用',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      render: (v: number) => <span style={{ color: '#f59e0b', fontWeight: 600 }}>{formatCost(v)}</span>,
    },
  ]

  return (
    <div className="cost-statistics-page">
      <div className="cost-statistics-toolbar">
        <h2>成本统计</h2>
        <div className="cost-statistics-filters">
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange([dates[0], dates[1]])
              }
            }}
            format="YYYY-MM-DD"
          />
          <Select
            placeholder="全部应用"
            allowClear
            style={{ width: 180 }}
            value={applicationId}
            onChange={setApplicationId}
            options={(Array.isArray(apps) ? apps : []).map((app: any) => ({
              value: app.id,
              label: app.name,
            }))}
          />
          <Select
            value={groupBy}
            onChange={setGroupBy}
            style={{ width: 120 }}
            options={[
              { value: 'day', label: '按天' },
              { value: 'week', label: '按周' },
              { value: 'month', label: '按月' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="cost-loading"><Spin size="large" /></div>
      ) : (
        <>
          <div className="cost-stat-cards">
            <div className="cost-stat-card">
              <div className="cost-stat-card-label">
                <ThunderboltOutlined style={{ color: '#7c3aed' }} /> 总 Token 用量
              </div>
              <div className="cost-stat-card-value token-value">
                {summary ? formatNumber(summary.totalTokens) : '0'}
                <span className="cost-unit">tokens</span>
              </div>
            </div>
            <div className="cost-stat-card">
              <div className="cost-stat-card-label">
                <DollarOutlined style={{ color: '#f59e0b' }} /> 总费用
              </div>
              <div className="cost-stat-card-value cost-value">
                {summary ? formatCost(summary.cost) : '$0'}
              </div>
            </div>
            <div className="cost-stat-card">
              <div className="cost-stat-card-label">
                <ApiOutlined style={{ color: '#3b82f6' }} /> 调用次数
              </div>
              <div className="cost-stat-card-value call-value">
                {summary ? formatNumber(summary.callCount) : '0'}
                <span className="cost-unit">次</span>
              </div>
            </div>
            <div className="cost-stat-card">
              <div className="cost-stat-card-label">
                <RiseOutlined style={{ color: '#10b981' }} /> 平均每次费用
              </div>
              <div className="cost-stat-card-value avg-value">
                {summary && summary.callCount > 0
                  ? formatCost(summary.cost / summary.callCount)
                  : '$0'}
              </div>
            </div>
          </div>

          <div className="cost-charts-row">
            <div className="cost-chart-card">
              <h3><FireOutlined style={{ color: '#7c3aed', marginRight: 8 }} />Token 用量趋势</h3>
              <div className="cost-chart-container">
                {trendData.length > 0 ? (
                  <Column
                    data={trendData}
                    xField="time"
                    yField="value"
                    colorField="type"
                    group
                    style={{ radius: { topLeft: 4, topRight: 4 } }}
                    color={['#7c3aed', '#a78bfa']}
                    axis={{
                      y: { title: 'Token 数量' },
                      x: { title: groupBy === 'day' ? '日期' : groupBy === 'week' ? '周' : '月份' },
                    }}
                    legend={{ color: { position: 'top' as const } }}
                  />
                ) : (
                  <div className="cost-empty"><Empty description="暂无数据" /></div>
                )}
              </div>
            </div>

            <div className="cost-chart-card">
              <h3><DollarOutlined style={{ color: '#f59e0b', marginRight: 8 }} />费用分布</h3>
              <div className="cost-chart-container">
                {costByModel.length > 0 ? (
                  <Pie
                    data={costByModel}
                    angleField="value"
                    colorField="model"
                    radius={0.8}
                    innerRadius={0.5}
                    label={{
                      text: 'model',
                      position: 'outside' as const,
                      style: { fontSize: 11 },
                    }}
                    legend={{ color: { position: 'right' as const } }}
                    tooltip={{ title: 'model' }}
                  />
                ) : (
                  <div className="cost-empty"><Empty description="暂无数据" /></div>
                )}
              </div>
            </div>
          </div>

          <div className="cost-ranking-section">
            <h3><FireOutlined style={{ color: '#ef4444', marginRight: 8 }} />模型费用排行</h3>
            <div className="cost-ranking-chart">
              {rankingData.length > 0 ? (
                <Column
                  data={rankingData}
                  xField="model"
                  yField="cost"
                  color="#f59e0b"
                  style={{ radius: { topLeft: 4, topRight: 4 } }}
                  axis={{
                    y: { title: '费用 ($)' },
                    x: { title: '模型' },
                  }}
                  label={{
                    text: (d: any) => `$${d.cost}`,
                    position: 'outside' as const,
                    style: { fontSize: 11 },
                  }}
                />
              ) : (
                <div className="cost-empty"><Empty description="暂无数据" /></div>
              )}
            </div>
          </div>

          <div className="cost-usage-section">
            <h3><ApiOutlined style={{ color: '#3b82f6', marginRight: 8 }} />调用明细</h3>
            <Table
              dataSource={records}
              columns={recordColumns}
              rowKey="id"
              size="small"
              pagination={{
                current: recordsPage,
                pageSize: 10,
                total: recordsTotal,
                showTotal: (total) => `共 ${total} 条`,
                onChange: (page) => loadRecords(page),
              }}
            />
          </div>
        </>
      )}
    </div>
  )
}

export default CostStatistics
