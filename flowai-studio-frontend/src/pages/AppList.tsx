import { useState, useEffect, useRef } from 'react'
import { Button, Modal, Form, Input, Select, Upload, message, Empty, Dropdown, Spin, Alert } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  SearchOutlined,
  RocketOutlined,
  MoreOutlined,
  ArrowRightOutlined,
  InboxOutlined,
  UndoOutlined,
  ImportOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Application } from '../types'
import { DEMO_APP_NAME, DEMO_NODES, DEMO_EDGES } from '../constants/demoWorkflow'
import { importWorkflowDsl, validateWorkflowDsl } from '../utils/workflowDslApi'
import './AppList.css'

const { Search } = Input

const AppList: React.FC = () => {
  const navigate = useNavigate()
  const {
    apps, isLoading, fetchApps, createApp, updateApp, deleteApp, publishApp, unpublishApp,
    archiveApp, unarchiveApp,
    createWorkflow,
  } = useStore()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentApp, setCurrentApp] = useState<Application | null>(null)
  const [form] = Form.useForm()
  const [searchText, setSearchText] = useState('')
  const initDone = useRef(false)

  // DSL 导入相关 state
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importDslContent, setImportDslContent] = useState('')
  const [importFormat, setImportFormat] = useState<'yaml' | 'json'>('yaml')
  const [importAppId, setImportAppId] = useState<string>('')
  const [importNameOverride, setImportNameOverride] = useState('')
  const [importValidation, setImportValidation] = useState<{
    valid: boolean
    errors: string[]
    warnings: string[]
  } | null>(null)
  const [importValidating, setImportValidating] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true

    const initAppList = async () => {
      const fetchedApps = await fetchApps()
      const safeApps = Array.isArray(fetchedApps) ? fetchedApps : []

      if (safeApps.length === 0) {
        try {
          const demoApp = await createApp({
            name: DEMO_APP_NAME,
            description: '一个可直接运行的 AI 问答工作流，包含用户输入、大模型回答和条件分支。在调试面板输入 {"question": "你的问题"} 即可运行。',
          })
          await createWorkflow(demoApp.id, {
            name: '示例工作流 — AI 智能问答',
            description: '用户输入 → 大模型回答 → 条件分支 → 输出',
            nodes: DEMO_NODES as any,
            edges: DEMO_EDGES as any,
          })
          message.success('已为你创建示例应用，点击查看完整工作流 🎉')
        } catch {
          console.warn('示例应用创建失败')
        }
      }
    }
    initAppList()
  }, [])

  const filteredApps = Array.isArray(apps)
    ? apps.filter(
        (app) =>
          app.name.toLowerCase().includes(searchText.toLowerCase()) ||
          (app.description && app.description.toLowerCase().includes(searchText.toLowerCase())),
      )
    : []

  const handleCreate = () => {
    form.resetFields()
    setIsEditing(false)
    setCurrentApp(null)
    setIsModalOpen(true)
  }

  const handleEdit = (app: Application) => {
    form.setFieldsValue({ name: app.name, description: app.description, icon: app.icon })
    setIsEditing(true)
    setCurrentApp(app)
    setIsModalOpen(true)
  }

  const handleSubmit = async (values: { name: string; description?: string; icon?: string }) => {
    try {
      if (isEditing && currentApp) {
        await updateApp(currentApp.id, values)
        message.success('应用更新成功')
      } else {
        await createApp(values)
        message.success('应用创建成功')
      }
      setIsModalOpen(false)
    } catch {
      message.error('操作失败，请重试')
    }
  }

  const handleDelete = async (id: string, e?: any) => {
    e?.domEvent?.stopPropagation?.()
    try {
      await deleteApp(id)
      message.success('应用删除成功')
    } catch {
      message.error('删除失败，请重试')
    }
  }

  const handleEnterEditor = (appId: string) => {
    navigate(`/apps/${appId}/editor`)
  }

  // ===== DSL 导入处理 =====

  const handleOpenImport = () => {
    setImportDslContent('')
    setImportFormat('yaml')
    setImportAppId('')
    setImportNameOverride('')
    setImportValidation(null)
    setImportModalOpen(true)
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setImportDslContent(content)
      if (file.name.endsWith('.json')) {
        setImportFormat('json')
      } else {
        setImportFormat('yaml')
      }
      setImportValidation(null)
    }
    reader.readAsText(file)
    return false
  }

  const handleValidate = async () => {
    if (!importDslContent.trim()) {
      message.warning('请先上传或粘贴 DSL 内容')
      return
    }
    setImportValidating(true)
    try {
      const result = await validateWorkflowDsl(importDslContent, importFormat)
      setImportValidation(result)
    } catch {
      message.error('校验请求失败')
    } finally {
      setImportValidating(false)
    }
  }

  const handleImportConfirm = async () => {
    if (!importDslContent.trim()) {
      message.warning('请先上传或粘贴 DSL 内容')
      return
    }
    if (!importAppId) {
      message.warning('请选择目标应用')
      return
    }
    setImporting(true)
    try {
      const result = await importWorkflowDsl({
        dsl: importDslContent,
        format: importFormat,
        applicationId: importAppId,
        nameOverride: importNameOverride || undefined,
      })
      message.success(`工作流「${result.workflow.name}」导入成功`)
      setImportModalOpen(false)
      fetchApps()
    } catch {
      message.error('导入失败，请检查 DSL 格式后重试')
    } finally {
      setImporting(false)
    }
  }

  // ===== 原有功能 =====

  const getStatusAction = (app: Application) => {
    switch (app.status) {
      case 'draft':
        return [
          {
            key: 'publish',
            label: '发布',
            onClick: async (e: any) => {
              e?.domEvent?.stopPropagation?.()
              try {
                await publishApp(app.id)
                message.success('应用发布成功')
              } catch {
                message.error('发布失败')
              }
            },
          },
          {
            key: 'archive',
            label: '归档',
            icon: <InboxOutlined />,
            onClick: async (e: any) => {
              e?.domEvent?.stopPropagation?.()
              try {
                await archiveApp(app.id)
                message.success('应用已归档')
              } catch {
                message.error('归档失败')
              }
            },
          },
        ]
      case 'published':
        return [
          {
            key: 'unpublish',
            label: '下线',
            onClick: async (e: any) => {
              e?.domEvent?.stopPropagation?.()
              try {
                await unpublishApp(app.id)
                message.success('应用已下线')
              } catch {
                message.error('下线失败')
              }
            },
          },
          {
            key: 'archive',
            label: '归档',
            icon: <InboxOutlined />,
            onClick: async (e: any) => {
              e?.domEvent?.stopPropagation?.()
              try {
                await archiveApp(app.id)
                message.success('应用已归档')
              } catch {
                message.error('归档失败')
              }
            },
          },
        ]
      case 'archived':
        return [
          {
            key: 'unarchive',
            label: '取消归档',
            icon: <UndoOutlined />,
            onClick: async (e: any) => {
              e?.domEvent?.stopPropagation?.()
              try {
                await unarchiveApp(app.id)
                message.success('应用已恢复为草稿')
              } catch {
                message.error('取消归档失败')
              }
            },
          },
        ]
      default:
        return []
    }
  }

  const getCardMenu = (app: Application) => ({
    items: [
      {
        key: 'edit',
        label: '编辑信息',
        icon: <EditOutlined />,
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation?.()
          handleEdit(app)
        },
      },
      ...getStatusAction(app),
      { type: 'divider' as const },
      {
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: (e: any) => handleDelete(app.id, e),
      },
    ].filter(Boolean),
  })

  const statusMap: Record<string, { label: string; cls: string }> = {
    draft: { label: '草稿', cls: 'status-badge--draft' },
    published: { label: '已发布', cls: 'status-badge--published' },
    archived: { label: '已归档', cls: 'status-badge--archived' },
  }

  const safeApps = Array.isArray(apps) ? apps : []

  return (
    <div className="app-list-page">
      {/* Toolbar */}
      <div className="app-toolbar">
        <div className="app-toolbar-left">
          <h2 className="app-page-title">我的应用</h2>
          <span className="app-count-badge">{filteredApps.length}</span>
        </div>
        <div className="app-toolbar-right">
          <Search
            placeholder="搜索应用…"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="app-search"
            allowClear
            prefix={<SearchOutlined style={{ color: 'var(--c-text-tertiary)' }} />}
          />
          <Button icon={<ImportOutlined />} onClick={handleOpenImport}>
            导入
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建应用
          </Button>
        </div>
      </div>

      {/* Card grid */}
      {isLoading ? (
        <div className="app-grid-loading">
          <Spin size="large" />
        </div>
      ) : filteredApps.length > 0 ? (
        <div className="app-card-grid">
          <button className="app-card app-card--new" onClick={handleCreate}>
            <div className="app-card-new-icon">
              <PlusOutlined />
            </div>
            <span className="app-card-new-label">创建新应用</span>
          </button>

          {filteredApps.map((app) => {
            const status = statusMap[app.status]
            return (
              <div
                key={app.id}
                className="app-card"
                onClick={() => handleEnterEditor(app.id)}
              >
                <div className="app-card-header">
                  <div className="app-card-icon">
                    {app.icon ? (
                      <img src={app.icon} alt="" className="app-card-icon-img" />
                    ) : (
                      <AppstoreOutlined />
                    )}
                  </div>
                  <Dropdown
                    menu={getCardMenu(app)}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <button
                      className="app-card-menu-btn"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreOutlined />
                    </button>
                  </Dropdown>
                </div>

                <div className="app-card-body">
                  <h3 className="app-card-name">{app.name}</h3>
                  <p className="app-card-desc">
                    {app.description || '暂无描述'}
                  </p>
                </div>

                <div className="app-card-footer">
                  {status && (
                    <span className={`status-badge ${status.cls}`}>
                      {status.label}
                    </span>
                  )}
                  <span className="app-card-time">
                    {new Date(app.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                  <span className="app-card-enter">
                    编辑 <ArrowRightOutlined />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="app-empty-wrapper">
          <Empty
            description="暂无应用，点击「新建应用」开始搭建"
            style={{ padding: '56px 0' }}
          />
        </div>
      )}

      {/* 新建/编辑应用 Modal */}
      <Modal
        title={isEditing ? '编辑应用' : '新建应用'}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={480}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="应用名称" rules={[{ required: true, message: '请输入应用名称' }]}>
            <Input placeholder="给这个应用起个名字" />
          </Form.Item>
          <Form.Item name="description" label="应用描述">
            <Input.TextArea placeholder="简单描述这个应用的用途" rows={3} />
          </Form.Item>
          <Form.Item name="icon" label="图标 URL（可选）">
            <Input placeholder="https://..." />
          </Form.Item>
          <div className="modal-footer">
            <Button onClick={() => setIsModalOpen(false)}>取消</Button>
            <Button type="primary" htmlType="submit" loading={isLoading} icon={<RocketOutlined />}>
              {isEditing ? '保存修改' : '创建应用'}
            </Button>
          </div>
        </Form>
      </Modal>

      {/* DSL 导入 Modal */}
      <Modal
        title="导入工作流 DSL"
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setImportModalOpen(false)}>取消</Button>
            <Button
              icon={<CheckCircleOutlined />}
              loading={importValidating}
              onClick={handleValidate}
            >
              校验
            </Button>
            <Button
              type="primary"
              icon={<ImportOutlined />}
              loading={importing}
              onClick={handleImportConfirm}
              disabled={importValidation !== null && !importValidation.valid}
            >
              导入
            </Button>
          </div>
        }
        width={600}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          {/* 格式选择 + 文件上传 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>DSL 格式</label>
              <Select
                value={importFormat}
                onChange={setImportFormat}
                style={{ width: '100%' }}
                options={[
                  { value: 'yaml', label: 'YAML (.yaml/.yml)' },
                  { value: 'json', label: 'JSON (.json)' },
                ]}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>上传文件</label>
              <Upload
                accept=".yaml,.yml,.json"
                showUploadList={false}
                beforeUpload={handleFileUpload}
              >
                <Button icon={<FileTextOutlined />}>选择文件</Button>
              </Upload>
            </div>
          </div>

          {/* DSL 内容编辑 */}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              DSL 内容（可粘贴或上传文件后编辑）
            </label>
            <Input.TextArea
              value={importDslContent}
              onChange={(e) => {
                setImportDslContent(e.target.value)
                setImportValidation(null)
              }}
              rows={10}
              placeholder="粘贴 YAML 或 JSON 格式的 DSL 内容…"
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </div>

          {/* 校验结果 */}
          {importValidation && (
            <Alert
              type={importValidation.valid ? 'success' : 'error'}
              showIcon
              icon={importValidation.valid ? <CheckCircleOutlined /> : <WarningOutlined />}
              message={importValidation.valid ? 'DSL 格式校验通过' : 'DSL 格式校验失败'}
              description={
                <div>
                  {importValidation.errors.length > 0 && (
                    <div>
                      <strong>错误:</strong>
                      <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                        {importValidation.errors.map((err, i) => (
                          <li key={i} style={{ color: '#cf1322' }}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importValidation.warnings.length > 0 && (
                    <div>
                      <strong>警告:</strong>
                      <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                        {importValidation.warnings.map((w, i) => (
                          <li key={i} style={{ color: '#faad14' }}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              }
            />
          )}

          {/* 目标应用选择 */}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>目标应用 *</label>
            <Select
              placeholder="选择要将工作流导入到的应用"
              value={importAppId || undefined}
              onChange={setImportAppId}
              style={{ width: '100%' }}
              showSearch
              optionFilterProp="children"
            >
              {safeApps.map((app: any) => (
                <Select.Option key={app.id} value={app.id}>
                  {app.icon || '📋'} {app.name}
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* 工作流名称（可选覆盖） */}
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>
              工作流名称（可选，留空使用 DSL 中的名称）
            </label>
            <Input
              value={importNameOverride}
              onChange={(e) => setImportNameOverride(e.target.value)}
              placeholder="自定义工作流名称"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AppList
