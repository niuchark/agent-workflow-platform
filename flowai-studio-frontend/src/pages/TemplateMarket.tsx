import { useState, useEffect, useCallback } from 'react'
import {
  Input, Select, Tag, Card, Rate, Button, Modal, Form, Empty, Spin, Row, Col,
  message, Dropdown, Tooltip, Badge,
} from 'antd'
import {
  SearchOutlined,
  DownloadOutlined,
  PlusOutlined,
  MoreOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  RocketOutlined,
  CrownOutlined,
  MessageOutlined,
  EditOutlined,
  BarChartOutlined,
  ReadOutlined,
  CodeOutlined,
} from '@ant-design/icons'
import { useStore } from '../store'
import {
  TemplateCategory,
  TemplateSort,
  TEMPLATE_CATEGORY_OPTIONS,
  Workflow,
  WorkflowTemplate,
} from '../types'

interface CreateTemplateValues {
  applicationId: string
  sourceWorkflowId: string
  name: string
  description?: string
  category: TemplateCategory
  tags?: string[]
}

const categoryMap = Object.fromEntries(TEMPLATE_CATEGORY_OPTIONS.map(c => [c.value, c]))
const categoryIconMap = {
  productivity: <RocketOutlined />,
  'customer-service': <MessageOutlined />,
  'content-creation': <EditOutlined />,
  'data-analysis': <BarChartOutlined />,
  education: <ReadOutlined />,
  development: <CodeOutlined />,
  other: <AppstoreOutlined />,
}

const getCategoryIcon = (category?: TemplateCategory) => (
  category ? categoryIconMap[category] : <AppstoreOutlined />
)

