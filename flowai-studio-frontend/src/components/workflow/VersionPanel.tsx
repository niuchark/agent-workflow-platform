/**
 * 工作流版本管理面板：快照、版本列表、详情、回滚与结构化 Diff。
 *
 * 面板嵌入编辑器右侧检查器。快照基于后端已保存的工作流内容，
 * 因此在创建快照前会先保存当前画布，避免“快照不含刚改的节点”。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  message,
} from 'antd'
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  DisconnectOutlined,
  EditOutlined,
  EyeOutlined,
  LinkOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useStore } from '../../store'
import type { WorkflowEdge, WorkflowNode } from '../../types'
import {
  compareWorkflowVersions,
  createWorkflowVersion,
  deleteWorkflowVersion,
  getWorkflowVersion,
  listWorkflowVersions,
  rollbackWorkflowVersion,
  type ModifiedWorkflowNode,
  type WorkflowVersionDetail,
  type WorkflowVersionDiff,
  type WorkflowVersionMeta,
} from '../../utils/workflowVersionApi'

/** 创建快照表单值 */
interface CreateVersionFormValues {
  label?: string
  description?: string
  isPublished?: boolean
}

/** 从未知异常中提取可读错误信息 */
const getErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return ''
}

/** 把任意字段值转成可读文本，避免直接打印 [object Object] */
const formatValue = (value: unknown): string => {
  if (value == null) return '空'
  if (typeof value === 'string') return value
  return JSON.stringify(value)
}

/** 取节点展示名：优先 data.label，其次节点 id */
const nodeDisplayName = (node: WorkflowNode): string =>
  (node.data as { label?: string } | undefined)?.label || node.id

/** 取连线展示名：source -> target（有条件分支时带上 handle） */
const edgeDisplayName = (edge: WorkflowEdge): string => {
  const { sourceHandle, targetHandle } = edge as WorkflowEdge & {
    sourceHandle?: string
    targetHandle?: string
  }
  const source = sourceHandle ? `${edge.source} (${sourceHandle})` : edge.source
  const target = targetHandle ? `${edge.target} (${targetHandle})` : edge.target
  return `${source} → ${target}`
}

