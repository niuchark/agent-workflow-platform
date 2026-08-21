/**
 * 模板市场页面：浏览、筛选、导入与管理工作流模板。
 *
 * 主要能力：
 * - 关键词/分类筛选 + 分类标签页（含各分类数量）；
 * - 查看模板详情、一键导入到指定应用（生成副本工作流）；
 * - 从已有工作流创建模板并发布，或下架/删除自己创建的模板。
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Input, Select, Tag, Card, Button, Modal, Form, Empty, Spin, Row, Col,
  message, Dropdown,
} from 'antd'
import {
  SearchOutlined,
  ImportOutlined,
  PlusOutlined,
  MoreOutlined,
  DeleteOutlined,
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
  TEMPLATE_CATEGORY_OPTIONS,
  Workflow,
  WorkflowTemplate,
} from '../types'

/** 创建模板弹窗的表单值 */
interface CreateTemplateValues {
  applicationId: string
  sourceWorkflowId: string
  name: string
  description?: string
  category: TemplateCategory
  tags?: string[]
}

/** 分类值 → 分类元信息（用于展示名称） */
const categoryMap = Object.fromEntries(TEMPLATE_CATEGORY_OPTIONS.map(c => [c.value, c]))
/** 分类 → 图标 */
const categoryIconMap = {
  productivity: <RocketOutlined aria-hidden="true" />,
  'customer-service': <MessageOutlined aria-hidden="true" />,
  'content-creation': <EditOutlined aria-hidden="true" />,
  'data-analysis': <BarChartOutlined aria-hidden="true" />,
  education: <ReadOutlined aria-hidden="true" />,
  development: <CodeOutlined aria-hidden="true" />,
  other: <AppstoreOutlined aria-hidden="true" />,
}

/** 取某分类的图标（缺省用通用图标） */
const getCategoryIcon = (category?: TemplateCategory) => (
  category ? categoryIconMap[category] : <AppstoreOutlined aria-hidden="true" />
)