const TemplateMarket: React.FC = () => {
  const {
    templates,
    templateTotal,
    templateTotalPages,
    templateCategories,
    templateLoading,
    fetchTemplates,
    fetchTemplateCategories,
    fetchTemplateById,
    createTemplate,
    createFromTemplate,
    publishTemplate,
    archiveTemplate,
    deleteTemplate,
    apps,
    fetchApps,
    fetchWorkflows,
  } = useStore()

  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState<TemplateCategory | undefined>(undefined)
  const [sort, setSort] = useState<TemplateSort>('newest')
  const [page, setPage] = useState(1)

  // 导入模态
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [importAppId, setImportAppId] = useState('')

  // 详情模态
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailTemplate, setDetailTemplate] = useState<WorkflowTemplate | null>(null)

  // 从现有工作流创建模板
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [sourceWorkflowsLoading, setSourceWorkflowsLoading] = useState(false)
  const [sourceWorkflows, setSourceWorkflows] = useState<Workflow[]>([])
  const [createForm] = Form.useForm<CreateTemplateValues>()
  const sourceApplicationId = Form.useWatch('applicationId', createForm)

  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  const loadTemplates = useCallback(() => {
    fetchTemplates({ keyword: keyword || undefined, category, sort, page, pageSize: 12 })
  }, [keyword, category, sort, page, fetchTemplates])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    fetchTemplateCategories()
  }, [fetchTemplateCategories])

  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  const handleCategoryChange = (value: TemplateCategory | undefined) => {
    setCategory(value)
    setPage(1)
  }

  const handleSortChange = (value: TemplateSort) => {
    setSort(value)
    setPage(1)
  }

  const handleViewDetail = async (template: WorkflowTemplate) => {
    try {
      const detail = await fetchTemplateById(template.id)
      setDetailTemplate(detail)
      setDetailModalVisible(true)
    } catch {
      message.error('获取模板详情失败')
    }
  }

  const handleImportClick = (template: WorkflowTemplate) => {
    setSelectedTemplate(template)
    setImportAppId('')
    setImportModalVisible(true)
  }

  const handleImportConfirm = async () => {
    if (!selectedTemplate || !importAppId) {
      message.error('请选择目标应用')
      return
    }
    try {
      const result = await createFromTemplate(selectedTemplate.id, {
        applicationId: importAppId,
        name: `${selectedTemplate.name} (副本)`,
      })
      message.success(`已成功导入模板到工作流「${result.name}」`)
      setImportModalVisible(false)
      loadTemplates()
    } catch {
      message.error('导入失败，请重试')
    }
  }

  const handlePublish = async (id: string) => {
    try {
      await publishTemplate(id)
      message.success('模板已发布')
      loadTemplates()
    } catch {
      message.error('发布失败')
    }
  }

  const handleArchive = async (id: string) => {
    try {
      await archiveTemplate(id)
      message.success('模板已下架')
      loadTemplates()
    } catch {
      message.error('下架失败')
    }
  }

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后不可恢复，确定要删除此模板吗？',
      okText: '确认删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteTemplate(id)
          message.success('模板已删除')
          loadTemplates()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const openCreateModal = () => {
    createForm.resetFields()
    setSourceWorkflows([])
    setCreateModalVisible(true)
  }

  const handleSourceAppChange = async (applicationId: string) => {
    createForm.setFieldValue('sourceWorkflowId', undefined)
    setSourceWorkflows([])
    setSourceWorkflowsLoading(true)
    try {
      setSourceWorkflows(await fetchWorkflows(applicationId))
    } catch {
      message.error('获取工作流失败，请重试')
    } finally {
      setSourceWorkflowsLoading(false)
    }
  }

  const handleSourceWorkflowChange = (sourceWorkflowId: string) => {
    const workflow = sourceWorkflows.find((item) => item.id === sourceWorkflowId)
    if (!createForm.getFieldValue('name') && workflow) {
      createForm.setFieldValue('name', workflow.name)
    }
  }

  const handleCreateTemplate = async (values: CreateTemplateValues) => {
    setCreateSubmitting(true)
    try {
      const template = await createTemplate({
        sourceWorkflowId: values.sourceWorkflowId,
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        category: values.category,
        tags: values.tags,
      })
      await publishTemplate(template.id)
      message.success('模板已创建并发布')
      setCreateModalVisible(false)
      createForm.resetFields()
      setSourceWorkflows([])
      loadTemplates()
      void fetchTemplateCategories()
    } catch {
      message.error('创建模板失败，请重试')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const getCardMenu = (template: WorkflowTemplate) => ({
    items: [
      { key: 'detail', label: '查看详情', icon: <AppstoreOutlined /> },
      { key: 'import', label: '导入', icon: <DownloadOutlined /> },
      ...(template.status === 'draft'
        ? [{ key: 'publish', label: '发布', icon: <RocketOutlined /> }]
        : []),
      ...(template.status === 'published'
        ? [{ key: 'archive', label: '下架', icon: <CheckCircleOutlined /> }]
        : []),
      { type: 'divider' as const },
      { key: 'delete', label: '删除', icon: <MoreOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      switch (key) {
        case 'detail': handleViewDetail(template); break
        case 'import': handleImportClick(template); break
        case 'publish': handlePublish(template.id); break
        case 'archive': handleArchive(template.id); break
        case 'delete': handleDelete(template.id); break
      }
    },
  })

  const safeTemplates = Array.isArray(templates) ? templates : []

  return (
    <div className="template-market-page">
      {/* Header */}
      <div className="template-market-header">
        <div className="template-market-heading-copy">
          <div className="template-market-header-title">
            <h2>模板市场</h2>
            <span className="template-count-badge">{templateTotal}</span>
          </div>
          <p className="template-market-subtitle">
            从精选模板快速创建工作流，一键导入即可使用
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          创建模板
        </Button>
      </div>

      {/* Filter bar */}
      <div className="template-filter-bar">
        <Input
          prefix={<SearchOutlined style={{ color: 'var(--c-text-tertiary)' }} />}
          placeholder="搜索模板名称或描述..."
          allowClear
          value={keyword}
          onChange={(e) => handleSearch(e.target.value)}
          className="template-search-input"
        />
        <Select
          placeholder="全部分类"
          allowClear
          value={category}
          onChange={handleCategoryChange}
          className="template-filter-select"
        >
          {TEMPLATE_CATEGORY_OPTIONS.map(opt => (
            <Select.Option key={opt.value} value={opt.value}>
              {getCategoryIcon(opt.value)} {opt.label}
            </Select.Option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={handleSortChange}
          className="template-sort-select"
        >
          <Select.Option value="newest">最新</Select.Option>
          <Select.Option value="popular">最热</Select.Option>
          <Select.Option value="rating">评分最高</Select.Option>
        </Select>
      </div>

      {/* Category tabs with counts */}
      <div className="template-category-tabs">
        <button
          className={`template-category-tab ${!category ? 'active' : ''}`}
          onClick={() => handleCategoryChange(undefined)}
        >
          全部
        </button>
        {templateCategories.map((cat) => {
          const meta = categoryMap[cat.category]
          return (
            <button
              key={cat.category}
              className={`template-category-tab ${category === cat.category ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat.category)}
            >
              {getCategoryIcon(cat.category)} {meta?.label || cat.category}
              <span className="template-category-count">{cat.count}</span>
            </button>
          )
        })}
      </div>

      {/* Template grid */}
      {templateLoading ? (
        <div className="template-grid-loading">
          <Spin size="large" />
        </div>
      ) : safeTemplates.length > 0 ? (
        <>
          <Row gutter={[16, 16]}>
            {safeTemplates.map((template) => (
              <Col key={template.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  className="template-card"
                  hoverable
                  onClick={() => handleViewDetail(template)}
                  cover={
                    <div className="template-card-cover">
                      {template.screenshot ? (
                        <img src={template.screenshot} alt={template.name} />
                      ) : (
                        <div className="template-card-cover-placeholder">
                          <span className="template-card-cover-icon">
                            {getCategoryIcon(template.category)}
                          </span>
                        </div>
                      )}
                      {template.isOfficial && (
                        <Badge
                          className="template-official-badge"
                          count={<CrownOutlined style={{ color: '#faad14', fontSize: 16 }} />}
                        />
                      )}
                    </div>
                  }
                  actions={[
                    <Tooltip title="查看详情" key="detail">
                      <AppstoreOutlined />
                    </Tooltip>,
                    <Tooltip title="一键导入" key="import">
                      <DownloadOutlined onClick={(e) => {
                        e.stopPropagation()
                        handleImportClick(template)
                      }} />
                    </Tooltip>,
                    <Dropdown
                      menu={getCardMenu(template)}
                      trigger={['click']}
                      key="more"
                    >
                      <MoreOutlined onClick={(e) => e.stopPropagation()} />
                    </Dropdown>,
                  ]}
                >
                  <Card.Meta
                    title={
                      <div className="template-card-title">
                        {template.icon && <span className="template-card-icon">{template.icon}</span>}
                        <span>{template.name}</span>
                      </div>
                    }
                    description={
                      <div className="template-card-desc">
                        <p className="template-card-description">
                          {template.description || '暂无描述'}
                        </p>
                        <div className="template-card-meta">
                          <span className="template-card-rating">
                            <Rate disabled allowHalf value={template.rating} style={{ fontSize: 12 }} />
                            <span className="template-card-rating-num">{template.rating.toFixed(1)}</span>
                          </span>
                          <span className="template-card-downloads">
                            <DownloadOutlined /> {template.downloadCount}
                          </span>
                        </div>
                        <div className="template-card-tags">
                          {template.tags?.slice(0, 3).map((tag) => (
                            <Tag key={tag} className="template-tag">{tag}</Tag>
                          ))}
                        </div>
                      </div>
                    }
                  />
                </Card>
              </Col>
            ))}
          </Row>

          {/* Pagination */}
          {templateTotalPages > 1 && (
            <div className="template-pagination">
              <Button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                上一页
              </Button>
              <span className="template-pagination-info">
                第 {page} / {templateTotalPages} 页
              </span>
              <Button
                disabled={page >= templateTotalPages}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="template-empty-wrapper">
          <Empty
            description={keyword || category ? (
              <div className="template-empty-content">
                <strong>没有匹配的模板</strong>
                <span>换个关键词或清除筛选条件后再试</span>
                <Button onClick={() => {
                  setKeyword('')
                  setCategory(undefined)
                  setPage(1)
                }}>
                  清除筛选
                </Button>
              </div>
            ) : (
              <div className="template-empty-content">
                <strong>还没有已发布的模板</strong>
                <span>从已有工作流创建第一个模板，团队即可一键复用</span>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                  创建模板
                </Button>
              </div>
            )}
          />
        </div>
      )}

      {/* Create modal */}
      <Modal
        title="从工作流创建模板"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => createForm.submit()}
        okText="创建并发布"
        cancelText="取消"
        confirmLoading={createSubmitting}
        destroyOnClose
      >
        <Form<CreateTemplateValues>
          form={createForm}
          layout="vertical"
          requiredMark={false}
          onFinish={handleCreateTemplate}
          className="template-create-form"
        >
          <Form.Item
            name="applicationId"
            label="来源应用"
            rules={[{ required: true, message: '请选择来源应用' }]}
          >
            <Select
              placeholder="选择包含目标工作流的应用"
              options={apps.map((app) => ({ value: app.id, label: app.name }))}
              onChange={handleSourceAppChange}
            />
          </Form.Item>
          <Form.Item
            name="sourceWorkflowId"
            label="来源工作流"
            rules={[{ required: true, message: '请选择来源工作流' }]}
          >
            <Select
              placeholder={sourceApplicationId ? '选择要发布的工作流' : '请先选择应用'}
              disabled={!sourceApplicationId}
              loading={sourceWorkflowsLoading}
              options={sourceWorkflows.map((workflow) => ({ value: workflow.id, label: workflow.name }))}
              onChange={handleSourceWorkflowChange}
              notFoundContent={sourceWorkflowsLoading ? <Spin size="small" /> : '该应用暂无工作流'}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[
              { required: true, message: '请输入模板名称' },
              { max: 100, message: '模板名称不能超过 100 个字符' },
            ]}
          >
            <Input placeholder="例如：智能客服问答流程" />
          </Form.Item>
          <Form.Item
            name="description"
            label="模板说明"
            rules={[{ max: 500, message: '模板说明不能超过 500 个字符' }]}
          >
            <Input.TextArea rows={3} placeholder="说明模板适合解决什么问题" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择模板分类' }]}
          >
            <Select placeholder="选择分类" options={TEMPLATE_CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后按回车，可添加多个" tokenSeparators={[',', '，']} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import modal */}
      <Modal
        title={`导入模板: ${selectedTemplate?.name || ''}`}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={handleImportConfirm}
        okText="导入"
        cancelText="取消"
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="选择目标应用" required>
            <Select
              placeholder="请选择要将模板导入到的应用"
              value={importAppId || undefined}
              onChange={setImportAppId}
            >
              {apps.map((app) => (
                <Select.Option key={app.id} value={app.id}>
                  {app.icon || <AppstoreOutlined />} {app.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {selectedTemplate && (
            <div className="import-template-preview">
              <p><strong>模板名称:</strong> {selectedTemplate.name}</p>
              <p><strong>分类:</strong> {categoryMap[selectedTemplate.category]?.label || selectedTemplate.category}</p>
              <p><strong>包含节点:</strong> {Array.isArray(selectedTemplate.nodes) ? selectedTemplate.nodes.length : '?'} 个</p>
              <p><strong>包含连线:</strong> {Array.isArray(selectedTemplate.edges) ? selectedTemplate.edges.length : '?'} 条</p>
            </div>
          )}
        </Form>
      </Modal>

      {/* Detail modal */}
      <Modal
        title={detailTemplate?.name || '模板详情'}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={
          <div className="template-detail-footer">
            <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={() => {
                setDetailModalVisible(false)
                if (detailTemplate) handleImportClick(detailTemplate)
              }}
            >
              一键导入
            </Button>
          </div>
        }
        width={640}
      >
        {detailTemplate && (
          <div className="template-detail">
            <div className="template-detail-header">
              <span className="template-detail-icon">
                {detailTemplate.icon || getCategoryIcon(detailTemplate.category)}
              </span>
              <div>
                <h3>{detailTemplate.name}</h3>
                <div className="template-detail-meta">
                  <Rate disabled allowHalf value={detailTemplate.rating} style={{ fontSize: 14 }} />
                  <span>{detailTemplate.rating.toFixed(1)} ({detailTemplate.ratingCount} 评分)</span>
                  <span><DownloadOutlined /> {detailTemplate.downloadCount} 次下载</span>
                  {detailTemplate.isOfficial && (
                    <Tag color="gold" icon={<CrownOutlined />}>官方</Tag>
                  )}
                </div>
              </div>
            </div>
            <div className="template-detail-section">
              <h4>描述</h4>
              <p>{detailTemplate.description || '暂无描述'}</p>
            </div>
            <div className="template-detail-section">
              <h4>分类</h4>
              <Tag>{getCategoryIcon(detailTemplate.category)} {categoryMap[detailTemplate.category]?.label || detailTemplate.category}</Tag>
            </div>
            {detailTemplate.tags?.length > 0 && (
              <div className="template-detail-section">
                <h4>标签</h4>
                <div>{detailTemplate.tags.map((tag: string) => <Tag key={tag}>{tag}</Tag>)}</div>
              </div>
            )}
            <div className="template-detail-section">
              <h4>工作流结构</h4>
              <div className="template-detail-structure">
                <span>{Array.isArray(detailTemplate.nodes) ? detailTemplate.nodes.length : '?'} 个节点</span>
                <span>{Array.isArray(detailTemplate.edges) ? detailTemplate.edges.length : '?'} 条连线</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TemplateMarket