/** 节点变更块：展示字段级 old -> new */
const ModifiedNodeCard: React.FC<{ item: ModifiedWorkflowNode }> = ({ item }) => (
  <div className="version-diff-modified">
    <div className="version-diff-modified-head">
      <EditOutlined aria-hidden="true" />
      <span>{nodeDisplayName({ id: item.id, type: item.type as WorkflowNode['type'], data: {} } as WorkflowNode)}</span>
      <span className="version-diff-modified-type">{item.type}</span>
    </div>
    <div className="version-diff-fields">
      {item.changes.map((change) => (
        <div className="version-diff-field" key={change.field}>
          <span className="version-diff-field-name">{change.field}</span>
          <div className="version-diff-field-values">
            <span className="version-diff-field-old">{formatValue(change.oldValue)}</span>
            <ArrowRightOutlined aria-hidden="true" />
            <span className="version-diff-field-new">{formatValue(change.newValue)}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
)

/** 结构化 Diff 结果 */
const DiffResult: React.FC<{ diff: WorkflowVersionDiff }> = ({ diff }) => {
  const { summary } = diff

  if (!summary.hasChanges) {
    return (
      <div className="version-diff-empty">
        <CheckCircleOutlined aria-hidden="true" />
        <span>两个版本完全一致</span>
      </div>
    )
  }

  return (
    <div className="version-diff-result">
      <div className="version-diff-summary" aria-label="变更统计">
        <span><PlusOutlined aria-hidden="true" /> 新增节点 {summary.nodesAdded}</span>
        <span><MinusCircleOutlined aria-hidden="true" /> 删除节点 {summary.nodesRemoved}</span>
        <span><EditOutlined aria-hidden="true" /> 修改节点 {summary.nodesModified}</span>
        <span><LinkOutlined aria-hidden="true" /> 新增连线 {summary.edgesAdded}</span>
        <span><DisconnectOutlined aria-hidden="true" /> 删除连线 {summary.edgesRemoved}</span>
      </div>

      {diff.addedNodes.length > 0 && (
        <div className="version-diff-group">
          <label className="version-diff-group-label">新增节点</label>
          {diff.addedNodes.map((node) => (
            <div className="version-diff-card version-diff-card--added" key={node.id}>
              <PlusOutlined aria-hidden="true" />
              <div className="version-diff-card-main">
                <span>{nodeDisplayName(node)}</span>
                <span className="version-diff-card-type">{node.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {diff.removedNodes.length > 0 && (
        <div className="version-diff-group">
          <label className="version-diff-group-label">删除节点</label>
          {diff.removedNodes.map((node) => (
            <div className="version-diff-card version-diff-card--removed" key={node.id}>
              <MinusCircleOutlined aria-hidden="true" />
              <div className="version-diff-card-main">
                <span>{nodeDisplayName(node)}</span>
                <span className="version-diff-card-type">{node.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {diff.modifiedNodes.length > 0 && (
        <div className="version-diff-group">
          <label className="version-diff-group-label">修改节点</label>
          {diff.modifiedNodes.map((item) => (
            <ModifiedNodeCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {diff.addedEdges.length > 0 && (
        <div className="version-diff-group">
          <label className="version-diff-group-label">新增连线</label>
          {diff.addedEdges.map((edge, index) => (
            <div className="version-diff-card version-diff-card--added" key={edge.id || `${edge.source}-${edge.target}-${index}`}>
              <LinkOutlined aria-hidden="true" />
              <span>{edgeDisplayName(edge)}</span>
            </div>
          ))}
        </div>
      )}

      {diff.removedEdges.length > 0 && (
        <div className="version-diff-group">
          <label className="version-diff-group-label">删除连线</label>
          {diff.removedEdges.map((edge, index) => (
            <div className="version-diff-card version-diff-card--removed" key={edge.id || `${edge.source}-${edge.target}-${index}`}>
              <DisconnectOutlined aria-hidden="true" />
              <span>{edgeDisplayName(edge)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 工作流版本管理面板 */
const VersionPanel: React.FC = () => {
  const [modal, modalContextHolder] = Modal.useModal()
  const [messageApi, messageContextHolder] = message.useMessage()
  const {
    currentWorkflow,
    nodes,
    edges,
    saveWorkflow,
    fetchWorkflowById,
  } = useStore()

  const workflowId = currentWorkflow?.id
  const [versions, setVersions] = useState<WorkflowVersionMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [compareFrom, setCompareFrom] = useState<number>(0)
  const [compareTo, setCompareTo] = useState<number>(0)
  const [diff, setDiff] = useState<WorkflowVersionDiff | null>(null)
  const [comparing, setComparing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [detail, setDetail] = useState<WorkflowVersionDetail | null>(null)
  const [form] = Form.useForm<CreateVersionFormValues>()

  const loadVersions = useCallback(async () => {
    if (!workflowId) return
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listWorkflowVersions(workflowId)
      setVersions(list)
    } catch (error) {
      setLoadError(getErrorMessage(error) || '加载版本失败')
    } finally {
      setLoading(false)
    }
  }, [workflowId])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // 列表加载完成后，把对比目标默认设为最新版本
  useEffect(() => {
    if (versions.length > 0 && !versions.some((item) => item.version === compareTo)) {
      setCompareTo(versions[0].version)
    }
  }, [versions, compareTo])

  const versionOptions = useMemo(
    () => [
      { value: 0, label: '当前保存版本' },
      ...versions.map((item) => ({
        value: item.version,
        label: `v${item.version}${item.label ? ` · ${item.label}` : ''}`,
      })),
    ],
    [versions],
  )

  const openCreateModal = () => {
    form.resetFields()
    form.setFieldsValue({ isPublished: false })
    setCreateOpen(true)
  }

  const handleCreateVersion = async (values: CreateVersionFormValues) => {
    if (!workflowId) return
    setCreating(true)
    try {
      // 快照读的是后端已保存内容，先保存当前画布，保证快照包含最新节点/连线
      await saveWorkflow(workflowId, { nodes, edges })
      const created = await createWorkflowVersion(workflowId, {
        label: values.label?.trim() || undefined,
        description: values.description?.trim() || undefined,
        isPublished: values.isPublished ?? false,
      })
      messageApi.success(`已创建版本 v${created.version}`)
      setCreateOpen(false)
      await loadVersions()
    } catch (error) {
      messageApi.error(getErrorMessage(error) || '创建版本失败')
    } finally {
      setCreating(false)
    }
  }

  const handleCompare = async () => {
    if (!workflowId || compareFrom === compareTo) return
    setComparing(true)
    try {
      const result = await compareWorkflowVersions(workflowId, compareFrom, compareTo)
      setDiff(result.diff)
    } catch (error) {
      messageApi.error(getErrorMessage(error) || '版本对比失败')
    } finally {
      setComparing(false)
    }
  }

  const handleRollback = (version: number) => {
    if (!workflowId) return
    modal.confirm({
      title: `回滚到 v${version}？`,
      content: '回滚前会自动备份当前版本，画布内容将恢复为该版本。',
      okText: '回滚',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await rollbackWorkflowVersion(workflowId, version)
          // 画布刷新失败不应掩盖“回滚已成功”的事实，仍给出成功反馈
          await fetchWorkflowById(workflowId).catch(() => undefined)
          messageApi.success(`已回滚到 v${version}，自动备份为 v${result.backupVersion}`)
          await loadVersions()
        } catch (error) {
          messageApi.error(getErrorMessage(error) || '回滚失败')
          throw error
        }
      },
    })
  }

  const handleDelete = (version: number) => {
    if (!workflowId) return
    modal.confirm({
      title: `删除版本 v${version}？`,
      content: '删除后不可恢复，但不会影响当前工作流内容。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteWorkflowVersion(workflowId, version)
          messageApi.success(`已删除版本 v${version}`)
          await loadVersions()
        } catch (error) {
          messageApi.error(getErrorMessage(error) || '删除失败')
          throw error
        }
      },
    })
  }

  const handleViewDetail = async (version: number) => {
    if (!workflowId) return
    try {
      const data = await getWorkflowVersion(workflowId, version)
      setDetail(data)
    } catch (error) {
      messageApi.error(getErrorMessage(error) || '加载版本详情失败')
    }
  }

  const formatTime = (value: string) =>
    new Date(value).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="version-panel">
      {modalContextHolder}
      {messageContextHolder}

      <div className="version-panel-header">
        <h3>版本管理</h3>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
          disabled={!workflowId}
        >
          新建快照
        </Button>
      </div>

      <div className="version-panel-body">
        <section className="version-section" aria-labelledby="version-list-title">
          <div className="version-section-head">
            <label id="version-list-title" className="version-section-label">版本列表</label>
            <Tooltip title="刷新版本列表">
              <Button
                size="small"
                type="text"
                icon={<ReloadOutlined />}
                onClick={loadVersions}
                disabled={!workflowId}
                aria-label="刷新版本列表"
              />
            </Tooltip>
          </div>

          {loading ? (
            <div className="version-loading">
              <Spin size="small" />
            </div>
          ) : loadError ? (
            <div className="version-error">
              <span>{loadError}</span>
              <Button size="small" onClick={loadVersions}>重试</Button>
            </div>
          ) : versions.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="还没有版本快照，点击「新建快照」创建第一个版本"
            />
          ) : (
            <div className="version-list">
              {versions.map((item) => (
                <div className="version-item" key={item.id}>
                  <div className="version-item-top">
                    <span className="version-item-version">v{item.version}</span>
                    {item.isPublished && <Tag color="blue">已发布</Tag>}
                    <span className="version-item-time">{formatTime(item.createdAt)}</span>
                  </div>
                  {item.label && <div className="version-item-label">{item.label}</div>}
                  {item.description && <div className="version-item-desc">{item.description}</div>}
                  <div className="version-item-actions">
                    <Tooltip title="查看详情">
                      <Button
                        size="small"
                        type="text"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewDetail(item.version)}
                        aria-label={`查看版本 v${item.version} 详情`}
                      />
                    </Tooltip>
                    <Tooltip title="回滚到此版本">
                      <Button
                        size="small"
                        type="text"
                        icon={<RollbackOutlined />}
                        onClick={() => handleRollback(item.version)}
                        aria-label={`回滚到版本 v${item.version}`}
                      />
                    </Tooltip>
                    <Tooltip title="删除版本">
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(item.version)}
                        aria-label={`删除版本 v${item.version}`}
                      />
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="version-section" aria-labelledby="version-compare-title">
          <label id="version-compare-title" className="version-section-label">版本对比</label>
          <div className="version-compare-controls">
            <Select
              className="version-compare-select"
              value={compareFrom}
              onChange={(value) => setCompareFrom(value)}
              options={versionOptions}
              aria-label="对比源版本"
            />
            <SwapOutlined aria-hidden="true" />
            <Select
              className="version-compare-select"
              value={compareTo}
              onChange={(value) => setCompareTo(value)}
              options={versionOptions}
              aria-label="对比目标版本"
            />
            <Button
              size="small"
              type="primary"
              loading={comparing}
              disabled={!workflowId || compareFrom === compareTo || versions.length === 0}
              onClick={handleCompare}
            >
              对比
            </Button>
          </div>

          {diff && (
            <div className="version-diff">
              <div className="version-diff-toolbar">
                <span>
                  对比 v{compareFrom === 0 ? '当前' : compareFrom} 与 v{compareTo === 0 ? '当前' : compareTo}
                </span>
                <Button
                  size="small"
                  type="text"
                  onClick={() => setDiff(null)}
                  aria-label="清除对比结果"
                >
                  清除
                </Button>
              </div>
              <DiffResult diff={diff} />
            </div>
          )}
        </section>
      </div>

      <Modal
        title="新建版本快照"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onOk={() => form.submit()}
        width={420}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateVersion}
          requiredMark={false}
        >
          <Form.Item
            name="label"
            label="版本标签"
            extra="选填，例如「v1.0 正式发布」"
          >
            <Input maxLength={100} placeholder="v1.0 正式发布" />
          </Form.Item>
          <Form.Item
            name="description"
            label="版本说明"
            extra="选填，记录本次变更内容"
          >
            <Input.TextArea maxLength={1000} rows={3} placeholder="本次修改了哪些节点或配置" />
          </Form.Item>
          <Form.Item
            name="isPublished"
            label="发布版本"
            valuePropName="checked"
            extra="发布版本会以「已发布」标签标记"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={detail ? `版本 v${detail.version}` : '版本详情'}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={null}
        width={560}
      >
        {detail && (
          <div className="version-detail">
            <div className="version-detail-meta">
              {detail.isPublished && <Tag color="blue">已发布</Tag>}
              <span>{formatTime(detail.createdAt)}</span>
            </div>
            {detail.label && <div className="version-detail-label">{detail.label}</div>}
            {detail.description && <div className="version-detail-desc">{detail.description}</div>}
            <pre className="version-detail-json">
              {JSON.stringify(
                { nodes: detail.nodes, edges: detail.edges, variables: detail.variables },
                null,
                2,
              )}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default VersionPanel