/** 模板市场页面组件 */
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
  const [page, setPage] = useState(1)

  // ===== 导入模态状态 =====
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [importAppId, setImportAppId] = useState('')
  const [importLoadingTemplateId, setImportLoadingTemplateId] = useState<string | null>(null)

  // ===== 详情模态状态 =====
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [detailTemplate, setDetailTemplate] = useState<WorkflowTemplate | null>(null)

  // ===== 从现有工作流创建模板的状态 =====
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [sourceWorkflowsLoading, setSourceWorkflowsLoading] = useState(false)
  const [sourceWorkflows, setSourceWorkflows] = useState<Workflow[]>([])
  const [createForm] = Form.useForm<CreateTemplateValues>()
  const sourceApplicationId = Form.useWatch('applicationId', createForm)

  // 进入页面加载应用列表（用于导入/创建弹窗）
  useEffect(() => {
    fetchApps()
  }, [fetchApps])

  /** 按当前筛选条件加载模板列表 */
  const loadTemplates = useCallback(() => {
    fetchTemplates({ keyword: keyword || undefined, category, page, pageSize: 12 })
  }, [keyword, category, page, fetchTemplates])

  // 筛选条件变化时重新加载
  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // 加载分类统计
  useEffect(() => {
    fetchTemplateCategories()
  }, [fetchTemplateCategories])

  /** 搜索：重置页码并搜索 */
  const handleSearch = (value: string) => {
    setKeyword(value)
    setPage(1)
  }

  /** 切换分类：重置页码 */
  const handleCategoryChange = (value: TemplateCategory | undefined) => {
    setCategory(value)
    setPage(1)
  }

  /** 查看模板详情 */
  const handleViewDetail = async (template: WorkflowTemplate) => {
    try {
      const detail = await fetchTemplateById(template.id)
      setDetailTemplate(detail)
      setDetailModalVisible(true)
    } catch {
      message.error('获取模板详情失败')
    }
  }

  /** 点击导入：优先用列表自带结构，缺失时拉取详情 */
  const handleImportClick = async (template: WorkflowTemplate) => {
    if (importLoadingTemplateId) return

    const hasWorkflowStructure = Array.isArray(template.nodes) && Array.isArray(template.edges)
    if (hasWorkflowStructure) {
      setSelectedTemplate(template)
      setImportAppId('')
      setImportModalVisible(true)
      return
    }

    setImportLoadingTemplateId(template.id)
    try {
      const detail = await fetchTemplateById(template.id)
      if (!Array.isArray(detail.nodes) || !Array.isArray(detail.edges)) {
        throw new Error('Template structure is unavailable')
      }
      setSelectedTemplate(detail)
      setImportAppId('')
      setImportModalVisible(true)
    } catch {
      message.error('获取模板结构失败，请重试')
    } finally {
      setImportLoadingTemplateId(null)
    }
  }

  /** 确认导入：在目标应用中创建副本工作流 */
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

  /** 发布模板 */
  const handlePublish = async (id: string) => {
    try {
      await publishTemplate(id)
      message.success('模板已发布')
      loadTemplates()
    } catch {
      message.error('发布失败')
    }
  }

  /** 下架模板 */
  const handleArchive = async (id: string) => {
    try {
      await archiveTemplate(id)
      message.success('模板已下架')
      loadTemplates()
    } catch {
      message.error('下架失败')
    }
  }

  /** 删除模板：弹窗二次确认 */
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

  /** 打开创建模板弹窗 */
  const openCreateModal = () => {
    createForm.resetFields()
    setSourceWorkflows([])
    setCreateModalVisible(true)
  }

  /** 切换来源应用：拉取该应用下的工作流列表 */
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

  /** 选择来源工作流：若用户未填名称则自动带出工作流名 */
  const handleSourceWorkflowChange = (sourceWorkflowId: string) => {
    const workflow = sourceWorkflows.find((item) => item.id === sourceWorkflowId)
    if (!createForm.getFieldValue('name') && workflow) {
      createForm.setFieldValue('name', workflow.name)
    }
  }

  /** 创建模板并发布 */
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

  /** 模板卡片的下拉菜单：按状态显示发布/下架/删除 */
  const getCardMenu = (template: WorkflowTemplate) => ({
    items: [
      ...(template.status === 'draft'
        ? [{ key: 'publish', label: '发布', icon: <RocketOutlined aria-hidden="true" /> }]
        : []),
      ...(template.status === 'published'
        ? [{ key: 'archive', label: '下架', icon: <CheckCircleOutlined aria-hidden="true" /> }]
        : []),
      ...(template.status === 'draft' || template.status === 'published'
        ? [{ type: 'divider' as const }]
        : []),
      { key: 'delete', label: '删除', icon: <DeleteOutlined aria-hidden="true" />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      switch (key) {
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
          prefix={<SearchOutlined className="template-search-icon" aria-hidden="true" />}
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
              <Col key={template.id} xs={24} sm={12} md={8} xl={6}>
                <Card
                  className="template-card"
                  cover={
                    <div className="template-card-cover">
                      {template.screenshot ? (
                        <img src={template.screenshot} alt={template.name} loading="lazy" />
                      ) : (
                        <div className="template-card-cover-placeholder">
                          <span className="template-card-cover-icon">
                            {getCategoryIcon(template.category)}
                          </span>
                        </div>
                      )}
                      {template.isOfficial && (
                        <span className="template-official-badge">
                          <CrownOutlined aria-hidden="true" />
                          官方
                        </span>
                      )}
                    </div>
                  }
                >
                  <div className="template-card-content">
                    <div className="template-card-heading">
                      <div className="template-card-title">
                        {template.icon && <span className="template-card-icon">{template.icon}</span>}
                        <span>{template.name}</span>
                      </div>
                      <Dropdown
                        menu={getCardMenu(template)}
                        trigger={['click']}
                      >
                        <Button
                          type="text"
                          className="template-card-menu-button"
                          icon={<MoreOutlined aria-hidden="true" />}
                          aria-label={`管理模板：${template.name}`}
                        />
                      </Dropdown>
                    </div>
                    <p className="template-card-description">
                      {template.description || '暂无描述'}
                    </p>
                    {template.tags?.length > 0 && (
                      <div className="template-card-tags">
                        {template.tags.slice(0, 2).map((tag) => (
                          <Tag key={tag} className="template-tag">{tag}</Tag>
                        ))}
                      </div>
                    )}
                    <div className="template-card-actions">
                      <Button
                        className="template-card-detail-action"
                        onClick={() => handleViewDetail(template)}
                      >
                        查看详情
                      </Button>
                      <Button
                        type="primary"
                        className="template-card-import-action"
                        icon={<ImportOutlined aria-hidden="true" />}
                        loading={importLoadingTemplateId === template.id}
                        disabled={Boolean(importLoadingTemplateId && importLoadingTemplateId !== template.id)}
                        onClick={() => void handleImportClick(template)}
                      >
                        导入模板
                      </Button>
                    </div>
                  </div>
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
        <Form layout="vertical" className="template-import-form">
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
              <p><strong>包含节点:</strong> {selectedTemplate.nodes.length} 个</p>
              <p><strong>包含连线:</strong> {selectedTemplate.edges.length} 条</p>
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
              icon={<ImportOutlined aria-hidden="true" />}
              disabled={Boolean(importLoadingTemplateId)}
              onClick={() => {
                setDetailModalVisible(false)
                if (detailTemplate) void handleImportClick(detailTemplate)
              }}
            >
              导入模板
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
                {detailTemplate.isOfficial && (
                  <div className="template-detail-meta">
                    <Tag
                      className="template-official-tag"
                      icon={<CrownOutlined aria-hidden="true" />}
                    >
                      官方
                    </Tag>
                  </div>
                )}
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
                <span>{detailTemplate.nodes.length} 个节点</span>
                <span>{detailTemplate.edges.length} 条连线</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default TemplateMarket
